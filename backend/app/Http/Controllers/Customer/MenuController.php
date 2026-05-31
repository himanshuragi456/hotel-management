<?php

namespace App\Http\Controllers\Customer;

use App\Events\OrderStatusUpdated;
use App\Http\Controllers\Controller;
use App\Models\MenuCategory;
use App\Models\MenuItem;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\RestaurantTable;
use App\Models\SystemSetting;
use App\Models\Tenant;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

class MenuController extends Controller
{
    use ApiResponse;

    private function suspendedResponse(Tenant $tenant): \Illuminate\Http\JsonResponse
    {
        $settings = SystemSetting::allAsMap();
        return response()->json([
            'success'     => false,
            'message'     => 'tenant_suspended',
            'tenant_name' => $tenant->name,
            'branding'    => [
                'brand_name'       => $settings['brand_name']       ?? null,
                'brand_logo_url'   => isset($settings['brand_logo']) ? asset('storage/' . $settings['brand_logo']) : null,
                'contact_phone'    => $settings['contact_phone']    ?? null,
                'contact_whatsapp' => $settings['contact_whatsapp'] ?? null,
                'contact_email'    => $settings['contact_email']    ?? null,
                'sales_tagline'    => $settings['sales_tagline']    ?? null,
            ],
        ], 410);
    }

    public function menu(string $tenantSlug, string $qrToken): JsonResponse
    {
        $tenant = Tenant::where('slug', $tenantSlug)->first();
        if (! $tenant) abort(404);
        if ($tenant->status === 'suspended') return $this->suspendedResponse($tenant);

        $table  = RestaurantTable::where('qr_token', $qrToken)->where('tenant_id', $tenant->id)->firstOrFail();

        $categories = MenuCategory::where('tenant_id', $tenant->id)
            ->where('is_active', true)
            ->with(['items' => fn($q) => $q->where('is_available', true)->orderBy('sort_order')])
            ->orderBy('sort_order')
            ->get();

        // Recover active order numbers for this table session so the customer
        // can see their orders after a page refresh.
        // Only return orders if the table is currently occupied and we know when
        // that session started — prevents past sessions leaking onto a free table.
        $activeOrderNumbers = null;
        if (in_array($table->status, ['occupied', 'reserved']) && $table->occupied_since) {
            $activeOrderNumbers = Order::where('tenant_id', $tenant->id)
                ->where('restaurant_table_id', $table->id)
                ->whereNotIn('status', ['cancelled'])
                ->where('created_at', '>=', $table->occupied_since)
                ->pluck('order_number')
                ->implode(',') ?: null;
        }

        return $this->success([
            'tenant_id'            => $tenant->id,
            'tenant'               => $tenant->only(['name', 'logo', 'currency', 'gst_rate', 'qr_ordering_enabled', 'customer_bill_request_enabled', 'upi_id']),
            'table'                => array_merge(
                $table->only(['id', 'number', 'section', 'bill_requested_at', 'waiter_called_at', 'bill_paid_at']),
                ['status' => $table->status]
            ),
            'active_order_numbers' => $activeOrderNumbers ?: null,
            'categories'           => $categories,
        ]);
    }

    public function placeOrder(Request $request, string $tenantSlug, string $qrToken): JsonResponse
    {
        $tenant = Tenant::where('slug', $tenantSlug)->first();
        if (! $tenant) abort(404);
        if ($tenant->status === 'suspended') return $this->suspendedResponse($tenant);

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

            if ($table->status !== 'occupied') $table->occupy();
            DB::commit();

            foreach ($createdOrders as $o) {
                try { broadcast(new OrderStatusUpdated($o))->toOthers(); } catch (\Exception $e) {}
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

    public function callWaiter(string $tenantSlug, string $qrToken): JsonResponse
    {
        $tenant = Tenant::where('slug', $tenantSlug)->where('status', 'active')->firstOrFail();
        $table  = RestaurantTable::where('qr_token', $qrToken)->where('tenant_id', $tenant->id)->firstOrFail();

        if ($table->status !== 'occupied') {
            return $this->error('No active session on this table.', 422);
        }

        $table->callWaiter();

        return $this->success(null, 'Waiter has been called. Someone will be with you shortly.');
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
                $queuePosition = Order::where('tenant_id', $tenantId)
                    ->where('status', 'pending')
                    ->orderBy('id')
                    ->pluck('id')
                    ->search($order->id) + 1;
            }

            return [
                'order_number'   => $order->order_number,
                'status'         => $order->status,
                'payment_status' => $order->payment_status,
                'source'         => $order->source,
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

    public function notifyBillPaid(Request $request, string $tenantSlug, string $qrToken): JsonResponse
    {
        $tenant = Tenant::where('slug', $tenantSlug)->first();
        if (! $tenant) abort(404);

        $table = RestaurantTable::where('qr_token', $qrToken)
            ->where('tenant_id', $tenant->id)
            ->where('status', 'occupied')
            ->firstOrFail();

        $table->notifyBillPaid();

        return $this->success([
            'table_number' => $table->number,
            'bill_paid_at' => $table->bill_paid_at->toIso8601String(),
        ], 'Counter notified.');
    }
}
