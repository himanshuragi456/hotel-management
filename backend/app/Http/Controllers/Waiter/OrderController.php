<?php

namespace App\Http\Controllers\Waiter;

use App\Events\OrderStatusUpdated;
use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\MenuItem;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\RestaurantTable;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

class OrderController extends Controller
{
    use ApiResponse;

    public function tables(): JsonResponse
    {
        $tables = RestaurantTable::where('tenant_id', auth()->user()->tenant_id)
            ->with('activeOrder')
            ->orderBy('number')
            ->get()
            ->map(function ($t) {
                return [
                    'id'               => $t->id,
                    'number'           => $t->number,
                    'section'          => $t->section,
                    'capacity'         => $t->capacity,
                    'status'           => $t->status,
                    'occupied_since'   => $t->occupied_since,
                    'occupied_minutes' => $t->occupied_since ? (int) round(abs(now()->diffInRealMinutes($t->occupied_since))) : null,
                    'occupied_label'   => $t->occupied_since ? (function() use ($t) {
                        $mins = (int) round(abs(now()->diffInRealMinutes($t->occupied_since)));
                        return $mins >= 60 ? floor($mins / 60) . 'h ' . ($mins % 60) . 'm' : $mins . 'm';
                    })() : null,
                    'active_order_id'   => $t->activeOrder?->id,
                    'bill_requested_at' => $t->bill_requested_at,
                    'waiter_called_at'  => $t->waiter_called_at,
                ];
            });
        return $this->success($tables);
    }

    public function menu(): JsonResponse
    {
        $tenantId = auth()->user()->tenant_id;
        $cats = \App\Models\MenuCategory::where('tenant_id', $tenantId)
            ->where('is_active', true)
            ->with(['items' => fn($q) => $q->where('is_available', true)->orderBy('sort_order')])
            ->orderBy('sort_order')
            ->get();
        return $this->success($cats);
    }

    public function store(Request $request): JsonResponse
    {
        $v = Validator::make($request->all(), [
            'restaurant_table_id' => 'required|exists:restaurant_tables,id',
            'items'               => 'required|array|min:1',
            'items.*.menu_item_id'=> 'required|exists:menu_items,id',
            'items.*.quantity'    => 'required|integer|min:1',
            'items.*.notes'       => 'nullable|string',
            'notes'               => 'nullable|string',
            'type'                => 'in:dine-in,room-service,takeaway',
        ]);
        if ($v->fails()) return $this->validationError($v->errors());

        $tenantId = auth()->user()->tenant_id;
        $table = RestaurantTable::where('id', $request->restaurant_table_id)
            ->where('tenant_id', $tenantId)->firstOrFail();

        // Resolve menu items and split into ready-made vs kitchen
        $resolvedItems = collect($request->items)->map(function ($row) use ($tenantId) {
            $menuItem = MenuItem::where('id', $row['menu_item_id'])
                ->where('tenant_id', $tenantId)->firstOrFail();
            return array_merge($row, ['menu_item' => $menuItem]);
        });

        $kitchenItems   = $resolvedItems->filter(fn($r) => ! $r['menu_item']->is_ready_made);
        $readyMadeItems = $resolvedItems->filter(fn($r) =>   $r['menu_item']->is_ready_made);

        DB::beginTransaction();
        try {
            $createdOrders = [];

            // Kitchen order (pending → goes through chef flow)
            if ($kitchenItems->isNotEmpty()) {
                $order = Order::create([
                    'tenant_id'           => $tenantId,
                    'restaurant_table_id' => $table->id,
                    'waiter_id'           => auth()->id(),
                    'type'                => $request->type ?? 'dine-in',
                    'notes'               => $request->notes,
                    'status'              => 'pending',
                ]);
                foreach ($kitchenItems as $row) {
                    $m = $row['menu_item'];
                    OrderItem::create([
                        'order_id'     => $order->id,
                        'menu_item_id' => $m->id,
                        'item_name'    => $m->name,
                        'item_price'   => $m->price,
                        'quantity'     => $row['quantity'],
                        'subtotal'     => $m->price * $row['quantity'],
                        'notes'        => $row['notes'] ?? null,
                    ]);
                }
                $order->load('items');
                $order->recalculate();
                $createdOrders[] = $order->fresh()->load('items', 'table');
            }

            // Ready-made order (skip kitchen — instantly ready)
            if ($readyMadeItems->isNotEmpty()) {
                $rmOrder = Order::create([
                    'tenant_id'           => $tenantId,
                    'restaurant_table_id' => $table->id,
                    'waiter_id'           => auth()->id(),
                    'type'                => $request->type ?? 'dine-in',
                    'status'              => 'ready',
                ]);
                foreach ($readyMadeItems as $row) {
                    $m = $row['menu_item'];
                    OrderItem::create([
                        'order_id'     => $rmOrder->id,
                        'menu_item_id' => $m->id,
                        'item_name'    => $m->name,
                        'item_price'   => $m->price,
                        'quantity'     => $row['quantity'],
                        'subtotal'     => $m->price * $row['quantity'],
                        'notes'        => $row['notes'] ?? null,
                    ]);
                }
                $rmOrder->load('items');
                $rmOrder->recalculate();
                $createdOrders[] = $rmOrder->fresh()->load('items', 'table');
            }

            $table->occupy();
            DB::commit();

            foreach ($createdOrders as $o) {
                broadcast(new OrderStatusUpdated($o))->toOthers();
                AuditLog::record('order.placed', $o, [], [
                    'order_number' => $o->order_number,
                    'table'        => $table->number,
                    'items'        => $o->items->map(fn($i) => $i->quantity . '× ' . $i->item_name)->implode(', '),
                    'total'        => $o->total,
                ]);
            }

            return $this->created($createdOrders, 'Order placed');
        } catch (\Exception $e) {
            DB::rollBack();
            return $this->error('Failed to place order: ' . $e->getMessage(), 500);
        }
    }

    public function show(Order $order): JsonResponse
    {
        if ($order->tenant_id !== auth()->user()->tenant_id) return $this->forbidden();
        return $this->success($order->load('items', 'table'));
    }

    public function tableOrders(int $tableId): JsonResponse
    {
        $table = RestaurantTable::where('id', $tableId)
            ->where('tenant_id', auth()->user()->tenant_id)
            ->firstOrFail();

        if ($table->status === 'free') {
            return $this->success([]);
        }

        $orders = Order::where('tenant_id', auth()->user()->tenant_id)
            ->where('restaurant_table_id', $tableId)
            ->where('status', '!=', 'cancelled')
            ->when($table->occupied_since, fn($q) => $q->where('created_at', '>=', $table->occupied_since))
            ->with(['items', 'table', 'invoice'])
            ->oldest()
            ->get()
            ->map(function ($order) {
                $data = $order->toArray();
                $mins = (int) round(abs(now()->diffInRealMinutes($order->created_at)));
                $data['elapsed_minutes'] = $mins;
                $data['elapsed_label']   = $mins >= 60 ? floor($mins / 60) . 'h ' . ($mins % 60) . 'm' : $mins . 'm';
                if ($order->preparing_at) {
                    $km = (int) round(abs(now()->diffInRealMinutes($order->preparing_at)));
                    $data['kitchen_minutes'] = $km;
                    $data['kitchen_label']   = $km >= 60 ? floor($km / 60) . 'h ' . ($km % 60) . 'm' : $km . 'm';
                } else {
                    $data['kitchen_minutes'] = null;
                    $data['kitchen_label']   = null;
                }
                return $data;
            });
        return $this->success($orders);
    }

    public function requestBill(Order $order): JsonResponse
    {
        if ($order->tenant_id !== auth()->user()->tenant_id) return $this->forbidden();
        if ($order->status === 'cancelled') return $this->error('Order is cancelled');
        if ($order->invoice) return $this->error('Order already has an invoice');
        if ($order->status !== 'served') {
            $order->update(['status' => 'ready']);
        }
        broadcast(new OrderStatusUpdated($order->fresh()->load('items', 'table')))->toOthers();
        return $this->success($order->fresh(), 'Bill requested — billing counter notified');
    }

    public function myOrders(): JsonResponse
    {
        $orders = Order::where('tenant_id', auth()->user()->tenant_id)
            ->where('waiter_id', auth()->id())
            ->whereNotIn('status', ['served', 'cancelled'])
            ->with(['items', 'table', 'room', 'booking.guest'])
            ->latest()
            ->get()
            ->map(function ($order) {
                $data = $order->toArray();
                $mins = (int) round(abs(now()->diffInRealMinutes($order->created_at)));
                $data['elapsed_minutes'] = $mins;
                $data['elapsed_label']   = $mins >= 60 ? floor($mins / 60) . 'h ' . ($mins % 60) . 'm' : $mins . 'm';
                if ($order->preparing_at) {
                    $km = (int) round(abs(now()->diffInRealMinutes($order->preparing_at)));
                    $data['kitchen_minutes'] = $km;
                    $data['kitchen_label']   = $km >= 60 ? floor($km / 60) . 'h ' . ($km % 60) . 'm' : $km . 'm';
                } else {
                    $data['kitchen_minutes'] = null;
                    $data['kitchen_label']   = null;
                }
                return $data;
            });
        return $this->success($orders);
    }

    public function markServed(Order $order): JsonResponse
    {
        if ($order->tenant_id !== auth()->user()->tenant_id) return $this->forbidden();
        if ($order->status !== 'ready') return $this->error('Order must be ready before marking as served');
        $order->update(['status' => 'served']);
        broadcast(new OrderStatusUpdated($order->fresh()->load('items', 'table', 'room')))->toOthers();
        AuditLog::record('order.served', $order, ['status' => 'ready'], ['status' => 'served', 'order_number' => $order->order_number]);
        return $this->success(null, 'Order marked as served');
    }

    public function addItems(Request $request, Order $order): JsonResponse
    {
        if ($order->tenant_id !== auth()->user()->tenant_id) return $this->forbidden();
        if (in_array($order->status, ['served', 'cancelled'])) return $this->error('Cannot modify a closed order');

        $v = Validator::make($request->all(), [
            'items'                => 'required|array|min:1',
            'items.*.menu_item_id' => 'required|exists:menu_items,id',
            'items.*.quantity'     => 'required|integer|min:1',
            'items.*.notes'        => 'nullable|string',
        ]);
        if ($v->fails()) return $this->validationError($v->errors());

        foreach ($request->items as $row) {
            $menuItem = MenuItem::findOrFail($row['menu_item_id']);
            OrderItem::create([
                'order_id'     => $order->id,
                'menu_item_id' => $menuItem->id,
                'item_name'    => $menuItem->name,
                'item_price'   => $menuItem->price,
                'quantity'     => $row['quantity'],
                'subtotal'     => $menuItem->price * $row['quantity'],
                'notes'        => $row['notes'] ?? null,
            ]);
        }

        $order->load('items');
        $order->recalculate();
        broadcast(new OrderStatusUpdated($order->fresh()->load('items', 'table')))->toOthers();

        return $this->success($order->fresh()->load('items'), 'Items added');
    }
}
