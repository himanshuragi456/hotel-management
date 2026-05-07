<?php

namespace App\Http\Controllers\Waiter;

use App\Http\Controllers\Controller;
use App\Models\Booking;
use App\Models\MenuItem;
use App\Models\Order;
use App\Events\OrderStatusUpdated;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class RoomServiceController extends Controller
{
    use ApiResponse;

    public function activeRooms(Request $request): JsonResponse
    {
        $bookings = Booking::where('tenant_id', $request->_tenant_id)
            ->where('status', 'checked_in')
            ->with(['guest:id,name,phone', 'room:id,number,type,floor'])
            ->get(['id', 'booking_number', 'guest_id', 'room_id', 'check_in_date', 'check_out_date']);

        return $this->success($bookings);
    }

    public function placeOrder(Request $request): JsonResponse
    {
        $data = $request->validate([
            'booking_id' => 'required|exists:bookings,id',
            'notes'      => 'nullable|string',
            'items'      => 'required|array|min:1',
            'items.*.menu_item_id' => 'required|exists:menu_items,id',
            'items.*.quantity'     => 'required|integer|min:1',
            'items.*.notes'        => 'nullable|string',
        ]);

        $tid     = $request->_tenant_id;
        $booking = Booking::where('tenant_id', $tid)->where('status', 'checked_in')->findOrFail($data['booking_id']);

        $order = Order::create([
            'tenant_id'  => $tid,
            'room_id'    => $booking->room_id,
            'booking_id' => $booking->id,
            'waiter_id'  => auth()->id(),
            'type'       => 'room_service',
            'status'     => 'pending',
            'notes'      => $data['notes'] ?? null,
        ]);

        foreach ($data['items'] as $item) {
            $menuItem = MenuItem::where('tenant_id', $tid)->findOrFail($item['menu_item_id']);
            $qty      = $item['quantity'];
            $order->items()->create([
                'menu_item_id' => $menuItem->id,
                'item_name'    => $menuItem->name,
                'item_price'   => $menuItem->price,
                'quantity'     => $qty,
                'subtotal'     => $menuItem->price * $qty,
                'notes'        => $item['notes'] ?? null,
            ]);
        }

        $order->load('items');
        $order->recalculate();
        broadcast(new OrderStatusUpdated($order->fresh()->load(['items', 'table'])))->toOthers();

        return $this->created([
            'order'   => $order->fresh()->load('items'),
            'booking' => $booking->load('room'),
        ]);
    }
}
