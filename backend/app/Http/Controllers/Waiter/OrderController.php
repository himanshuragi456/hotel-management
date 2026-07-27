<?php

namespace App\Http\Controllers\Waiter;

use App\Events\OrderStatusUpdated;
use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Order;
use App\Models\RestaurantTable;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
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
        $cats = \App\Models\MenuCategory::orderableMenu(auth()->user()->tenant_id);
        return $this->success($cats);
    }

    public function store(Request $request): JsonResponse
    {
        $v = Validator::make($request->all(), [
            'restaurant_table_id' => 'required|exists:restaurant_tables,id',
            'items'               => 'required|array|min:1',
            'items.*.menu_item_id'=> 'required|exists:menu_items,id',
            'items.*.quantity'    => 'required|integer|min:1',
            'items.*.variant_id'  => 'nullable|integer',
            'items.*.addon_ids'   => 'nullable|array',
            'items.*.addon_ids.*' => 'integer',
            'items.*.notes'       => 'nullable|string',
            'notes'               => 'nullable|string',
            'type'                => 'in:dine-in,room-service,takeaway',
        ]);
        if ($v->fails()) return $this->validationError($v->errors());

        $tenantId = auth()->user()->tenant_id;
        $tenant   = auth()->user()->tenant;
        $table = RestaurantTable::where('id', $request->restaurant_table_id)
            ->where('tenant_id', $tenantId)->firstOrFail();

        $svc = app(\App\Services\OrderService::class);
        try {
            $createdOrders = $svc->createOrders($tenantId, $tenant, $request->items, [
                'restaurant_table_id' => $table->id,
                'waiter_id'           => auth()->id(),
                'type'                => $request->type ?? 'dine-in',
                'source'              => 'pos',
                'notes'               => $request->notes,
            ]);

            $table->occupy($createdOrders[0]->created_at ?? null);

            foreach ($createdOrders as $o) {
                $svc->announce($o, 'order.placed', ['table' => $table->number]);
            }

            return $this->created($createdOrders, 'Order placed');
        } catch (\Throwable $e) {
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
            // Grace window: the order that occupies a table is created an instant before
            // occupy() stamps occupied_since, so a strict `>=` would hide it.
            ->when($table->occupied_since, fn($q) => $q->where('created_at', '>=', $table->occupied_since->copy()->subSeconds(5)))
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
        try { broadcast(new OrderStatusUpdated($order->fresh()->load('items', 'table')))->toOthers(); } catch (\Exception $e) { /* logged by LoggingAblyBroadcaster */ }
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
        try { broadcast(new OrderStatusUpdated($order->fresh()->load('items', 'table', 'room')))->toOthers(); } catch (\Exception $e) { /* logged by LoggingAblyBroadcaster */ }
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
            'items.*.variant_id'   => 'nullable|integer',
            'items.*.addon_ids'    => 'nullable|array',
            'items.*.addon_ids.*'  => 'integer',
            'items.*.notes'        => 'nullable|string',
        ]);
        if ($v->fails()) return $this->validationError($v->errors());

        $fresh = app(\App\Services\OrderService::class)->addLinesToOrder($order, $request->items);
        try { broadcast(new OrderStatusUpdated($fresh))->toOthers(); } catch (\Exception $e) { /* logged by LoggingAblyBroadcaster */ }

        return $this->success($fresh, 'Items added');
    }
}
