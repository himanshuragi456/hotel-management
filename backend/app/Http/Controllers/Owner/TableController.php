<?php

namespace App\Http\Controllers\Owner;

use App\Http\Controllers\Controller;
use App\Models\RestaurantTable;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use SimpleSoftwareIO\QrCode\Facades\QrCode;

class TableController extends Controller
{
    use ApiResponse;

    public function index(): JsonResponse
    {
        $tenant  = auth()->user()->tenant;
        $baseUrl = config('app.frontend_url', config('app.url'));

        $tables = RestaurantTable::where('tenant_id', auth()->user()->tenant_id)
            ->with('activeOrder.items')
            ->orderBy('number')
            ->get()
            ->map(function ($table) use ($tenant, $baseUrl) {
                $data = $table->toArray();
                $data['occupied_minutes'] = $table->occupied_since
                    ? (int) abs(now()->diffInMinutes($table->occupied_since))
                    : null;
                $data['menu_url'] = "{$baseUrl}/menu/{$tenant->slug}/{$table->qr_token}";
                return $data;
            });
        return $this->success($tables);
    }

    public function store(Request $request): JsonResponse
    {
        $v = Validator::make($request->all(), [
            'number'   => 'required|string|max:20',
            'capacity' => 'integer|min:1',
            'section'  => 'nullable|string|max:50',
        ]);
        if ($v->fails()) return $this->validationError($v->errors());

        $exists = RestaurantTable::where('tenant_id', auth()->user()->tenant_id)
            ->where('number', $request->number)->exists();
        if ($exists) return $this->error('Table number already exists');

        $table = RestaurantTable::create([
            'tenant_id' => auth()->user()->tenant_id,
            'number'    => $request->number,
            'capacity'  => $request->capacity ?? 4,
            'section'   => $request->section,
        ]);
        return $this->created($table);
    }

    public function update(Request $request, RestaurantTable $restaurantTable): JsonResponse
    {
        if ($restaurantTable->tenant_id !== auth()->user()->tenant_id) return $this->forbidden();
        $v = Validator::make($request->all(), [
            'number'   => 'sometimes|string|max:20',
            'capacity' => 'integer|min:1',
            'section'  => 'nullable|string|max:50',
        ]);
        if ($v->fails()) return $this->validationError($v->errors());
        $restaurantTable->update($request->only(['number', 'capacity', 'section']));
        return $this->success($restaurantTable);
    }

    public function destroy(RestaurantTable $restaurantTable): JsonResponse
    {
        if ($restaurantTable->tenant_id !== auth()->user()->tenant_id) return $this->forbidden();
        $restaurantTable->delete();
        return $this->success(null, 'Table deleted');
    }

    public function qrCode(RestaurantTable $restaurantTable): mixed
    {
        if ($restaurantTable->tenant_id !== auth()->user()->tenant_id) return $this->forbidden();

        $tenant = auth()->user()->tenant;
        $url = config('app.frontend_url', config('app.url')) . "/menu/{$tenant->slug}/{$restaurantTable->qr_token}";

        return response(
            QrCode::format('svg')->size(300)->generate($url),
            200,
            ['Content-Type' => 'image/svg+xml']
        );
    }
}
