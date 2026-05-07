<?php

use App\Http\Controllers\Auth\AuthController;
use App\Http\Controllers\Superadmin\AuditLogController;
use App\Http\Controllers\Superadmin\DatabaseStatsController;
use App\Http\Controllers\Superadmin\PaymentGatewayController;
use App\Http\Controllers\Superadmin\SubscriptionController;
use App\Http\Controllers\Superadmin\SubscriptionPlanController;
use App\Http\Controllers\Superadmin\TenantController;
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
        // Tenant management
        Route::get('tenants', [TenantController::class, 'index']);
        Route::post('tenants', [TenantController::class, 'store']);
        Route::get('tenants/{tenant}', [TenantController::class, 'show']);
        Route::put('tenants/{tenant}', [TenantController::class, 'update']);
        Route::delete('tenants/{tenant}', [TenantController::class, 'destroy']);
        Route::put('tenants/{tenant}/modules', [TenantController::class, 'updateModules']);
        Route::get('tenants/{tenant}/stats', [TenantController::class, 'stats']);

        // Subscription plans
        Route::apiResource('plans', SubscriptionPlanController::class);

        // Subscriptions
        Route::get('subscriptions', [SubscriptionController::class, 'index']);
        Route::post('tenants/{tenant}/assign-plan', [SubscriptionController::class, 'assignPlan']);
        Route::put('subscriptions/{subscription}/extend', [SubscriptionController::class, 'extend']);
        Route::put('subscriptions/{subscription}/cancel', [SubscriptionController::class, 'cancel']);

        // Payment gateways
        Route::put('tenants/{tenant}/payment-gateway', [PaymentGatewayController::class, 'configureGateway']);
        Route::post('tenants/{tenant}/stripe/create-customer', [PaymentGatewayController::class, 'createStripeCustomer']);

        // Database stats
        Route::get('db/overview', [DatabaseStatsController::class, 'overview']);
        Route::get('db/tenants/{tenant}', [DatabaseStatsController::class, 'tenantStats']);
        Route::get('db/tenants/{tenant}/export', [DatabaseStatsController::class, 'exportTenantData']);

        // Audit logs
        Route::get('audit-logs', [AuditLogController::class, 'index']);
        Route::delete('audit-logs/purge', [AuditLogController::class, 'purge']);
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

// Payment webhooks (no auth, verified by signature)
Route::post('webhooks/stripe', [PaymentGatewayController::class, 'stripeWebhook']);
Route::post('webhooks/razorpay', [PaymentGatewayController::class, 'razorpayWebhook']);
