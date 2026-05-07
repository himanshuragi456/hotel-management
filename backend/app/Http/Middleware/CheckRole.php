<?php

namespace App\Http\Middleware;

use App\Traits\ApiResponse;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class CheckRole
{
    use ApiResponse;

    public function handle(Request $request, Closure $next, string ...$roles): Response
    {
        $user = auth()->user();

        if (! $user) {
            return $this->unauthorized()->prepare($request);
        }

        if (! in_array($user->role, $roles)) {
            return $this->forbidden('You do not have permission to access this resource')->prepare($request);
        }

        return $next($request);
    }
}
