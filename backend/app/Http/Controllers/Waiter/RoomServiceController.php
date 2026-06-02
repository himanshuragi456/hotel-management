<?php

namespace App\Http\Controllers\Waiter;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Booking;
use App\Models\MenuItem;
use App\Models\Order;
use App\Models\OrderItem;
use App\Events\OrderStatusUpdated;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class RoomServiceController extends Controller
{
    use ApiResponse;

    public function activeRooms(Request $request): JsonResponse
    {
        $bookings = Booking::where('tenant_id', $request->_tenant_id)
            ->where('status', 'checked_in')
            ->with(['guest:id,name,phone', 'room:id,number,type,floor'])
            ->get(['id', 'booking_number', 'guest_id', 'room_id', 'status',
                   'check_in_date', 'check_out_date', 'actual_check_in',
                   'price_per_night', 'advance_paid', 'adults', 'children', 'notes']);

        return $this->success($bookings);
    }

    public function placeOrder(Request $request): JsonResponse
    {
        $data = $request->validate([
            'booking_id' => 'required|exists:bookings,id',
            'waiter_id'  => 'nullable|exists:users,id',
            'notes'      => 'nullable|string',
            'items'      => 'required|array|min:1',
            'items.*.menu_item_id' => 'required|exists:menu_items,id',
            'items.*.quantity'     => 'required|integer|min:1',
            'items.*.notes'        => 'nullable|string',
        ]);

        $tid     = $request->_tenant_id;
        $booking = Booking::where('tenant_id', $tid)->where('status', 'checked_in')->findOrFail($data['booking_id']);

        $resolvedItems = collect($data['items'])->map(function ($row) use ($tid) {
            $menuItem = MenuItem::where('tenant_id', $tid)->findOrFail($row['menu_item_id']);
            return array_merge($row, ['menu_item' => $menuItem]);
        });

        $kitchenItems   = $resolvedItems->filter(fn($r) => ! $r['menu_item']->is_ready_made);
        $readyMadeItems = $resolvedItems->filter(fn($r) =>   $r['menu_item']->is_ready_made);

        $baseFields = [
            'tenant_id'  => $tid,
            'room_id'    => $booking->room_id,
            'booking_id' => $booking->id,
            'waiter_id'  => $data['waiter_id'] ?? (auth()->check() ? auth()->id() : null),
            'type'       => 'room-service',
            'notes'      => $data['notes'] ?? null,
        ];

        DB::beginTransaction();
        try {
            $createdOrders = [];

            if ($kitchenItems->isNotEmpty()) {
                $order = Order::create(array_merge($baseFields, ['status' => 'pending']));
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
                $createdOrders[] = $order->fresh()->load(['items', 'table']);
            }

            if ($readyMadeItems->isNotEmpty()) {
                $rmOrder = Order::create(array_merge($baseFields, ['status' => 'ready']));
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
                $createdOrders[] = $rmOrder->fresh()->load(['items', 'table']);
            }

            DB::commit();

            foreach ($createdOrders as $o) {
                try { broadcast(new OrderStatusUpdated($o))->toOthers(); } catch (\Exception $e) {}
                AuditLog::record('order.room_service_placed', $o, [], [
                    'order_number' => $o->order_number,
                    'room'         => 'Room ' . $booking->room?->number,
                    'guest'        => $booking->guest?->name,
                    'items'        => $o->items->map(fn($i) => $i->quantity . '× ' . $i->item_name)->implode(', '),
                    'total'        => $o->total,
                ]);
            }

            return $this->created([
                'orders'  => $createdOrders,
                'booking' => $booking->load('room'),
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            return $this->error('Failed to place order: ' . $e->getMessage(), 500);
        }
    }
}
