<?php

namespace App\Http\Controllers\Owner\Hotel;

use App\Http\Controllers\Controller;
use App\Models\Guest;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class GuestController extends Controller
{
    use ApiResponse;

    public function index(Request $request): JsonResponse
    {
        $q     = $request->query('q');
        $query = Guest::where('tenant_id', $request->_tenant_id)
            ->withCount('bookings')
            ->latest();

        if ($q) {
            $query->where(fn($w) => $w->where('name', 'like', "%$q%")->orWhere('phone', 'like', "%$q%"));
        }

        return $this->success($query->paginate(20));
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name'            => 'required|string|max:100',
            'phone'           => 'required|string|max:20',
            'email'           => 'nullable|email',
            'id_proof_type'   => 'nullable|in:aadhaar,passport,driving_license,voter_id,pan',
            'id_proof_number' => 'nullable|string|max:50',
            'company'         => 'nullable|string|max:100',
            'address'         => 'nullable|string',
            'notes'           => 'nullable|string',
        ]);

        $guest = Guest::create(array_merge($data, ['tenant_id' => $request->_tenant_id]));
        return $this->created($guest);
    }

    public function show(Request $request, Guest $guest): JsonResponse
    {
        if ($guest->tenant_id !== $request->_tenant_id) return $this->notFound();
        $guest->load(['bookings' => fn($q) => $q->with('room')->latest()->limit(10)]);
        return $this->success($guest);
    }

    public function update(Request $request, Guest $guest): JsonResponse
    {
        if ($guest->tenant_id !== $request->_tenant_id) return $this->notFound();

        $data = $request->validate([
            'name'            => 'sometimes|string|max:100',
            'phone'           => 'sometimes|string|max:20',
            'email'           => 'nullable|email',
            'id_proof_type'   => 'nullable|in:aadhaar,passport,driving_license,voter_id,pan',
            'id_proof_number' => 'nullable|string|max:50',
            'company'         => 'nullable|string|max:100',
            'address'         => 'nullable|string',
            'notes'           => 'nullable|string',
        ]);

        $guest->update($data);
        return $this->success($guest->fresh());
    }

    public function search(Request $request): JsonResponse
    {
        $q = $request->query('q', '');
        $guests = Guest::where('tenant_id', $request->_tenant_id)
            ->where(fn($w) => $w->where('name', 'like', "%$q%")->orWhere('phone', 'like', "%$q%"))
            ->limit(10)
            ->get(['id', 'name', 'phone', 'email', 'company']);
        return $this->success($guests);
    }
}
