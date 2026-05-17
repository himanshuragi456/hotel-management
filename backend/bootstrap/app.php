<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;

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
    })
    ->withExceptions(function (Exceptions $exceptions): void {
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
