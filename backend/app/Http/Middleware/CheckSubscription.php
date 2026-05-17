<?php

namespace App\Http\Middleware;

use App\Models\SystemSetting;
use App\Models\Subscription;
use App\Traits\ApiResponse;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class CheckSubscription
{
    use ApiResponse;

    public function handle(Request $request, Closure $next): Response
    {
        $user = auth()->user();

        if (! $user || $user->role === 'superadmin') {
            return $next($request);
        }

        $tenant = $user->tenant;

        if (! $tenant) {
            return $this->forbidden('No tenant associated')->prepare($request);
        }

        // Check active subscription
        $subscription = Subscription::where('tenant_id', $tenant->id)
            ->orderByDesc('created_at')
            ->first();

        $expired = false;

        if (! $subscription) {
            // No subscription at all — check trial age (tenant created_at + 7 days)
            $trialEnd = $tenant->created_at->addDays(7);
            $expired = now()->gt($trialEnd);
        } elseif ($subscription->status === 'trial') {
            $trialEnd = $subscription->trial_ends_at ?? $tenant->created_at->addDays(7);
            $expired = now()->gt($trialEnd);
        } elseif (in_array($subscription->status, ['cancelled', 'expired', 'past_due'])) {
            $expired = true;
        } elseif ($subscription->status === 'active' && $subscription->current_period_end && now()->gt($subscription->current_period_end)) {
            // Active but period ended — mark expired
            $subscription->update(['status' => 'expired']);
            $tenant->update(['status' => 'suspended']);
            $expired = true;
        }

        if ($expired) {
            $keys = ['brand_name', 'contact_phone', 'contact_whatsapp', 'contact_email', 'sales_tagline', 'brand_logo'];
            $settings = SystemSetting::allAsMap();
            $branding = [];
            foreach ($keys as $key) {
                $branding[$key] = $settings[$key] ?? null;
            }
            if ($branding['brand_logo']) {
                $branding['brand_logo_url'] = asset('storage/' . $branding['brand_logo']);
            }

            return response()->json([
                'success' => false,
                'message' => 'subscription_expired',
                'branding' => $branding,
            ], 402);
        }

        return $next($request);
    }
}
