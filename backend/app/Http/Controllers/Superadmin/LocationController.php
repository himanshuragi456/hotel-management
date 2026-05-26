<?php

namespace App\Http\Controllers\Superadmin;

use App\Http\Controllers\Controller;
use App\Models\Location;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class LocationController extends Controller
{
    use ApiResponse;

    public function index(): JsonResponse
    {
        $locations = Location::orderBy('name')->get();
        return $this->success($locations);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name'       => 'required|string|max:100',
            'city'       => 'nullable|string|max:100',
            'state'      => 'nullable|string|max:100',
            'country'    => 'nullable|string|max:100',
            'is_active'  => 'boolean',
        ]);

        $location = Location::create($data);
        return $this->success($location, 201);
    }

    public function update(Request $request, Location $location): JsonResponse
    {
        $data = $request->validate([
            'name'       => 'required|string|max:100',
            'city'       => 'nullable|string|max:100',
            'state'      => 'nullable|string|max:100',
            'country'    => 'nullable|string|max:100',
            'is_active'  => 'boolean',
        ]);

        $location->update($data);
        return $this->success($location);
    }

    public function destroy(Location $location): JsonResponse
    {
        $location->delete();
        return $this->success(null);
    }
}
