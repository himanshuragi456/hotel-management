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
                'brand_logo_url'   => isset($settings['brand_logo']) ? '/storage/' . $settings['brand_logo'] : null,
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

        $categories = MenuCategory::orderableMenu($tenant->id);

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
            'tenant'               => $tenant->only(['name', 'logo', 'currency', 'gst_rate', 'gst_inclusive', 'qr_ordering_enabled', 'customer_bill_request_enabled', 'upi_id']),
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
            'items'                  => 'required|array|min:1',
            'items.*.menu_item_id'   => 'required|exists:menu_items,id',
            'items.*.quantity'       => 'required|integer|min:1',
            'items.*.variant_id'     => 'nullable|integer',
            'items.*.addon_ids'      => 'nullable|array',
            'items.*.addon_ids.*'    => 'integer',
            'items.*.notes'          => 'nullable|string',
            'customer_name'          => 'required|string|max:100',
            'customer_phone'         => 'required|regex:/^[6-9]\d{9}$/',
            'customer_email'         => 'required|email|max:150',
            'notes'                  => 'nullable|string',
        ]);
        if ($v->fails()) return $this->validationError($v->errors());

        // Guard: every ordered item must be available (and its category orderable now).
        if ($err = $this->assertItemsOrderable($tenant->id, $request->items)) {
            return $this->error($err, 422);
        }

        try {
            $createdOrders = app(\App\Services\OrderService::class)->createOrders(
                $tenant->id,
                $tenant,
                $request->items,
                [
                    'restaurant_table_id' => $table->id,
                    'type'                => 'dine-in',
                    'source'              => 'qr',
                    'notes'               => $request->notes,
                    'customer_name'       => $request->customer_name,
                    'customer_phone'      => $request->customer_phone,
                    'customer_email'      => $request->customer_email,
                ],
            );

            if ($table->status !== 'occupied') $table->occupy($createdOrders[0]->created_at ?? null);

            $svc = app(\App\Services\OrderService::class);
            foreach ($createdOrders as $o) {
                // Customer self-ordered via QR — alert both kitchen and counter.
                $svc->announce($o, 'order.placed');
            }

            $allNumbers = collect($createdOrders)->pluck('order_number')->implode(',');
            $primary    = collect($createdOrders)->firstWhere('status', 'pending') ?? $createdOrders[0];

            return $this->created([
                'order_numbers' => $allNumbers,
                'order_number'  => $primary->order_number,
                'total'         => collect($createdOrders)->sum('total'),
                'status'        => $primary->status,
            ], 'Order placed successfully');
        } catch (\Throwable $e) {
            return $this->error('Failed to place order: ' . $e->getMessage(), 500);
        }
    }

    /**
     * Validate that each requested item is available and its category is orderable now
     * (respects item is_available, category is_active/is_oos, parent OOS and day/time schedule).
     * Returns an error message string, or null if all good.
     */
    private function assertItemsOrderable(int $tenantId, array $items): ?string
    {
        foreach ($items as $row) {
            $item = MenuItem::where('id', $row['menu_item_id'] ?? 0)
                ->where('tenant_id', $tenantId)
                ->with('category.parent', 'category.schedules')
                ->first();
            if (! $item || ! $item->is_available) {
                return 'Sorry, "' . ($item->name ?? 'an item') . '" is no longer available.';
            }
            if ($item->category && ! $item->category->isAvailableNow()) {
                return 'Sorry, "' . $item->category->name . '" is not available right now.';
            }
        }
        return null;
    }

    public function requestBill(string $tenantSlug, string $qrToken): JsonResponse
    {
        $tenant = Tenant::where('slug', $tenantSlug)->firstOrFail();
        if ($tenant->status === 'suspended') return $this->suspendedResponse($tenant);

        if (!$tenant->customer_bill_request_enabled) {
            return $this->error('Bill request feature is not enabled for this restaurant.', 403);
        }

        $table = RestaurantTable::where('qr_token', $qrToken)->where('tenant_id', $tenant->id)->firstOrFail();

        if ($table->status !== 'occupied') {
            return $this->error('No active session on this table.', 422);
        }

        $table->requestBill();

        app(\App\Services\NotificationService::class)->toFloor(
            tenantId: $tenant->id,
            kind: 'bill_requested',
            title: "Table {$table->number} requested the bill",
            body: 'Customer is ready to pay.',
            data: ['table_number' => $table->number],
            tableId: $table->id,
            waiterId: $table->activeOrder?->waiter_id,
        );

        return $this->success(null, 'Bill request sent. Staff will assist you shortly.');
    }

    public function callWaiter(string $tenantSlug, string $qrToken): JsonResponse
    {
        $tenant = Tenant::where('slug', $tenantSlug)->firstOrFail();
        if ($tenant->status === 'suspended') return $this->suspendedResponse($tenant);

        $table  = RestaurantTable::where('qr_token', $qrToken)->where('tenant_id', $tenant->id)->firstOrFail();

        if ($table->status !== 'occupied') {
            return $this->error('No active session on this table.', 422);
        }

        $table->callWaiter();

        app(\App\Services\NotificationService::class)->toFloor(
            tenantId: $tenant->id,
            kind: 'waiter_called',
            title: "Table {$table->number} is calling a waiter",
            body: 'Customer requested assistance.',
            data: ['table_number' => $table->number],
            tableId: $table->id,
            waiterId: $table->activeOrder?->waiter_id,
        );

        return $this->success(null, 'Waiter has been called. Someone will be with you shortly.');
    }

    public function orderStatus(Request $request, string $orderNumber): JsonResponse
    {
        // Support comma-separated order numbers for batch tracking
        $numbers = array_filter(array_map('trim', explode(',', $orderNumber)));
        $orders  = Order::whereIn('order_number', $numbers)
            ->with('items.menuItem.category:id,name')
            ->get();

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
                    'name'         => $i->item_name,
                    'category_name'=> $i->menuItem?->category?->name,
                    'variant_name' => $i->variant_name,
                    'addon_labels' => collect($i->addons ?? [])->pluck('name')->filter()->values(),
                    'quantity'     => $i->quantity,
                    'subtotal'     => $i->subtotal,
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

        app(\App\Services\NotificationService::class)->toFloor(
            tenantId: $tenant->id,
            kind: 'payment_claimed',
            title: "Table {$table->number} says they paid via UPI",
            body: 'Confirm receipt and close the table.',
            data: ['table_number' => $table->number],
            tableId: $table->id,
        );

        return $this->success([
            'table_number' => $table->number,
            'bill_paid_at' => $table->bill_paid_at->toIso8601String(),
        ], 'Counter notified.');
    }
}
