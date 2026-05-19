<?php

namespace App\Http\Controllers\Superadmin;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\SubscriptionPlan;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\Validator;

class SubscriptionPlanController extends Controller
{
    use ApiResponse;

    public function index(): JsonResponse
    {
        $plans = SubscriptionPlan::orderBy('price_monthly')->get();
        return $this->success($plans);
    }

    public function store(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'name'               => 'required|string|max:255',
            'description'        => 'nullable|string',
            'price_monthly'      => 'required|numeric|min:0',
            'price_yearly'       => 'required|numeric|min:0',
            'module_restaurant'  => 'boolean',
            'module_hotel'       => 'boolean',
            'module_feedback'    => 'boolean',
            'max_users'          => 'integer|min:1',
            'max_tables'         => 'integer|min:0',
            'max_rooms'          => 'integer|min:0',
            'features'           => 'nullable|array',
        ]);

        if ($validator->fails()) {
            return $this->validationError($validator->errors());
        }

        $plan = SubscriptionPlan::create([
            ...$request->only([
                'name', 'description', 'price_monthly', 'price_yearly',
                'module_restaurant', 'module_hotel', 'module_feedback',
                'max_users', 'max_tables', 'max_rooms', 'features',
            ]),
            'slug' => Str::slug($request->name) . '-' . Str::random(4),
        ]);

        AuditLog::record('plan.created', $plan, [], $plan->toArray());

        return $this->created($plan);
    }

    public function show(SubscriptionPlan $plan): JsonResponse
    {
        return $this->success($plan);
    }

    public function update(Request $request, SubscriptionPlan $plan): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'name'               => 'sometimes|string|max:255',
            'description'        => 'nullable|string',
            'price_monthly'      => 'sometimes|numeric|min:0',
            'price_yearly'       => 'sometimes|numeric|min:0',
            'module_restaurant'  => 'boolean',
            'module_hotel'       => 'boolean',
            'module_feedback'    => 'boolean',
            'max_users'          => 'sometimes|integer|min:1',
            'max_tables'         => 'sometimes|integer|min:0',
            'max_rooms'          => 'sometimes|integer|min:0',
            'is_active'          => 'boolean',
            'features'           => 'nullable|array',
        ]);

        if ($validator->fails()) {
            return $this->validationError($validator->errors());
        }

        $old = $plan->toArray();
        $plan->update($request->only([
            'name', 'description', 'price_monthly', 'price_yearly',
            'module_restaurant', 'module_hotel', 'module_feedback',
            'max_users', 'max_tables', 'max_rooms', 'is_active', 'features',
        ]));

        AuditLog::record('plan.updated', $plan, $old, $plan->fresh()->toArray());

        return $this->success($plan->fresh());
    }

    public function destroy(SubscriptionPlan $plan): JsonResponse
    {
        if ($plan->subscriptions()->exists()) {
            return $this->error('Cannot delete a plan with active subscriptions', 422);
        }

        AuditLog::record('plan.deleted', $plan, $plan->toArray(), []);
        $plan->delete();

        return $this->success(null, 'Plan deleted');
    }
}
