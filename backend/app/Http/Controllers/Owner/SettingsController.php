<?php

namespace App\Http\Controllers\Owner;

use App\Http\Controllers\Controller;
use App\Models\Tenant;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SettingsController extends Controller
{
    use ApiResponse;

    public function show(): JsonResponse
    {
        $tenant = Tenant::findOrFail(auth()->user()->tenant_id);
        return $this->success([
            'qr_ordering_enabled' => $tenant->qr_ordering_enabled,
        ]);
    }

    public function update(Request $request): JsonResponse
    {
        $tenant = Tenant::findOrFail(auth()->user()->tenant_id);
        $request->validate([
            'qr_ordering_enabled' => 'required|boolean',
        ]);
        $tenant->update($request->only(['qr_ordering_enabled']));
        return $this->success([
            'qr_ordering_enabled' => $tenant->qr_ordering_enabled,
        ], 'Settings updated');
    }
}
