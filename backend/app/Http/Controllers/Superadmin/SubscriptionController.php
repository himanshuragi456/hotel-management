<?php

namespace App\Http\Controllers\Superadmin;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Subscription;
use App\Models\Tenant;
use App\Models\TenantModule;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class SubscriptionController extends Controller
{
    use ApiResponse;

    public function index(Request $request): JsonResponse
    {
        $query = Subscription::with(['tenant', 'plan'])
            ->latest();

        if ($request->status) {
            $query->where('status', $request->status);
        }

        if ($request->tenant_id) {
            $query->where('tenant_id', $request->tenant_id);
        }

        $subscriptions = $query->paginate(20);

        return $this->success($subscriptions);
    }

    public function assignPlan(Request $request, Tenant $tenant): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'subscription_plan_id' => 'required|exists:subscription_plans,id',
            'billing_cycle'        => 'required|in:monthly,yearly',
            'payment_gateway'      => 'required|in:stripe,razorpay,manual',
        ]);

        if ($validator->fails()) {
            return $this->validationError($validator->errors());
        }

        $plan = \App\Models\SubscriptionPlan::findOrFail($request->subscription_plan_id);
        $amount = $request->billing_cycle === 'yearly' ? $plan->price_yearly : $plan->price_monthly;

        // Cancel existing active subscription
        Subscription::where('tenant_id', $tenant->id)
            ->whereIn('status', ['active', 'trial'])
            ->update(['status' => 'cancelled', 'cancelled_at' => now()]);

        $subscription = Subscription::create([
            'tenant_id'            => $tenant->id,
            'subscription_plan_id' => $plan->id,
            'billing_cycle'        => $request->billing_cycle,
            'status'               => 'active',
            'payment_gateway'      => $request->payment_gateway,
            'amount'               => $amount,
            'current_period_start' => now(),
            'current_period_end'   => $request->billing_cycle === 'yearly'
                ? now()->addYear()
                : now()->addMonth(),
        ]);

        // Sync modules based on plan
        TenantModule::updateOrCreate(
            ['tenant_id' => $tenant->id],
            [
                'restaurant' => $plan->module_restaurant,
                'hotel'      => $plan->module_hotel,
                'feedback'   => $plan->module_feedback,
            ]
        );

        $tenant->update(['status' => 'active']);

        AuditLog::record('subscription.assigned', $subscription, [], $subscription->toArray());

        return $this->created($subscription->load('plan'), 'Plan assigned successfully');
    }

    public function extend(Request $request, Subscription $subscription): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'days'   => 'required_without:months|integer|min:1',
            'months' => 'required_without:days|integer|min:1',
        ]);

        if ($validator->fails()) {
            return $this->validationError($validator->errors());
        }

        $end = $subscription->current_period_end ?? now();
        $newEnd = $request->months
            ? $end->addMonths($request->months)
            : $end->addDays($request->days);

        $old = $subscription->toArray();
        $subscription->update([
            'current_period_end' => $newEnd,
            'status'             => 'active',
        ]);

        AuditLog::record('subscription.extended', $subscription, $old, $subscription->fresh()->toArray());

        return $this->success($subscription->fresh()->load('plan'), 'Subscription extended');
    }

    public function cancel(Subscription $subscription): JsonResponse
    {
        $old = $subscription->toArray();
        $subscription->update(['status' => 'cancelled', 'cancelled_at' => now()]);
        $subscription->tenant->update(['status' => 'suspended']);

        AuditLog::record('subscription.cancelled', $subscription, $old, []);

        return $this->success(null, 'Subscription cancelled');
    }
}
