<?php

namespace App\Http\Controllers\Public;

use App\Events\OrderStatusUpdated;
use App\Http\Controllers\Controller;
use App\Models\MenuCategory;
use App\Models\MenuItem;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\RestaurantTable;
use App\Models\Location;
use App\Models\Tenant;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Razorpay\Api\Api as RazorpayApi;

class MagicTablesController extends Controller
{
    use ApiResponse;

    // -------------------------------------------------------------------------
    // Discovery endpoints
    // -------------------------------------------------------------------------

    public function restaurants(Request $request): JsonResponse
    {
        $query = Tenant::query()
            ->where('status', 'active')
            ->whereHas('modules', fn($q) => $q->where('restaurant', true))
            ->with('modules');

        if ($locationId = $request->query('location_id')) {
            $query->whereHas('locations', fn($q) => $q->where('locations.id', $locationId));
        }

        if ($search = $request->query('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('city', 'like', "%{$search}%")
                  ->orWhere('business_domain', 'like', "%{$search}%");
            });
        }

        $data = $query->orderBy('name')->get()->map(fn($t) => $this->formatTenant($t));
        return $this->success($data);
    }

    public function locations(): JsonResponse
    {
        $locations = Location::where('is_active', true)->orderBy('name')->get();
        return $this->success($locations);
    }

    public function show(string $slug): JsonResponse
    {
        $tenant = $this->activeTenant($slug);
        return $this->success($this->formatTenant($tenant));
    }

    public function tables(string $slug): JsonResponse
    {
        $tenant = $this->activeTenant($slug);

        $tables = RestaurantTable::where('tenant_id', $tenant->id)
            ->with(['activeOrder'])
            ->orderByRaw("FIELD(status, 'free', 'occupied', 'reserved')")
            ->orderBy('number')
            ->get()
            ->map(function (RestaurantTable $t) {
                $mtOrder = ($t->activeOrder && $t->activeOrder->source === 'magic_tables') ? $t->activeOrder : null;
                return [
                    'id'                => $t->id,
                    'table_number'      => $t->number,
                    'capacity'          => $t->capacity,
                    'floor'             => $t->section,
                    'status'            => $t->status,
                    'occupied_since'    => $t->occupied_since?->toIso8601String(),
                    'qr_token'          => $t->qr_token,
                    'bill_requested_at' => $t->bill_requested_at?->toIso8601String(),
                    'waiter_called_at'  => $t->waiter_called_at?->toIso8601String(),
                    'reserved_by_name'  => $mtOrder?->customer_name,
                    'reserved_by_phone' => $mtOrder?->customer_phone,
                ];
            });

        return $this->success($tables);
    }

    public function menu(string $slug): JsonResponse
    {
        $tenant = $this->activeTenant($slug);

        $categories = MenuCategory::where('tenant_id', $tenant->id)
            ->where('is_active', true)
            ->with(['items' => fn($q) => $q->where('is_available', true)->orderBy('sort_order')])
            ->orderBy('sort_order')
            ->get()
            ->map(fn($cat) => [
                'id'    => $cat->id,
                'name'  => $cat->name,
                'items' => $cat->items->map(fn($item) => [
                    'id'           => $item->id,
                    'category_id'  => $item->menu_category_id,
                    'name'         => $item->name,
                    'description'  => $item->description,
                    'price'        => (float) $item->price,
                    'image_url'    => $item->image_url,
                    'is_available' => $item->is_available,
                    'is_veg'       => $item->type === 'veg',
                    'is_ready_made'=> $item->is_ready_made,
                ]),
            ]);

        return $this->success([
            'tenant'     => $this->formatTenant($tenant),
            'categories' => $categories,
        ]);
    }

    public function cities(): JsonResponse
    {
        $cities = Tenant::query()
            ->where('status', 'active')
            ->whereHas('modules', fn($q) => $q->where('restaurant', true))
            ->whereNotNull('city')
            ->distinct()
            ->orderBy('city')
            ->pluck('city');

        return $this->success($cities);
    }

    // -------------------------------------------------------------------------
    // Order + Payment flow
    // -------------------------------------------------------------------------

    /**
     * Validate the cart and table, compute the total, create a Razorpay order,
     * and return payment details. Nothing is written to the database yet —
     * the order only exists after payment is verified in verifyPayment().
     */
    public function createOrder(Request $request, string $slug): JsonResponse
    {
        $tenant = $this->activeTenant($slug);

        if (!($tenant->is_open ?? true)) {
            return $this->error('This restaurant is currently closed.', 403);
        }

        if (!$tenant->qr_ordering_enabled) {
            return $this->error('This restaurant is not accepting online orders right now.', 403);
        }

        $v = Validator::make($request->all(), [
            'table_id'             => 'required|integer|exists:restaurant_tables,id',
            'customer_name'        => 'required|string|max:100',
            'customer_phone'       => 'required|string|max:20',
            'items'                => 'required|array|min:1',
            'items.*.menu_item_id' => 'required|integer|exists:menu_items,id',
            'items.*.quantity'     => 'required|integer|min:1',
            'items.*.notes'        => 'nullable|string|max:255',
        ]);
        if ($v->fails()) return $this->validationError($v->errors());

        $table = RestaurantTable::where('id', $request->table_id)
            ->where('tenant_id', $tenant->id)
            ->firstOrFail();

        if ($table->status === 'occupied') {
            // Allow the same Magic Tables customer to add another batch
            $hasExisting = Order::where('restaurant_table_id', $table->id)
                ->where('source', 'magic_tables')
                ->where('payment_status', 'paid')
                ->where('customer_phone', $request->customer_phone)
                ->where('created_at', '>=', $table->occupied_since)
                ->exists();

            if (!$hasExisting) {
                return $this->error('This table is currently occupied. Please choose another table.', 409);
            }
        }

        // Resolve and price the items (validates they belong to this tenant)
        $resolvedItems = collect($request->items)->map(function ($row) use ($tenant) {
            return [
                'item'     => MenuItem::where('id', $row['menu_item_id'])
                                ->where('tenant_id', $tenant->id)
                                ->where('is_available', true)
                                ->firstOrFail(),
                'quantity' => $row['quantity'],
                'notes'    => $row['notes'] ?? null,
            ];
        });

        $subtotal = $resolvedItems->sum(fn($r) => $r['item']->price * $r['quantity']);
        $tax      = round($subtotal * ($tenant->gst_rate / 100), 2);
        $total    = $subtotal + $tax;

        // Create a Razorpay order for payment (no DB order yet)
        $razorpayOrderId = null;
        $rzpKey    = config('services.razorpay.key');
        $rzpSecret = config('services.razorpay.secret');

        if ($rzpKey && $rzpSecret) {
            try {
                $api      = new RazorpayApi($rzpKey, $rzpSecret);
                $rzpOrder = $api->order->create([
                    'amount'          => (int) round($total * 100),
                    'currency'        => $tenant->currency ?? 'INR',
                    'receipt'         => 'mt_' . uniqid(),
                    'payment_capture' => 1,
                    'notes'           => [
                        'tenant'   => $tenant->name,
                        'table'    => $table->number,
                        'customer' => $request->customer_name,
                        'phone'    => $request->customer_phone,
                    ],
                ]);
                $razorpayOrderId = $rzpOrder->id;
            } catch (\Exception $e) {
                return $this->error('Payment gateway error. Please try again.', 500);
            }
        }

        return $this->success([
            'razorpay_order_id' => $razorpayOrderId,
            'razorpay_key'      => $rzpKey ?: null,
            'amount'            => $total,
            'currency'          => $tenant->currency ?? 'INR',
            'prefill'           => [
                'name'    => $request->customer_name,
                'contact' => $request->customer_phone,
            ],
        ], 'Proceed to payment');
    }

    /**
     * Called by the frontend after Razorpay payment succeeds.
     * Verifies the signature, then creates the order + items in the DB
     * and pushes it live to the kitchen. Nothing was in the DB before this point.
     */
    public function verifyPayment(Request $request, string $slug): JsonResponse
    {
        $tenant = $this->activeTenant($slug);

        $v = Validator::make($request->all(), [
            'razorpay_order_id'   => 'required|string',
            'razorpay_payment_id' => 'required|string',
            'razorpay_signature'  => 'required|string',
            'table_id'            => 'required|integer|exists:restaurant_tables,id',
            'customer_name'       => 'required|string|max:100',
            'customer_phone'      => 'required|string|max:20',
            'items'               => 'required|array|min:1',
            'items.*.menu_item_id'=> 'required|integer|exists:menu_items,id',
            'items.*.quantity'    => 'required|integer|min:1',
            'items.*.notes'       => 'nullable|string|max:255',
        ]);
        if ($v->fails()) return $this->validationError($v->errors());

        // Verify Razorpay signature before touching the DB
        $rzpKey    = config('services.razorpay.key');
        $rzpSecret = config('services.razorpay.secret');

        if ($rzpKey && $rzpSecret) {
            $expected = hash_hmac(
                'sha256',
                $request->razorpay_order_id . '|' . $request->razorpay_payment_id,
                $rzpSecret
            );
            if (!hash_equals($expected, $request->razorpay_signature)) {
                return $this->error('Payment verification failed. Please contact support.', 422);
            }
        }

        $table = RestaurantTable::where('id', $request->table_id)
            ->where('tenant_id', $tenant->id)
            ->firstOrFail();

        if ($table->status === 'occupied') {
            $hasExisting = Order::where('restaurant_table_id', $table->id)
                ->where('source', 'magic_tables')
                ->where('payment_status', 'paid')
                ->where('customer_phone', $request->customer_phone)
                ->where('created_at', '>=', $table->occupied_since)
                ->exists();

            if (!$hasExisting) {
                return $this->error('This table became occupied while you were paying. Please contact staff.', 409);
            }
        }

        // Re-resolve items and prices server-side (never trust client amounts)
        $resolvedItems = collect($request->items)->map(function ($row) use ($tenant) {
            return [
                'item'     => MenuItem::where('id', $row['menu_item_id'])
                                ->where('tenant_id', $tenant->id)
                                ->where('is_available', true)
                                ->firstOrFail(),
                'quantity' => $row['quantity'],
                'notes'    => $row['notes'] ?? null,
            ];
        });

        $subtotal = $resolvedItems->sum(fn($r) => $r['item']->price * $r['quantity']);
        $tax      = round($subtotal * ($tenant->gst_rate / 100), 2);
        $total    = $subtotal + $tax;

        DB::beginTransaction();
        try {
            $order = Order::create([
                'tenant_id'           => $tenant->id,
                'restaurant_table_id' => $table->id,
                'type'                => 'dine-in',
                'source'              => 'magic_tables',
                'status'              => 'pending',
                'payment_status'      => 'paid',
                'razorpay_order_id'   => $request->razorpay_order_id,
                'razorpay_payment_id' => $request->razorpay_payment_id,
                'customer_name'       => $request->customer_name,
                'customer_phone'      => $request->customer_phone,
                'subtotal'            => $subtotal,
                'tax'                 => $tax,
                'total'               => $total,
            ]);

            foreach ($resolvedItems as $r) {
                OrderItem::create([
                    'order_id'     => $order->id,
                    'menu_item_id' => $r['item']->id,
                    'item_name'    => $r['item']->name,
                    'item_price'   => $r['item']->price,
                    'quantity'     => $r['quantity'],
                    'subtotal'     => $r['item']->price * $r['quantity'],
                    'notes'        => $r['notes'],
                ]);
            }

            $table->occupy();

            DB::commit();
        } catch (\Exception $e) {
            DB::rollBack();
            return $this->error('Failed to confirm order: ' . $e->getMessage(), 500);
        }

        // Broadcast to kitchen
        $order->load('items', 'table');
        broadcast(new OrderStatusUpdated($order))->toOthers();

        return $this->success([
            'order_number'  => $order->order_number,
            'order_numbers' => $order->order_number,
            'total'         => $order->total,
            'status'        => $order->status,
        ], 'Payment confirmed! Your order is now with the kitchen.');
    }

    /**
     * Return this customer's orders for their current table session.
     * Identified by table_id + customer_phone query params.
     */
    public function myOrders(Request $request, string $slug): JsonResponse
    {
        $tenant = $this->activeTenant($slug);

        $v = Validator::make($request->all(), [
            'table_id'       => 'required|integer|exists:restaurant_tables,id',
            'customer_phone' => 'required|string',
        ]);
        if ($v->fails()) return $this->validationError($v->errors());

        $table = RestaurantTable::where('id', $request->table_id)
            ->where('tenant_id', $tenant->id)
            ->firstOrFail();

        // Fetch all orders for this table in the current session (bounded by
        // occupied_since), not just MT orders — so billing-added orders also
        // appear for the customer.
        $orders = Order::where('tenant_id', $tenant->id)
            ->where('restaurant_table_id', $table->id)
            ->whereNotIn('status', ['cancelled'])
            ->when($table->occupied_since, fn($q) => $q->where('created_at', '>=', $table->occupied_since))
            ->with('items')
            ->oldest()
            ->get()
            ->map(fn($o) => [
                'id'             => $o->id,
                'order_number'   => $o->order_number,
                'status'         => $o->status,
                'source'         => $o->source,
                'payment_status' => $o->payment_status,
                'total'          => $o->total,
                'created_at'     => $o->created_at->toIso8601String(),
                'queue_position' => in_array($o->status, ['pending', 'preparing'])
                    ? Order::where('tenant_id', $tenant->id)
                        ->where('status', 'pending')
                        ->orderBy('id')
                        ->pluck('id')
                        ->search($o->id) + 1
                    : null,
                'items'          => $o->items->map(fn($i) => [
                    'name'     => $i->item_name,
                    'quantity' => $i->quantity,
                    'subtotal' => $i->subtotal,
                ]),
            ]);

        return $this->success($orders);
    }

    public function callWaiter(Request $request, string $slug): JsonResponse
    {
        $tenant = $this->activeTenant($slug);

        $v = Validator::make($request->all(), [
            'table_id' => 'required|integer|exists:restaurant_tables,id',
        ]);
        if ($v->fails()) return $this->validationError($v->errors());

        $table = RestaurantTable::where('id', $request->table_id)
            ->where('tenant_id', $tenant->id)
            ->firstOrFail();

        if ($table->status !== 'occupied') {
            return $this->error('No active session on this table.', 422);
        }

        $table->callWaiter();

        return $this->success(null, 'Waiter called. Someone will be with you shortly.');
    }

    public function requestBill(Request $request, string $slug): JsonResponse
    {
        $tenant = $this->activeTenant($slug);

        $v = Validator::make($request->all(), [
            'table_id' => 'required|integer|exists:restaurant_tables,id',
        ]);
        if ($v->fails()) return $this->validationError($v->errors());

        $table = RestaurantTable::where('id', $request->table_id)
            ->where('tenant_id', $tenant->id)
            ->firstOrFail();

        if ($table->status !== 'occupied') {
            return $this->error('No active session on this table.', 422);
        }

        $table->requestBill();

        return $this->success(null, 'Bill request sent. Staff will be with you shortly.');
    }

    // -------------------------------------------------------------------------

    private function activeTenant(string $slug): Tenant
    {
        return Tenant::where('slug', $slug)
            ->where('status', 'active')
            ->whereHas('modules', fn($q) => $q->where('restaurant', true))
            ->firstOrFail();
    }

    private function formatTenant(Tenant $t): array
    {
        return [
            'id'                  => $t->id,
            'name'                => $t->name,
            'slug'                => $t->slug,
            'description'         => null,
            'address'             => $t->address,
            'city'                => $t->city,
            'cuisine_type'        => $t->business_domain,
            'logo_url'            => $t->logo ? asset('storage/' . $t->logo) : null,
            'cover_image_url'     => null,
            'avg_rating'          => 0.0,
            'review_count'        => 0,
            'price_range'         => 2,
            'is_open'             => (bool) ($t->is_open ?? true),
            'opens_at'            => null,
            'closes_at'           => null,
            'phone'               => $t->phone,
            'currency'            => $t->currency ?? 'INR',
            'gst_rate'            => (float) ($t->gst_rate ?? 5.0),
            'qr_ordering_enabled' => (bool) $t->qr_ordering_enabled,
        ];
    }
}
