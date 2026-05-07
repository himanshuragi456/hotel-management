<?php

use App\Http\Controllers\Auth\AuthController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Public routes
|--------------------------------------------------------------------------
*/
Route::prefix('auth')->group(function () {
    Route::post('login', [AuthController::class, 'login']);
});

/*
|--------------------------------------------------------------------------
| Authenticated routes
|--------------------------------------------------------------------------
*/
Route::middleware(['auth:api'])->group(function () {
    Route::prefix('auth')->group(function () {
        Route::get('me', [AuthController::class, 'me']);
        Route::post('logout', [AuthController::class, 'logout']);
        Route::post('refresh', [AuthController::class, 'refresh']);
    });

    /*
    |----------------------------------------------------------------------
    | Superadmin routes
    |----------------------------------------------------------------------
    */
    Route::middleware(['role:superadmin'])->prefix('superadmin')->group(function () {
        // Phase 2 — Superadmin panel routes registered here
    });

    /*
    |----------------------------------------------------------------------
    | Tenant-scoped routes (all non-superadmin roles)
    |----------------------------------------------------------------------
    */
    Route::middleware(['tenant.scope'])->group(function () {

        // Owner routes
        Route::middleware(['role:owner'])->prefix('owner')->group(function () {
            // Phase 3+ owner routes
        });

        // Waiter routes
        Route::middleware(['role:waiter,owner'])->prefix('waiter')->group(function () {
            // Phase 3 waiter routes
        });

        // Chef routes
        Route::middleware(['role:chef,owner'])->prefix('chef')->group(function () {
            // Phase 3 chef routes
        });

        // Billing routes
        Route::middleware(['role:billing,owner'])->prefix('billing')->group(function () {
            // Phase 3 billing routes
        });

    });
});

/*
|--------------------------------------------------------------------------
| Public customer / QR routes (no auth required)
|--------------------------------------------------------------------------
*/
Route::prefix('public')->group(function () {
    // Phase 3 — customer QR menu routes
    // Phase 5 — feedback submission routes
});
