<?php

namespace App\Http\Middleware;

use App\Models\TenantModule;
use App\Traits\ApiResponse;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class CheckModule
{
    use ApiResponse;

    public function handle(Request $request, Closure $next, string $module): Response
    {
        $user = auth()->user();

        if ($user->role === 'superadmin') {
            return $next($request);
        }

        $modules = TenantModule::where('tenant_id', $user->tenant_id)->first();

        if (! $modules || ! $modules->{$module}) {
            return $this->forbidden("The {$module} module is not enabled for your account")->prepare($request);
        }

        return $next($request);
    }
}
