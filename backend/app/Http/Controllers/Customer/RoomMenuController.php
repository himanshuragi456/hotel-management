<?php

namespace App\Http\Controllers\Customer;

use App\Events\OrderStatusUpdated;
use App\Http\Controllers\Controller;
use App\Models\Booking;
use App\Models\MenuCategory;
use App\Models\MenuItem;
use App\Models\Order;
use App\Models\Room;
use App\Models\SystemSetting;
use App\Models\Tenant;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class RoomMenuController extends Controller
{
    use ApiResponse;

    private function suspendedResponse(Tenant $tenant): JsonResponse
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

        $room = Room::where('qr_token', $qrToken)->where('tenant_id', $tenant->id)->firstOrFail();

        $categories = MenuCategory::orderableMenu($tenant->id);

        // Active booking for this room (for order linkage)
        $activeBooking = $room->activeBooking;

        // Recover active order numbers placed via room service during this stay
        $activeOrderNumbers = null;
        if ($activeBooking) {
            $activeOrderNumbers = Order::where('tenant_id', $tenant->id)
                ->where('booking_id', $activeBooking->id)
                ->where('source', 'room_qr')
                ->whereNotIn('status', ['cancelled'])
                ->pluck('order_number')
                ->implode(',') ?: null;
        }

        return $this->success([
            'tenant_id'            => $tenant->id,
            'tenant'               => $tenant->only(['name', 'logo', 'currency', 'gst_rate', 'gst_inclusive', 'qr_ordering_enabled']),
            'room'                 => $room->only(['id', 'number', 'type', 'floor']),
            'booking_id'           => $activeBooking?->id,
            'active_order_numbers' => $activeOrderNumbers ?: null,
            'categories'           => $categories,
        ]);
    }

    public function placeOrder(Request $request, string $tenantSlug, string $qrToken): JsonResponse
    {
        $tenant = Tenant::where('slug', $tenantSlug)->first();
        if (! $tenant) abort(404);
        if ($tenant->status === 'suspended') return $this->suspendedResponse($tenant);

        $room = Room::where('qr_token', $qrToken)->where('tenant_id', $tenant->id)->firstOrFail();

        if (!$tenant->qr_ordering_enabled) {
            return $this->error('Online ordering is currently disabled.', 403);
        }

        $v = Validator::make($request->all(), [
            'items'                => 'required|array|min:1',
            'items.*.menu_item_id' => 'required|exists:menu_items,id',
            'items.*.quantity'     => 'required|integer|min:1',
            'items.*.variant_id'   => 'nullable|integer',
            'items.*.addon_ids'    => 'nullable|array',
            'items.*.addon_ids.*'  => 'integer',
            'items.*.notes'        => 'nullable|string',
            'customer_name'        => 'nullable|string|max:100',
            'notes'                => 'nullable|string',
        ]);
        if ($v->fails()) return $this->validationError($v->errors());

        if ($err = $this->assertItemsOrderable($tenant->id, $request->items)) {
            return $this->error($err, 422);
        }

        $activeBooking = $room->activeBooking;

        try {
            $createdOrders = app(\App\Services\OrderService::class)->createOrders(
                $tenant->id,
                $tenant,
                $request->items,
                [
                    'booking_id'    => $activeBooking?->id,
                    'type'          => 'room-service',
                    'source'        => 'room_qr',
                    'notes'         => $request->notes,
                    'customer_name' => $request->customer_name ?? ($activeBooking?->guest?->name),
                ],
            );

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
            ], 'Room service order placed successfully');
        } catch (\Throwable $e) {
            return $this->error('Failed to place order: ' . $e->getMessage(), 500);
        }
    }

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
}
