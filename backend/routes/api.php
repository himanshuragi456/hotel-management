<?php

use App\Http\Controllers\Auth\AuthController;
use App\Http\Controllers\Billing\InvoiceController;
use App\Http\Controllers\Chef\KitchenController;
use App\Http\Controllers\Customer\MenuController as CustomerMenuController;
use App\Http\Controllers\Owner\MenuController as OwnerMenuController;
use App\Http\Controllers\Owner\RevenueController;
use App\Http\Controllers\Owner\TableController;
use App\Http\Controllers\Waiter\OrderController as WaiterOrderController;
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
            // Menu categories
            Route::get('menu/categories', [OwnerMenuController::class, 'categories']);
            Route::post('menu/categories', [OwnerMenuController::class, 'storeCategory']);
            Route::put('menu/categories/{menuCategory}', [OwnerMenuController::class, 'updateCategory']);
            Route::delete('menu/categories/{menuCategory}', [OwnerMenuController::class, 'destroyCategory']);
            // Menu items
            Route::get('menu/items', [OwnerMenuController::class, 'items']);
            Route::post('menu/items', [OwnerMenuController::class, 'storeItem']);
            Route::put('menu/items/{menuItem}', [OwnerMenuController::class, 'updateItem']);
            Route::delete('menu/items/{menuItem}', [OwnerMenuController::class, 'destroyItem']);
            Route::post('menu/items/bulk-toggle', [OwnerMenuController::class, 'bulkToggle']);
            // Tables
            Route::get('tables', [TableController::class, 'index']);
            Route::post('tables', [TableController::class, 'store']);
            Route::put('tables/{restaurantTable}', [TableController::class, 'update']);
            Route::delete('tables/{restaurantTable}', [TableController::class, 'destroy']);
            Route::get('tables/{restaurantTable}/qr', [TableController::class, 'qrCode']);
            // Revenue & reports
            Route::get('orders/live', [RevenueController::class, 'liveOrders']);
            Route::get('revenue/today', [RevenueController::class, 'todayRevenue']);
            Route::get('orders/report', [RevenueController::class, 'ordersReport']);
            Route::get('orders/export/pdf', [RevenueController::class, 'exportPdf']);
            // Expenses
            Route::get('expenses', [RevenueController::class, 'expenses']);
            Route::post('expenses', [RevenueController::class, 'storeExpense']);
            Route::delete('expenses/{expense}', [RevenueController::class, 'destroyExpense']);
        });

        // Waiter routes
        Route::middleware(['role:waiter,owner'])->prefix('waiter')->group(function () {
            Route::get('tables', [WaiterOrderController::class, 'tables']);
            Route::get('menu', [WaiterOrderController::class, 'menu']);
            Route::post('orders', [WaiterOrderController::class, 'store']);
            Route::post('orders/{order}/items', [WaiterOrderController::class, 'addItems']);
            Route::get('orders/my', [WaiterOrderController::class, 'myOrders']);
        });

        // Chef routes
        Route::middleware(['role:chef,owner'])->prefix('chef')->group(function () {
            Route::get('orders', [KitchenController::class, 'orders']);
            Route::put('orders/{order}/status', [KitchenController::class, 'updateStatus']);
        });

        // Billing routes
        Route::middleware(['role:billing,owner'])->prefix('billing')->group(function () {
            Route::get('orders/ready', [InvoiceController::class, 'readyOrders']);
            Route::get('orders', [InvoiceController::class, 'allOrders']);
            Route::post('invoices', [InvoiceController::class, 'store']);
            Route::get('invoices/{invoice}', [InvoiceController::class, 'show']);
            Route::get('invoices/{invoice}/pdf', [InvoiceController::class, 'pdf']);
        });

    });
});

/*
|--------------------------------------------------------------------------
| Public customer / QR routes (no auth required)
|--------------------------------------------------------------------------
*/
Route::prefix('public')->group(function () {
    // Customer QR menu + ordering (no auth)
    Route::get('menu/{tenantSlug}/{qrToken}', [CustomerMenuController::class, 'menu']);
    Route::post('menu/{tenantSlug}/{qrToken}/order', [CustomerMenuController::class, 'placeOrder']);
    Route::get('orders/{orderNumber}/status', [CustomerMenuController::class, 'orderStatus']);
    // Phase 5 — feedback submission routes
});

// Payment webhooks (no auth, verified by signature)
Route::post('webhooks/stripe', [PaymentGatewayController::class, 'stripeWebhook']);
Route::post('webhooks/razorpay', [PaymentGatewayController::class, 'razorpayWebhook']);
