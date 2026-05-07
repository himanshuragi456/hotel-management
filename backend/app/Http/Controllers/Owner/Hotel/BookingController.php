<?php

namespace App\Http\Controllers\Owner\Hotel;

use App\Http\Controllers\Controller;
use App\Models\Booking;
use App\Models\Room;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class BookingController extends Controller
{
    use ApiResponse;

    private function bookingData(Booking $booking): array
    {
        return array_merge($booking->toArray(), [
            'nights'          => $booking->nights,
            'room_charges'    => $booking->room_charges,
            'service_charges' => $booking->service_charges,
            'total_amount'    => $booking->total_amount,
            'balance_due'     => $booking->balance_due,
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
        ]);

        $tid  = $request->_tenant_id;
        $room = Room::where('tenant_id', $tid)->findOrFail($data['room_id']);

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
            'tenant_id'      => $tid,
            'created_by'     => auth()->id(),
            'price_per_night'=> $room->price_per_night,
        ]));

        $booking->load(['guest', 'room']);
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
            'check_in_date'          => 'sometimes|date',
            'check_out_date'         => 'sometimes|date|after:check_in_date',
            'adults'                 => 'nullable|integer|min:1',
            'children'               => 'nullable|integer|min:0',
            'notes'                  => 'nullable|string',
            'advance_paid'           => 'nullable|numeric|min:0',
            'advance_payment_method' => 'nullable|string',
        ]);

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

        return $this->success($this->bookingData($booking->fresh()->load(['guest', 'room'])), 'Checked in successfully');
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

        $byType = Booking::where('tenant_id', $tid)
            ->whereNotIn('status', ['cancelled'])
            ->whereBetween('check_in_date', [$from, $to])
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
}
