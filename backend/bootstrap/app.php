<?php

use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->alias([
            'role'                => \App\Http\Middleware\CheckRole::class,
            'tenant.scope'        => \App\Http\Middleware\TenantScope::class,
            'module'              => \App\Http\Middleware\CheckModule::class,
            'check.subscription'  => \App\Http\Middleware\CheckSubscription::class,
        ]);

        // API is JSON-only with no web `login` route. Return null for /api/* so
        // the auth middleware throws a clean AuthenticationException (→ JSON 401)
        // instead of trying to redirect to a non-existent named `login` route
        // (which 500s for requests that omit an Accept: application/json header).
        $middleware->redirectGuestsTo(
            fn (Request $request) => $request->is('api/*') ? null : '/login'
        );
    })
    ->booted(function (): void {
        /*
        | Named rate limiters. Applied per-route via `throttle:<name>` middleware.
        | Keyed by client IP for public endpoints (no auth user to key on).
        |   auth-login : brute-force protection on the login endpoint
        |   public     : public customer/QR POST actions (orders, feedback, calls)
        |   public-ai  : OpenAI-backed endpoint — tighter, each hit costs money
        */
        RateLimiter::for('auth-login', fn (Request $r) => Limit::perMinute(10)->by($r->ip()));
        RateLimiter::for('public',     fn (Request $r) => Limit::perMinute(30)->by($r->ip()));
        RateLimiter::for('public-ai',  fn (Request $r) => Limit::perMinute(10)->by($r->ip()));
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        // API is JSON-only. Force JSON rendering for /api/* even when the client
        // omits an Accept header, so an unauthenticated hit returns a clean 401
        // instead of a 500 (the default tries to redirect to a non-existent
        // web `login` route → RouteNotFoundException).
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*') || $request->expectsJson()
        );

        $exceptions->render(function (\Illuminate\Auth\AuthenticationException $e, Request $request) {
            if ($request->is('api/*') || $request->expectsJson()) {
                return response()->json(['status' => false, 'message' => 'Unauthenticated'], 401);
            }
            return null;
        });

        $exceptions->render(function (\Tymon\JWTAuth\Exceptions\TokenExpiredException $e, Request $request) {
            return response()->json(['status' => false, 'message' => 'Token has expired'], 401);
        });

        $exceptions->render(function (\Tymon\JWTAuth\Exceptions\TokenInvalidException $e, Request $request) {
            return response()->json(['status' => false, 'message' => 'Token is invalid'], 401);
        });

        $exceptions->render(function (\Tymon\JWTAuth\Exceptions\JWTException $e, Request $request) {
            return response()->json(['status' => false, 'message' => 'Token not provided'], 401);
        });
    })->create();
