<?php

namespace App\Http\Controllers\Owner\Hotel;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Booking;
use App\Models\Room;
use App\Traits\ApiResponse;
use Barryvdh\DomPDF\Facade\Pdf;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class BookingController extends Controller
{
    use ApiResponse;

    private function bookingData(Booking $booking): array
    {
        return array_merge($booking->toArray(), [
            'nights'               => $booking->nights,
            'room_charges'         => $booking->room_charges,
            'room_gst_amount'      => $booking->room_gst_amount,
            'computed_room_total'  => $booking->computed_room_total,
            'service_charges'      => $booking->service_charges,
            'total_amount'         => $booking->total_amount,
            'balance_due'          => $booking->balance_due,
            'is_overdue'      => $booking->status === 'checked_in'
                                 && now()->startOfDay()->gt(\Carbon\Carbon::parse($booking->check_out_date)->startOfDay()),
        ]);
    }

    public function index(Request $request): JsonResponse
    {
        $status = $request->query('status');
        $from   = $request->query('from');
        $to     = $request->query('to');

        $query = Booking::where('tenant_id', $request->_tenant_id)
            ->with(['guest', 'room'])
            ->latest();

        if ($status) $query->where('status', $status);
        if ($from)   $query->whereDate('check_in_date', '>=', $from);
        if ($to)     $query->whereDate('check_out_date', '<=', $to);

        $bookings = $query->paginate(20);
        $items    = $bookings->getCollection()->map(fn($b) => $this->bookingData($b));
        $bookings->setCollection($items);

        return $this->success($bookings);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'guest_id'               => 'required|exists:guests,id',
            'room_id'                => 'required|exists:rooms,id',
            'check_in_date'          => 'required|date|after_or_equal:today',
            'check_out_date'         => 'required|date|after:check_in_date',
            'adults'                 => 'nullable|integer|min:1',
            'children'               => 'nullable|integer|min:0',
            'advance_paid'           => 'nullable|numeric|min:0',
            'advance_payment_method' => 'nullable|string',
            'notes'                  => 'nullable|string',
            'decided_amount'         => 'nullable|numeric|min:0',
        ]);

        $tid    = $request->_tenant_id;
        $tenant = \App\Models\Tenant::findOrFail($tid);
        $room   = Room::where('tenant_id', $tid)->findOrFail($data['room_id']);

        // Check for conflicting bookings
        $conflict = Booking::where('room_id', $data['room_id'])
            ->whereNotIn('status', ['cancelled', 'checked_out'])
            ->where(fn($q) =>
                $q->whereBetween('check_in_date', [$data['check_in_date'], $data['check_out_date']])
                  ->orWhereBetween('check_out_date', [$data['check_in_date'], $data['check_out_date']])
                  ->orWhere(fn($q2) =>
                      $q2->where('check_in_date', '<=', $data['check_in_date'])
                         ->where('check_out_date', '>=', $data['check_out_date'])
                  )
            )->exists();

        if ($conflict) {
            return $this->error('Room is already booked for these dates', 422);
        }

        $booking = Booking::create(array_merge($data, [
            'tenant_id'       => $tid,
            'created_by'      => auth()->id(),
            'price_per_night' => $room->price_per_night,
            'gst_rate'        => (float) ($tenant->hotel_gst_rate ?? 0),
            'gst_inclusive'   => (bool)  ($tenant->hotel_gst_inclusive ?? false),
            'advance_paid'    => $data['advance_paid'] ?? 0,
            'adults'          => $data['adults'] ?? 1,
            'children'        => $data['children'] ?? 0,
        ]));

        $booking->load(['guest', 'room']);
        AuditLog::record('booking.created', $booking, [], [
            'booking_number' => $booking->booking_number,
            'guest'          => $booking->guest?->name,
            'room'           => 'Room ' . $booking->room?->number,
            'check_in'       => $booking->check_in_date,
            'check_out'      => $booking->check_out_date,
        ]);
        return $this->created($this->bookingData($booking));
    }

    public function show(Request $request, Booking $booking): JsonResponse
    {
        if ($booking->tenant_id !== $request->_tenant_id) return $this->notFound();
        $booking->load(['guest', 'room', 'orders.items']);
        return $this->success($this->bookingData($booking));
    }

    public function update(Request $request, Booking $booking): JsonResponse
    {
        if ($booking->tenant_id !== $request->_tenant_id) return $this->notFound();
        if (!in_array($booking->status, ['upcoming'])) {
            return $this->error('Only upcoming bookings can be edited', 422);
        }

        $data = $request->validate([
            'room_id'                => 'sometimes|exists:rooms,id',
            'check_in_date'          => 'sometimes|date',
            'check_out_date'         => 'sometimes|date|after:check_in_date',
            'adults'                 => 'nullable|integer|min:1',
            'children'               => 'nullable|integer|min:0',
            'notes'                  => 'nullable|string',
            'advance_paid'           => 'nullable|numeric|min:0',
            'advance_payment_method' => 'nullable|string',
            'decided_amount'         => 'nullable|numeric|min:0',
            'guest_name'             => 'sometimes|string|max:255',
            'guest_phone'            => 'sometimes|string|max:20',
        ]);

        // Update guest name/phone if provided
        if (isset($data['guest_name']) || isset($data['guest_phone'])) {
            $guestData = array_filter([
                'name'  => $data['guest_name']  ?? null,
                'phone' => $data['guest_phone'] ?? null,
            ]);
            $booking->guest?->update($guestData);
        }
        unset($data['guest_name'], $data['guest_phone']);

        // If room changed, recalculate price_per_night
        if (isset($data['room_id']) && $data['room_id'] != $booking->room_id) {
            $room = \App\Models\Room::where('id', $data['room_id'])
                ->where('tenant_id', $request->_tenant_id)
                ->firstOrFail();
            $data['price_per_night'] = $room->price_per_night;
        }

        $booking->update($data);
        return $this->success($this->bookingData($booking->fresh()->load(['guest', 'room'])));
    }

    public function checkIn(Request $request, Booking $booking): JsonResponse
    {
        if ($booking->tenant_id !== $request->_tenant_id) return $this->notFound();
        if ($booking->status !== 'upcoming') {
            return $this->error('Booking is not in upcoming status', 422);
        }

        $booking->update([
            'status'          => 'checked_in',
            'actual_check_in' => now(),
        ]);
        $booking->room->occupy();
        AuditLog::record('booking.checked_in', $booking, ['status' => 'upcoming'], [
            'booking_number' => $booking->booking_number,
            'guest'          => $booking->guest?->name,
            'room'           => 'Room ' . $booking->room?->number,
        ]);

        return $this->success($this->bookingData($booking->fresh()->load(['guest', 'room'])), 'Checked in successfully');
    }

    public function checkoutSummary(Request $request, Booking $booking): JsonResponse
    {
        if ($booking->tenant_id !== $request->_tenant_id) return $this->notFound();

        $booking->load(['guest', 'room']);

        $unbilledOrders = $booking->orders()
            ->whereNotIn('status', ['cancelled'])
            ->whereDoesntHave('invoice')
            ->with('items')
            ->orderBy('created_at')
            ->get();

        // Group by date so the frontend can render a timeline per day
        $byDate = $unbilledOrders->groupBy(fn($o) => Carbon::parse($o->created_at)->toDateString())
            ->map(fn($orders, $date) => [
                'date'   => $date,
                'orders' => $orders->map(fn($o) => [
                    'id'           => $o->id,
                    'order_number' => $o->order_number,
                    'status'       => $o->status,
                    'total'        => $o->total,
                    'items'        => $o->items->map(fn($i) => [
                        'name'      => $i->item_name,
                        'quantity'  => $i->quantity,
                        'price'     => $i->item_price,
                        'subtotal'  => $i->subtotal,
                    ]),
                ]),
                'day_total' => $orders->sum('total'),
            ])->values();

        return $this->success(array_merge($this->bookingData($booking), [
            'unbilled_orders'       => $unbilledOrders,
            'unbilled_orders_by_date' => $byDate,
            'unbilled_food_total'   => $unbilledOrders->sum('total'),
        ]));
    }

    public function extendStay(Request $request, Booking $booking): JsonResponse
    {
        if ($booking->tenant_id !== $request->_tenant_id) return $this->notFound();
        if ($booking->status !== 'checked_in') {
            return $this->error('Can only extend an active check-in', 422);
        }

        $data = $request->validate([
            'check_out_date' => 'required|date|after:' . $booking->check_in_date . '|after_or_equal:today',
        ]);

        $booking->update(['check_out_date' => $data['check_out_date']]);

        return $this->success(
            $this->bookingData($booking->fresh()->load(['guest', 'room'])),
            'Stay extended successfully'
        );
    }

    public function checkOut(Request $request, Booking $booking): JsonResponse
    {
        if ($booking->tenant_id !== $request->_tenant_id) return $this->notFound();
        if ($booking->status !== 'checked_in') {
            return $this->error('Guest is not currently checked in', 422);
        }

        $data = $request->validate([
            'payment_method' => 'required|string',
            'extra_paid'     => 'nullable|numeric|min:0',
        ]);

        $extraPaid = (float) ($data['extra_paid'] ?? 0);

        $booking->update([
            'status'           => 'checked_out',
            'actual_check_out' => now(),
            'payment_status'   => ($booking->advance_paid + $extraPaid) >= $booking->total_amount ? 'paid' : 'partial',
            'advance_paid'     => $booking->advance_paid + $extraPaid,
        ]);
        $booking->room->free();
        AuditLog::record('booking.checked_out', $booking, ['status' => 'checked_in'], [
            'booking_number' => $booking->booking_number,
            'guest'          => $booking->guest?->name,
            'room'           => 'Room ' . $booking->room?->number,
            'total_amount'   => $booking->total_amount,
            'payment_method' => $data['payment_method'],
        ]);

        return $this->success($this->bookingData($booking->fresh()->load(['guest', 'room'])), 'Checked out successfully');
    }

    public function cancel(Request $request, Booking $booking): JsonResponse
    {
        if ($booking->tenant_id !== $request->_tenant_id) return $this->notFound();
        if ($booking->status === 'checked_out') {
            return $this->error('Cannot cancel a checked-out booking', 422);
        }

        if ($booking->status === 'checked_in') {
            $booking->room->free();
        }
        $booking->update(['status' => 'cancelled']);
        AuditLog::record('booking.cancelled', $booking, [], [
            'booking_number' => $booking->booking_number,
            'guest'          => $booking->guest?->name,
            'room'           => 'Room ' . $booking->room?->number,
        ]);

        return $this->success(null, 'Booking cancelled');
    }

    public function calendar(Request $request): JsonResponse
    {
        $from = $request->query('from', now()->startOfMonth()->toDateString());
        $to   = $request->query('to',   now()->endOfMonth()->toDateString());

        $bookings = Booking::where('tenant_id', $request->_tenant_id)
            ->whereNotIn('status', ['cancelled'])
            ->whereBetween('check_in_date', [$from, $to])
            ->orWhereBetween('check_out_date', [$from, $to])
            ->with(['guest:id,name,phone', 'room:id,number,type,floor'])
            ->get()
            ->map(fn($b) => [
                'id'             => $b->id,
                'booking_number' => $b->booking_number,
                'guest'          => $b->guest,
                'room'           => $b->room,
                'check_in_date'  => $b->check_in_date->toDateString(),
                'check_out_date' => $b->check_out_date->toDateString(),
                'status'         => $b->status,
                'nights'         => $b->nights,
                'total_amount'   => $b->total_amount,
            ]);

        return $this->success($bookings);
    }

    public function occupancyReport(Request $request): JsonResponse
    {
        $tid  = $request->_tenant_id;
        $from = $request->query('from', now()->subDays(30)->toDateString());
        $to   = $request->query('to', now()->toDateString());

        $totalRooms = Room::where('tenant_id', $tid)->count();

        $bookings = Booking::where('tenant_id', $tid)
            ->whereNotIn('status', ['cancelled'])
            ->whereBetween('check_in_date', [$from, $to])
            ->get();

        $revenue = $bookings->sum('room_charges');
        $nights  = $bookings->sum('nights');

        $byType = Booking::where('bookings.tenant_id', $tid)
            ->whereNotIn('bookings.status', ['cancelled'])
            ->whereBetween('bookings.check_in_date', [$from, $to])
            ->join('rooms', 'bookings.room_id', '=', 'rooms.id')
            ->selectRaw('rooms.type, count(*) as bookings, sum(bookings.price_per_night * DATEDIFF(bookings.check_out_date, bookings.check_in_date)) as revenue')
            ->groupBy('rooms.type')
            ->get();

        return $this->success([
            'total_rooms'    => $totalRooms,
            'total_bookings' => $bookings->count(),
            'total_nights'   => $nights,
            'total_revenue'  => $revenue,
            'by_type'        => $byType,
            'from'           => $from,
            'to'             => $to,
        ]);
    }

    public function recentCheckouts(Request $request): JsonResponse
    {
        $bookings = Booking::where('tenant_id', $request->_tenant_id)
            ->whereIn('status', ['checked_in', 'checked_out'])
            ->with(['guest:id,name,phone', 'room:id,number,type'])
            ->latest('updated_at')
            ->limit(30)
            ->get()
            ->map(fn($b) => [
                'id'              => $b->id,
                'booking_number'  => $b->booking_number,
                'status'          => $b->status,
                'guest_name'      => $b->guest?->name,
                'room_number'     => $b->room?->number,
                'room_type'       => $b->room?->type,
                'check_in_date'   => $b->check_in_date,
                'check_out_date'  => $b->check_out_date,
                'actual_check_out'=> $b->actual_check_out,
                'total_amount'    => $b->total_amount,
                'advance_paid'    => $b->advance_paid,
            ]);

        return $this->success($bookings);
    }

    public function printBill(Request $request, Booking $booking): mixed
    {
        if ($booking->tenant_id !== $request->_tenant_id) return $this->notFound();

        $booking->load(['guest', 'room', 'orders.items']);
        $tenant = \App\Models\Tenant::findOrFail($booking->tenant_id);

        $serviceOrders = $booking->orders()
            ->whereNotIn('status', ['cancelled'])
            ->with('items')
            ->orderBy('created_at')
            ->get();

        $byDate = $serviceOrders->groupBy(fn($o) => Carbon::parse($o->created_at)->toDateString());

        $nights       = $booking->nights;
        $roomCharges  = $booking->room_charges;
        $gstRate      = (float) ($booking->gst_rate ?? 0);
        $gstInclusive = (bool)  ($booking->gst_inclusive ?? false);
        $roomGst      = $booking->room_gst_amount;
        $roomTotal    = $booking->computed_room_total;

        if ($booking->decided_amount !== null) {
            $roomCharges  = (float) $booking->decided_amount;
            $roomGst      = $booking->decided_gst_amount;
            $roomTotal    = $gstInclusive ? $roomCharges : $roomCharges + $roomGst;
        }

        $serviceCharges = (float) $serviceOrders->sum('total');
        $totalAmount    = $roomTotal + $serviceCharges;
        $advancePaid    = (float) ($booking->advance_paid ?? 0);
        $paymentMethod  = $request->query('payment_method');
        $decidedAmount  = $booking->decided_amount !== null ? (float) $booking->decided_amount : null;

        $pdf = Pdf::loadView('hotel.bill', compact(
            'booking', 'tenant', 'serviceOrders', 'byDate',
            'nights', 'roomCharges', 'gstRate', 'gstInclusive',
            'roomGst', 'roomTotal', 'serviceCharges', 'totalAmount',
            'advancePaid', 'paymentMethod', 'decidedAmount'
        ))->setPaper([0, 0, 226.77, 700], 'portrait');

        return $pdf->download("hotel-bill-{$booking->booking_number}.pdf");
    }
}
