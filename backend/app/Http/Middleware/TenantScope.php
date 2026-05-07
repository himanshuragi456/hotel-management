<?php

namespace App\Http\Middleware;

use App\Traits\ApiResponse;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class TenantScope
{
    use ApiResponse;

    public function handle(Request $request, Closure $next): Response
    {
        $user = auth()->user();

        if (! $user) {
            return $this->unauthorized()->prepare($request);
        }

        // Superadmin bypasses tenant scoping
        if ($user->role === 'superadmin') {
            return $next($request);
        }

        if (! $user->tenant_id) {
            return $this->forbidden('No tenant associated with this account')->prepare($request);
        }

        // Bind tenant_id to request for easy access in controllers
        $request->merge(['_tenant_id' => $user->tenant_id]);

        return $next($request);
    }
}
