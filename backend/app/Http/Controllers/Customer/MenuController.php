<?php

namespace App\Http\Controllers\Customer;

use App\Events\OrderStatusUpdated;
use App\Http\Controllers\Controller;
use App\Models\MenuCategory;
use App\Models\MenuItem;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\RestaurantTable;
use App\Models\Tenant;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

class MenuController extends Controller
{
    use ApiResponse;

    public function menu(string $tenantSlug, string $qrToken): JsonResponse
    {
        $tenant = Tenant::where('slug', $tenantSlug)->where('status', 'active')->firstOrFail();
        $table  = RestaurantTable::where('qr_token', $qrToken)->where('tenant_id', $tenant->id)->firstOrFail();

        $categories = MenuCategory::where('tenant_id', $tenant->id)
            ->where('is_active', true)
            ->with(['items' => fn($q) => $q->where('is_available', true)->orderBy('sort_order')])
            ->orderBy('sort_order')
            ->get();

        // Recover active order numbers for this table session so the customer
        // can see their orders after a page refresh
        $activeOrderNumbers = Order::where('tenant_id', $tenant->id)
            ->where('restaurant_table_id', $table->id)
            ->whereNotIn('status', ['cancelled'])
            ->when($table->occupied_since, fn($q) => $q->where('created_at', '>=', $table->occupied_since))
            ->pluck('order_number')
            ->implode(',');

        return $this->success([
            'tenant'               => $tenant->only(['name', 'logo', 'currency', 'gst_rate', 'qr_ordering_enabled', 'customer_bill_request_enabled']),
            'table'                => array_merge(
                $table->only(['id', 'number', 'section', 'bill_requested_at']),
                ['status' => $table->status]
            ),
            'active_order_numbers' => $activeOrderNumbers ?: null,
            'categories'           => $categories,
        ]);
    }

    public function placeOrder(Request $request, string $tenantSlug, string $qrToken): JsonResponse
    {
        $tenant = Tenant::where('slug', $tenantSlug)->where('status', 'active')->firstOrFail();
        $table  = RestaurantTable::where('qr_token', $qrToken)->where('tenant_id', $tenant->id)->firstOrFail();

        if (!$tenant->qr_ordering_enabled) {
            return $this->error('Online ordering is currently disabled for this restaurant.', 403);
        }

        $v = Validator::make($request->all(), [
            'items'                => 'required|array|min:1',
            'items.*.menu_item_id' => 'required|exists:menu_items,id',
            'items.*.quantity'     => 'required|integer|min:1',
            'items.*.notes'        => 'nullable|string',
            'customer_name'        => 'nullable|string|max:100',
            'customer_phone'       => 'nullable|string|max:20',
            'notes'                => 'nullable|string',
        ]);
        if ($v->fails()) return $this->validationError($v->errors());

        // Resolve items and split into kitchen vs ready-made (same logic as waiter)
        $resolvedItems = collect($request->items)->map(function ($row) use ($tenant) {
            $item = MenuItem::where('id', $row['menu_item_id'])
                ->where('tenant_id', $tenant->id)
                ->where('is_available', true)
                ->firstOrFail();
            return array_merge($row, ['menu_item' => $item]);
        });

        $kitchenItems   = $resolvedItems->filter(fn($r) => ! $r['menu_item']->is_ready_made);
        $readyMadeItems = $resolvedItems->filter(fn($r) =>   $r['menu_item']->is_ready_made);

        DB::beginTransaction();
        try {
            $createdOrders = [];

            if ($kitchenItems->isNotEmpty()) {
                $order = Order::create([
                    'tenant_id'           => $tenant->id,
                    'restaurant_table_id' => $table->id,
                    'type'                => 'dine-in',
                    'status'              => 'pending',
                    'notes'               => $request->notes,
                    'customer_name'       => $request->customer_name,
                    'customer_phone'      => $request->customer_phone,
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

            // Ready-made: status immediately set to 'ready', skips kitchen
            if ($readyMadeItems->isNotEmpty()) {
                $rmOrder = Order::create([
                    'tenant_id'           => $tenant->id,
                    'restaurant_table_id' => $table->id,
                    'type'                => 'dine-in',
                    'status'              => 'ready',
                    'customer_name'       => $request->customer_name,
                    'customer_phone'      => $request->customer_phone,
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
            }

            $allNumbers = collect($createdOrders)->pluck('order_number')->implode(',');
            $primary    = collect($createdOrders)->firstWhere('status', 'pending') ?? $createdOrders[0];

            return $this->created([
                'order_numbers' => $allNumbers,
                'order_number'  => $primary->order_number,
                'total'         => collect($createdOrders)->sum('total'),
                'status'        => $primary->status,
            ], 'Order placed successfully');
        } catch (\Exception $e) {
            DB::rollBack();
            return $this->error('Failed to place order: ' . $e->getMessage(), 500);
        }
    }

    public function requestBill(string $tenantSlug, string $qrToken): JsonResponse
    {
        $tenant = Tenant::where('slug', $tenantSlug)->where('status', 'active')->firstOrFail();

        if (!$tenant->customer_bill_request_enabled) {
            return $this->error('Bill request feature is not enabled for this restaurant.', 403);
        }

        $table = RestaurantTable::where('qr_token', $qrToken)->where('tenant_id', $tenant->id)->firstOrFail();

        if ($table->status !== 'occupied') {
            return $this->error('No active session on this table.', 422);
        }

        $table->requestBill();

        return $this->success(null, 'Bill request sent. Staff will assist you shortly.');
    }

    public function orderStatus(Request $request, string $orderNumber): JsonResponse
    {
        // Support comma-separated order numbers for batch tracking
        $numbers = array_filter(array_map('trim', explode(',', $orderNumber)));
        $orders  = Order::whereIn('order_number', $numbers)->with('items')->get();

        if ($orders->isEmpty()) abort(404);

        $tenantId = $orders->first()->tenant_id;

        $batches = $orders->map(function (Order $order) use ($tenantId) {
            $queuePosition = null;
            if ($order->status === 'pending') {
                // Count pending kitchen orders placed before this one for the same tenant
                $queuePosition = Order::where('tenant_id', $tenantId)
                    ->where('status', 'pending')
                    ->where('id', '<', $order->id)
                    ->count() + 1;
            }

            return [
                'order_number'   => $order->order_number,
                'status'         => $order->status,
                'queue_position' => $queuePosition,
                'is_ready_made'  => $order->status === 'ready' && $order->preparing_at === null,
                'preparing_at'   => $order->preparing_at,
                'created_at'     => $order->created_at,
                'items'          => $order->items->map(fn($i) => [
                    'name'     => $i->item_name,
                    'quantity' => $i->quantity,
                    'subtotal' => $i->subtotal,
                ]),
                'total'          => $order->total,
            ];
        })->values();

        return $this->success([
            'batches'     => $batches,
            'grand_total' => $batches->sum('total'),
        ]);
    }
}
