<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Tymon\JWTAuth\Facades\JWTAuth;

class AuthController extends Controller
{
    use ApiResponse;

    public function login(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'email'    => 'required|email',
            'password' => 'required|string',
        ]);

        if ($validator->fails()) {
            return $this->validationError($validator->errors());
        }

        $credentials = $request->only('email', 'password');

        if (! $token = auth()->attempt($credentials)) {
            return $this->unauthorized('Invalid credentials');
        }

        $user = auth()->user();

        if (! $user->is_active) {
            auth()->logout();
            return $this->forbidden('Your account has been deactivated');
        }

        // Check if tenant is suspended (non-superadmin only)
        if ($user->tenant_id && $user->role !== 'superadmin') {
            $tenant = $user->tenant;
            if ($tenant && $tenant->status === 'suspended') {
                auth()->logout();
                $branding = \App\Models\SystemSetting::allAsMap();
                $logo = $branding['brand_logo'] ?? null;
                return response()->json([
                    'success'  => false,
                    'message'  => 'subscription_expired',
                    'branding' => [
                        'brand_name'        => $branding['brand_name'] ?? null,
                        'brand_logo'        => $logo,
                        'brand_logo_url'    => $logo ? asset('storage/' . $logo) : null,
                        'contact_phone'     => $branding['contact_phone'] ?? null,
                        'contact_whatsapp'  => $branding['contact_whatsapp'] ?? null,
                        'contact_email'     => $branding['contact_email'] ?? null,
                        'sales_tagline'     => $branding['sales_tagline'] ?? null,
                    ],
                ], 402);
            }
        }

        return $this->respondWithToken($token, $user);
    }

    public function me(): JsonResponse
    {
        $user = auth()->user()->load('tenant');
        return $this->success([
            'id'                 => $user->id,
            'name'               => $user->name,
            'email'              => $user->email,
            'role'               => $user->role,
            'tenant_id'          => $user->tenant_id,
            'phone'              => $user->phone,
            'modules'            => $user->tenant_id ? $this->getModules($user->tenant_id) : null,
            'subscription_alert' => $user->tenant_id ? $this->getSubscriptionAlert($user->tenant) : null,
        ]);
    }

    public function logout(): JsonResponse
    {
        auth()->logout();
        return $this->success(null, 'Logged out successfully');
    }

    public function loginAs(Request $request): JsonResponse
    {
        $tenantId = $request->input('tenant_id');
        $owner = User::where('tenant_id', $tenantId)->where('role', 'owner')->first();

        if (! $owner) {
            return $this->notFound('No owner found for this tenant');
        }

        $token = JWTAuth::fromUser($owner);
        return $this->respondWithToken($token, $owner);
    }

    public function refresh(): JsonResponse
    {
        try {
            $token = JWTAuth::parseToken()->refresh();
            return $this->respondWithToken($token, auth()->user());
        } catch (\Exception $e) {
            return $this->unauthorized('Token cannot be refreshed');
        }
    }

    private function respondWithToken(string $token, User $user): JsonResponse
    {
        $user->loadMissing('tenant');

        return $this->success([
            'access_token' => $token,
            'token_type'   => 'bearer',
            'expires_in'   => auth()->factory()->getTTL() * 60,
            'user'         => [
                'id'                 => $user->id,
                'name'               => $user->name,
                'email'              => $user->email,
                'role'               => $user->role,
                'tenant_id'          => $user->tenant_id,
                'phone'              => $user->phone,
                'modules'            => $user->tenant_id ? $this->getModules($user->tenant_id) : null,
                'subscription_alert' => $user->tenant_id ? $this->getSubscriptionAlert($user->tenant) : null,
            ],
        ]);
    }

    private function getModules(?int $tenantId): ?array
    {
        if (! $tenantId) return null;
        $m = \App\Models\TenantModule::where('tenant_id', $tenantId)->first();
        return $m ? [
            'restaurant' => (bool) $m->restaurant,
            'hotel'      => (bool) $m->hotel,
            'feedback'   => (bool) $m->feedback,
        ] : null;
    }

    private function getSubscriptionAlert(?\App\Models\Tenant $tenant): ?array
    {
        if (! $tenant) return null;

        $sub = \App\Models\Subscription::where('tenant_id', $tenant->id)
            ->orderByDesc('created_at')
            ->first();

        $now = now();

        $alert = null;

        // No subscription — trial based on tenant creation date
        if (! $sub) {
            $trialEnd = $tenant->created_at->addDays(7);
            $daysLeft = (int) $now->diffInDays($trialEnd, false);
            if ($daysLeft > 0) {
                $alert = ['type' => 'trial', 'days_left' => $daysLeft, 'expires_at' => $trialEnd->toDateString()];
            }
        } elseif ($sub->status === 'trial') {
            $trialEnd = $sub->trial_ends_at ?? $tenant->created_at->addDays(7);
            $daysLeft = (int) $now->diffInDays($trialEnd, false);
            if ($daysLeft > 0) {
                $alert = ['type' => 'trial', 'days_left' => $daysLeft, 'expires_at' => $trialEnd->toDateString()];
            }
        } elseif ($sub->status === 'active' && $sub->current_period_end) {
            $daysLeft = (int) $now->diffInDays($sub->current_period_end, false);
            if ($daysLeft <= 15 && $daysLeft > 0) {
                $alert = ['type' => 'expiring', 'days_left' => $daysLeft, 'expires_at' => $sub->current_period_end->toDateString()];
            }
        }

        if (! $alert) return null;

        // Attach branding so the frontend can show contact details without a separate API call
        $settings = \App\Models\SystemSetting::allAsMap();
        $alert['branding'] = [
            'brand_name'       => $settings['brand_name']       ?? null,
            'contact_phone'    => $settings['contact_phone']    ?? null,
            'contact_whatsapp' => $settings['contact_whatsapp'] ?? null,
            'contact_email'    => $settings['contact_email']    ?? null,
            'sales_tagline'    => $settings['sales_tagline']    ?? null,
        ];

        return $alert;
    }
}
