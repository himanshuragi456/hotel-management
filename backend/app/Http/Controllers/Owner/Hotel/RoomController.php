<?php

namespace App\Http\Controllers\Owner\Hotel;

use App\Http\Controllers\Controller;
use App\Models\Room;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use SimpleSoftwareIO\QrCode\Facades\QrCode;

class RoomController extends Controller
{
    use ApiResponse;

    public function index(Request $request): JsonResponse
    {
        $tid = $request->_tenant_id;
        $rooms = Room::where('tenant_id', $tid)
            ->withCount(['bookings as active_booking_count' => fn($q) => $q->where('status', 'checked_in')])
            ->with('activeBooking.guest')
            ->orderBy('floor')
            ->orderBy('number')
            ->get()
            ->map(fn($room) => array_merge($room->toArray(), [
                'occupied_minutes' => $room->occupied_minutes,
            ]));

        return $this->success($rooms);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'number'         => 'required|string|max:20',
            'type'           => 'required|in:single,double,triple,suite,deluxe',
            'floor'          => 'nullable|integer',
            'capacity'       => 'nullable|integer|min:1',
            'price_per_night'=> 'required|numeric|min:0',
            'amenities'      => 'nullable|array',
            'description'    => 'nullable|string',
        ]);

        $exists = Room::where('tenant_id', $request->_tenant_id)->where('number', $data['number'])->exists();
        if ($exists) {
            return $this->error('Room number already exists', 422);
        }

        $room = Room::create(array_merge($data, ['tenant_id' => $request->_tenant_id]));
        return $this->created($room);
    }

    public function show(Request $request, Room $room): JsonResponse
    {
        if ($room->tenant_id !== $request->_tenant_id) return $this->notFound();
        $room->load('activeBooking.guest');
        return $this->success(array_merge($room->toArray(), ['occupied_minutes' => $room->occupied_minutes]));
    }

    public function update(Request $request, Room $room): JsonResponse
    {
        if ($room->tenant_id !== $request->_tenant_id) return $this->notFound();

        $data = $request->validate([
            'number'         => 'sometimes|string|max:20',
            'type'           => 'sometimes|in:single,double,triple,suite,deluxe',
            'floor'          => 'nullable|integer',
            'capacity'       => 'nullable|integer|min:1',
            'price_per_night'=> 'sometimes|numeric|min:0',
            'amenities'      => 'nullable|array',
            'description'    => 'nullable|string',
            'status'         => 'sometimes|in:available,occupied,cleaning,maintenance',
        ]);

        $room->update($data);
        return $this->success($room->fresh());
    }

    public function destroy(Request $request, Room $room): JsonResponse
    {
        if ($room->tenant_id !== $request->_tenant_id) return $this->notFound();
        if ($room->status === 'occupied') {
            return $this->error('Cannot delete an occupied room', 422);
        }
        $room->delete();
        return $this->success(null, 'Room deleted');
    }

    public function statusBoard(Request $request): JsonResponse
    {
        $tid = $request->_tenant_id;
        $stats = [
            'available'   => Room::where('tenant_id', $tid)->where('status', 'available')->count(),
            'occupied'    => Room::where('tenant_id', $tid)->where('status', 'occupied')->count(),
            'cleaning'    => Room::where('tenant_id', $tid)->where('status', 'cleaning')->count(),
            'maintenance' => Room::where('tenant_id', $tid)->where('status', 'maintenance')->count(),
        ];
        return $this->success($stats);
    }
}
