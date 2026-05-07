<?php

namespace App\Http\Controllers\Waiter;

use App\Events\OrderStatusUpdated;
use App\Http\Controllers\Controller;
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
                    'occupied_minutes' => $t->occupied_since ? now()->diffInMinutes($t->occupied_since) : null,
                    'active_order_id'  => $t->activeOrder?->id,
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

        DB::beginTransaction();
        try {
            $order = Order::create([
                'tenant_id'           => $tenantId,
                'restaurant_table_id' => $table->id,
                'waiter_id'           => auth()->id(),
                'type'                => $request->type ?? 'dine-in',
                'notes'               => $request->notes,
                'status'              => 'pending',
            ]);

            foreach ($request->items as $row) {
                $menuItem = MenuItem::where('id', $row['menu_item_id'])
                    ->where('tenant_id', $tenantId)->firstOrFail();

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
            $table->occupy();

            DB::commit();

            broadcast(new OrderStatusUpdated($order->fresh()->load('items', 'table')))->toOthers();

            return $this->created($order->load('items', 'table'), 'Order placed');
        } catch (\Exception $e) {
            DB::rollBack();
            return $this->error('Failed to place order: ' . $e->getMessage(), 500);
        }
    }

    public function myOrders(): JsonResponse
    {
        $orders = Order::where('tenant_id', auth()->user()->tenant_id)
            ->where('waiter_id', auth()->id())
            ->whereNotIn('status', ['served', 'cancelled'])
            ->with(['items', 'table'])
            ->latest()
            ->get();
        return $this->success($orders);
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
