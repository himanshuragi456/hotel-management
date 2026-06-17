<?php

use App\Http\Controllers\Auth\AuthController;
use App\Http\Controllers\Billing\InvoiceController;
use App\Http\Controllers\Chef\KitchenController;
use App\Http\Controllers\Customer\MenuController as CustomerMenuController;
use App\Http\Controllers\Customer\RoomMenuController;
use App\Http\Controllers\Owner\MenuController as OwnerMenuController;
use App\Http\Controllers\Owner\RevenueController;
use App\Http\Controllers\Owner\SettingsController;
use App\Http\Controllers\Owner\StaffController;
use App\Http\Controllers\Owner\TableController;
use App\Http\Controllers\NotificationController;
use App\Http\Controllers\Owner\AnalyticsController;
use App\Http\Controllers\Owner\Feedback\FeedbackController;
use App\Http\Controllers\Owner\Hotel\BookingController;
use App\Http\Controllers\Owner\Hotel\GuestController;
use App\Http\Controllers\Owner\Hotel\RoomController;
use App\Http\Controllers\Public\BrandingController as PublicBrandingController;
use App\Http\Controllers\Public\FeedbackSubmissionController;
use App\Http\Controllers\Public\GmbWebhookController;
use App\Http\Controllers\Owner\Feedback\GmbController;
use App\Http\Controllers\Public\LandingController;
use App\Http\Controllers\Public\MagicTablesController;
use App\Http\Controllers\Superadmin\BrandingController as SuperadminBrandingController;
use App\Http\Controllers\Waiter\OrderController as WaiterOrderController;
use App\Http\Controllers\Waiter\RoomServiceController;
use App\Http\Controllers\Superadmin\AuditLogController;
use App\Http\Controllers\Superadmin\DatabaseStatsController;
use App\Http\Controllers\Superadmin\PaymentGatewayController;
use App\Http\Controllers\Superadmin\SubscriptionController;
use App\Http\Controllers\Superadmin\SubscriptionPlanController;
use App\Http\Controllers\Superadmin\LocationController;
use App\Http\Controllers\Superadmin\TenantController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Public routes
|--------------------------------------------------------------------------
*/
Route::prefix('auth')->group(function () {
    Route::post('login', [AuthController::class, 'login'])->middleware('throttle:auth-login');
});

/*
|--------------------------------------------------------------------------
| Authenticated routes
|--------------------------------------------------------------------------
*/
Route::middleware(['auth:api'])->group(function () {
    // Notifications (all authenticated roles)
    Route::get('notifications', [NotificationController::class, 'index']);
    Route::post('notifications/mark-read', [NotificationController::class, 'markRead']);
    Route::post('notifications/{id}/mark-read', [NotificationController::class, 'markRead']);
    Route::delete('notifications/{id}', [NotificationController::class, 'destroy'])->whereNumber('id');
    Route::delete('notifications', [NotificationController::class, 'clearAll']);

    // Web Push (OS-level notifications so a sleeping phone still rings)
    Route::get('push/vapid-key', [\App\Http\Controllers\PushSubscriptionController::class, 'vapidKey']);
    Route::post('push/subscribe', [\App\Http\Controllers\PushSubscriptionController::class, 'store']);
    Route::post('push/unsubscribe', [\App\Http\Controllers\PushSubscriptionController::class, 'destroy']);

    Route::prefix('auth')->group(function () {
        Route::get('me', [AuthController::class, 'me']);
        Route::post('logout', [AuthController::class, 'logout']);
        Route::post('refresh', [AuthController::class, 'refresh']);
    });

    Route::middleware(['role:superadmin'])->post('auth/login-as', [AuthController::class, 'loginAs']);
    Route::middleware(['role:superadmin'])->post('auth/login-as-staff', [AuthController::class, 'loginAsStaff']);

    /*
    |----------------------------------------------------------------------
    | Superadmin routes
    |----------------------------------------------------------------------
    */
    Route::middleware(['role:superadmin'])->prefix('superadmin')->group(function () {
        Route::post('users/{user}/change-password', [\App\Http\Controllers\Superadmin\TenantController::class, 'changeUserPassword']);
        // Tenant management
        Route::get('tenants', [TenantController::class, 'index']);
        Route::post('tenants', [TenantController::class, 'store']);
        Route::get('tenants/{tenant}', [TenantController::class, 'show']);
        Route::put('tenants/{tenant}', [TenantController::class, 'update']);
        Route::delete('tenants/{tenant}', [TenantController::class, 'destroy']);
        Route::put('tenants/{tenant}/modules', [TenantController::class, 'updateModules']);
        Route::get('tenants/{tenant}/stats', [TenantController::class, 'stats']);
        Route::put('tenants/{tenant}/ai-settings', [TenantController::class, 'updateAiSettings']);

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

        // Branding / sales config
        Route::get('branding', [SuperadminBrandingController::class, 'show']);
        Route::post('branding', [SuperadminBrandingController::class, 'update']);

        // Locations
        Route::get('locations', [LocationController::class, 'index']);
        Route::post('locations', [LocationController::class, 'store']);
        Route::put('locations/{location}', [LocationController::class, 'update']);
        Route::delete('locations/{location}', [LocationController::class, 'destroy']);
    });

    /*
    |----------------------------------------------------------------------
    | Tenant-scoped routes (all non-superadmin roles)
    |----------------------------------------------------------------------
    */
    Route::middleware(['tenant.scope', 'check.subscription'])->group(function () {

        // Owner routes
        Route::middleware(['role:owner'])->prefix('owner')->group(function () {
            // Restaurant module — menu, tables, revenue, expenses, reports
            Route::middleware(['module:restaurant'])->group(function () {
                Route::get('menu/categories', [OwnerMenuController::class, 'categories']);
                Route::post('menu/categories', [OwnerMenuController::class, 'storeCategory']);
                Route::post('menu/categories/reorder', [OwnerMenuController::class, 'reorderCategories']);
                Route::put('menu/categories/{menuCategory}', [OwnerMenuController::class, 'updateCategory']);
                Route::delete('menu/categories/{menuCategory}', [OwnerMenuController::class, 'destroyCategory']);
                Route::get('menu/items', [OwnerMenuController::class, 'items']);
                Route::post('menu/items', [OwnerMenuController::class, 'storeItem']);
                Route::put('menu/items/{menuItem}', [OwnerMenuController::class, 'updateItem']);
                Route::delete('menu/items/{menuItem}', [OwnerMenuController::class, 'destroyItem']);
                Route::post('menu/items/bulk-toggle', [OwnerMenuController::class, 'bulkToggle']);
                Route::post('menu/items/{menuItem}/toggle-best-seller', [OwnerMenuController::class, 'toggleBestSeller']);
                // Variants
                Route::post('menu/items/{menuItem}/variants', [OwnerMenuController::class, 'storeVariant']);
                Route::put('menu/variants/{variant}', [OwnerMenuController::class, 'updateVariant']);
                Route::delete('menu/variants/{variant}', [OwnerMenuController::class, 'destroyVariant']);
                // Add-on groups & add-ons
                Route::post('menu/items/{menuItem}/addon-groups', [OwnerMenuController::class, 'storeAddonGroup']);
                Route::put('menu/addon-groups/{addonGroup}', [OwnerMenuController::class, 'updateAddonGroup']);
                Route::delete('menu/addon-groups/{addonGroup}', [OwnerMenuController::class, 'destroyAddonGroup']);
                Route::post('menu/addon-groups/{addonGroup}/addons', [OwnerMenuController::class, 'storeAddon']);
                Route::put('menu/addons/{addon}', [OwnerMenuController::class, 'updateAddon']);
                Route::delete('menu/addons/{addon}', [OwnerMenuController::class, 'destroyAddon']);
                // Category day/time schedule
                Route::put('menu/categories/{menuCategory}/schedules', [OwnerMenuController::class, 'setCategorySchedules']);
                Route::get('tables', [TableController::class, 'index']);
                Route::post('tables', [TableController::class, 'store']);
                Route::put('tables/{restaurantTable}', [TableController::class, 'update']);
                Route::delete('tables/{restaurantTable}', [TableController::class, 'destroy']);
                Route::get('tables/{restaurantTable}/qr', [TableController::class, 'qrCode']);
                Route::get('orders/report', [RevenueController::class, 'ordersReport']);
                Route::get('orders/export/pdf', [RevenueController::class, 'exportPdf']);
                Route::get('orders/export/excel', [RevenueController::class, 'exportExcel']);
                // Outlet management — hours, per-channel on/off, offline reason
                Route::get('outlet', [\App\Http\Controllers\Owner\OutletController::class, 'show']);
                Route::post('outlet/toggle-channel', [\App\Http\Controllers\Owner\OutletController::class, 'toggleChannel']);
                Route::put('outlet/hours', [\App\Http\Controllers\Owner\OutletController::class, 'setHours']);
            });
            // Expenses — available to all modules (hotel has salary, maintenance, etc.)
            Route::get('expenses', [RevenueController::class, 'expenses']);
            Route::post('expenses', [RevenueController::class, 'storeExpense']);
            Route::delete('expenses/{expense}', [RevenueController::class, 'destroyExpense']);
            // Hotel module — rooms, guests, bookings
            Route::middleware(['module:hotel'])->group(function () {
                Route::get('hotel/rooms', [RoomController::class, 'index']);
                Route::post('hotel/rooms', [RoomController::class, 'store']);
                Route::get('hotel/rooms/status', [RoomController::class, 'statusBoard']);
                Route::get('hotel/rooms/{room}', [RoomController::class, 'show']);
                Route::put('hotel/rooms/{room}', [RoomController::class, 'update']);
                Route::delete('hotel/rooms/{room}', [RoomController::class, 'destroy']);
                Route::get('hotel/rooms/{room}/qr', [RoomController::class, 'qrCode']);
                Route::get('hotel/guests', [GuestController::class, 'index']);
                Route::post('hotel/guests', [GuestController::class, 'store']);
                Route::get('hotel/guests/search', [GuestController::class, 'search']);
                Route::get('hotel/guests/{guest}', [GuestController::class, 'show']);
                Route::put('hotel/guests/{guest}', [GuestController::class, 'update']);
                Route::get('hotel/bookings', [BookingController::class, 'index']);
                Route::post('hotel/bookings', [BookingController::class, 'store']);
                Route::get('hotel/bookings/calendar', [BookingController::class, 'calendar']);
                Route::get('hotel/bookings/occupancy', [BookingController::class, 'occupancyReport']);
                Route::get('hotel/bookings/recent-checkouts', [BookingController::class, 'recentCheckouts']);
                Route::get('hotel/bookings/{booking}', [BookingController::class, 'show']);
                Route::put('hotel/bookings/{booking}', [BookingController::class, 'update']);
                Route::post('hotel/bookings/{booking}/check-in', [BookingController::class, 'checkIn']);
                Route::post('hotel/bookings/{booking}/check-out', [BookingController::class, 'checkOut']);
                Route::post('hotel/bookings/{booking}/cancel', [BookingController::class, 'cancel']);
                Route::get('hotel/bookings/{booking}/checkout-summary', [BookingController::class, 'checkoutSummary']);
                Route::patch('hotel/bookings/{booking}/extend', [BookingController::class, 'extendStay']);
                Route::get('hotel/bookings/{booking}/bill', [BookingController::class, 'printBill']);
            });
            // Feedback module
            Route::middleware(['module:feedback'])->group(function () {
                Route::get('feedback/qr-codes', [FeedbackController::class, 'listQrCodes']);
                Route::post('feedback/qr-codes', [FeedbackController::class, 'createQrCode']);
                Route::put('feedback/qr-codes/{qrCode}', [FeedbackController::class, 'updateQrCode']);
                Route::delete('feedback/qr-codes/{qrCode}', [FeedbackController::class, 'deleteQrCode']);
                Route::get('feedback/qr-codes/{qrCode}/download', [FeedbackController::class, 'downloadQrPng']);
                Route::get('feedback/review-config', [FeedbackController::class, 'getReviewConfig']);
                Route::put('feedback/review-config', [FeedbackController::class, 'updateReviewConfig']);
                Route::post('feedback/find-place', [FeedbackController::class, 'findPlace']);
                Route::get('feedback/dashboard', [FeedbackController::class, 'dashboard']);

                // GMB OAuth & settings
                Route::get('gmb/status', [GmbController::class, 'status']);
                Route::get('gmb/connect', [GmbController::class, 'connectRedirect']);
                Route::post('gmb/disconnect', [GmbController::class, 'disconnect']);
                Route::put('gmb/settings', [GmbController::class, 'updateSettings']);
                Route::get('gmb/accounts', [GmbController::class, 'listAccounts']);
                Route::get('gmb/locations', [GmbController::class, 'listLocations']);
                Route::post('gmb/select-location', [GmbController::class, 'selectLocation']);

                // GMB Reviews
                Route::get('gmb/reviews', [GmbController::class, 'listReviews']);
                Route::post('gmb/reviews/sync', [GmbController::class, 'syncReviews']);
                Route::post('gmb/reviews/{review}/ai-reply', [GmbController::class, 'generateAiReply']);
                Route::post('gmb/reviews/{review}/reply', [GmbController::class, 'postReply']);

                // GMB Posts
                Route::get('gmb/posts', [GmbController::class, 'listPosts']);
                Route::post('gmb/posts/generate', [GmbController::class, 'generatePostSuggestions']);
                Route::post('gmb/posts/{post}/publish', [GmbController::class, 'publishPost']);
                Route::post('gmb/posts/{post}/dismiss', [GmbController::class, 'dismissPost']);
                Route::put('gmb/posts/{post}', [GmbController::class, 'updatePost']);
            });
            // Available regardless of module (dashboard stats + staff management always needed)
            Route::get('orders/live', [RevenueController::class, 'liveOrders']);
            Route::get('revenue/today', [RevenueController::class, 'todayRevenue']);
            Route::get('analytics/overview', [AnalyticsController::class, 'overview']);
            Route::get('analytics/audit-log', [AnalyticsController::class, 'ownerAuditLog']);
            Route::get('staff', [StaffController::class, 'index']);
            Route::post('staff', [StaffController::class, 'store']);
            Route::put('staff/{id}', [StaffController::class, 'update']);
            Route::delete('staff/{id}', [StaffController::class, 'destroy']);
            Route::post('staff/{id}/toggle-active', [StaffController::class, 'toggleActive']);
            Route::post('change-password', [SettingsController::class, 'changePassword']);
            // Settings available for all modules (KOT config applies to restaurant, but endpoint is shared)
            Route::get('settings', [SettingsController::class, 'show']);
            Route::put('settings', [SettingsController::class, 'update']);
        });

        // Shared read-only settings — accessible to all staff roles for KOT config etc.
        Route::middleware(['role:waiter,chef,billing,owner'])->get('tenant-settings', [SettingsController::class, 'show']);

        // Order actions (reject / cancel / mark OOS) — chef, billing, owner; restaurant module
        Route::middleware(['role:chef,billing,owner', 'module:restaurant'])->group(function () {
            Route::get('order-actions/rejection-reasons', [\App\Http\Controllers\OrderActionController::class, 'rejectionReasons']);
            Route::post('order-actions/{order}/reject', [\App\Http\Controllers\OrderActionController::class, 'reject']);
            Route::post('order-actions/{order}/cancel', [\App\Http\Controllers\OrderActionController::class, 'cancel']);
            Route::delete('order-actions/{order}/dismiss', [\App\Http\Controllers\OrderActionController::class, 'dismiss']);
            Route::post('order-actions/mark-oos', [\App\Http\Controllers\OrderActionController::class, 'markOos']);
        });

        // Billing counter: set active contact phone shown to Magic Tables customers
        Route::middleware(['role:billing,owner'])->put('settings/active-phone', [SettingsController::class, 'setActivePhone']);

        // Waiter routes — restaurant module only
        Route::middleware(['role:waiter,owner', 'module:restaurant'])->prefix('waiter')->group(function () {
            Route::get('tables', [WaiterOrderController::class, 'tables']);
            Route::get('menu', [WaiterOrderController::class, 'menu']);
            Route::post('orders', [WaiterOrderController::class, 'store']);
            Route::get('orders/my', [WaiterOrderController::class, 'myOrders']);
            Route::get('tables/{tableId}/orders', [WaiterOrderController::class, 'tableOrders']);
            Route::get('orders/{order}', [WaiterOrderController::class, 'show']);
            Route::post('orders/{order}/items', [WaiterOrderController::class, 'addItems']);
            Route::post('orders/{order}/request-bill', [WaiterOrderController::class, 'requestBill']);
            Route::post('orders/{order}/mark-served', [WaiterOrderController::class, 'markServed']);
            // Room service — requires hotel module too (waiter placing room service in a combined tenant)
            Route::middleware(['module:hotel'])->group(function () {
                Route::get('room-service/active-rooms', [RoomServiceController::class, 'activeRooms']);
                Route::post('room-service/orders', [RoomServiceController::class, 'placeOrder']);
            });
        });

        // Chef routes — restaurant module only
        Route::middleware(['role:chef,owner', 'module:restaurant'])->prefix('chef')->group(function () {
            Route::get('orders', [KitchenController::class, 'orders']);
            Route::put('orders/{order}/status', [KitchenController::class, 'updateStatus']);
        });

        // Billing routes — split by module
        Route::middleware(['role:billing,owner'])->prefix('billing')->group(function () {
            // Restaurant billing — tables, food orders, invoices
            Route::middleware(['module:restaurant'])->group(function () {
                Route::get('tables', [InvoiceController::class, 'tables']);
                Route::get('tables/{tableId}/orders', [InvoiceController::class, 'tableOrders']);
                Route::get('tables/{tableId}/history', [InvoiceController::class, 'tableHistory']);
                Route::post('tables/{tableId}/close', [InvoiceController::class, 'closeTable']);
                Route::post('tables/{tableId}/bill-all', [InvoiceController::class, 'billAll']);
                Route::post('orders', [InvoiceController::class, 'newOrderForTable']);
                Route::post('orders/{order}/items', [InvoiceController::class, 'addItems']);
                Route::post('orders/{order}/mark-served', [InvoiceController::class, 'markServed']);
                Route::put('orders/{order}/status', [KitchenController::class, 'updateStatus']);
                Route::get('menu', [InvoiceController::class, 'getBillingMenu']);
                Route::get('staff/waiters', [InvoiceController::class, 'waiters']);
            });
            // Hotel billing — bookings, rooms, guests
            Route::middleware(['module:hotel'])->group(function () {
                Route::get('hotel/rooms/status', [RoomController::class, 'statusBoard']);
                Route::get('hotel/rooms', [RoomController::class, 'index']);
                Route::get('hotel/active-rooms', [RoomServiceController::class, 'activeRooms']);
                Route::get('hotel/bookings', [BookingController::class, 'index']);
                Route::post('hotel/bookings', [BookingController::class, 'store']);
                Route::get('hotel/bookings/recent-checkouts', [BookingController::class, 'recentCheckouts']);
                Route::get('hotel/bookings/{booking}', [BookingController::class, 'show']);
                Route::put('hotel/bookings/{booking}', [BookingController::class, 'update']);
                Route::post('hotel/bookings/{booking}/check-in', [BookingController::class, 'checkIn']);
                Route::post('hotel/bookings/{booking}/check-out', [BookingController::class, 'checkOut']);
                Route::post('hotel/bookings/{booking}/cancel', [BookingController::class, 'cancel']);
                Route::get('hotel/bookings/{booking}/checkout-summary', [BookingController::class, 'checkoutSummary']);
                Route::patch('hotel/bookings/{booking}/extend', [BookingController::class, 'extendStay']);
                Route::get('hotel/bookings/{booking}/bill', [BookingController::class, 'printBill']);
                Route::get('hotel/guests/search', [GuestController::class, 'search']);
                Route::post('hotel/guests', [GuestController::class, 'store']);
            });
            // Room service — only when both hotel and restaurant are active
            Route::middleware(['module:hotel', 'module:restaurant'])->group(function () {
                Route::get('hotel/bookings/{bookingId}/orders', [InvoiceController::class, 'bookingOrders']);
                Route::post('orders/{order}/mark-served-room', [InvoiceController::class, 'markServedRoom']);
                Route::post('hotel/room-service/orders', [RoomServiceController::class, 'placeOrder']);
            });
            // Takeaway orders — restaurant module
            Route::middleware(['module:restaurant'])->group(function () {
                Route::post('takeaway/orders', [InvoiceController::class, 'storeTakeaway']);
                Route::post('aggregator/orders', [InvoiceController::class, 'storeAggregator']);
            });
            // Magic Tables payment confirmation — restaurant module
            Route::middleware(['module:restaurant'])->group(function () {
                Route::get('magic-tables/pending', [InvoiceController::class, 'pendingMtOrders']);
                Route::post('magic-tables/{slug}/orders/{orderId}/confirm-payment', [MagicTablesController::class, 'confirmPayment']);
                Route::post('magic-tables/{slug}/orders/{orderId}/discard', [MagicTablesController::class, 'discardOrder']);
                // Bill-paid confirmation — customer notified counter, billing confirms and closes
                Route::get('magic-tables/bill-paid', [InvoiceController::class, 'billPaidTables']);
                Route::post('magic-tables/tables/{tableId}/confirm-bill-paid', [InvoiceController::class, 'confirmBillPaid']);
                Route::post('magic-tables/tables/{tableId}/reject-bill-paid', [InvoiceController::class, 'rejectBillPaid']);
            });
            // Cross-module: invoices and active-order feed available if any module active
            Route::get('orders/ready', [InvoiceController::class, 'readyOrders']);
            Route::get('orders/active', [InvoiceController::class, 'activeOrders']);
            Route::get('orders/unbilled-takeaway', [InvoiceController::class, 'unbilledTakeaway']);
            Route::get('orders', [InvoiceController::class, 'allOrders']);
            Route::post('invoices', [InvoiceController::class, 'store']);
            Route::get('invoices/recent', [InvoiceController::class, 'recent']);
            Route::get('invoices/combined-pdf', [InvoiceController::class, 'combinedPdf']);
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
// Landing page public endpoints (no auth)
Route::middleware('throttle:public')->group(function () {
    Route::post('landing/contact',   [LandingController::class, 'contact']);
    Route::post('landing/book-demo', [LandingController::class, 'bookDemo']);
});

Route::prefix('public')->group(function () {
    // System branding (no auth — shown on all public pages)
    Route::get('branding', [PublicBrandingController::class, 'show']);

    // Customer QR menu + ordering (no auth) — reads open, writes throttled
    Route::get('menu/{tenantSlug}/{qrToken}', [CustomerMenuController::class, 'menu']);
    Route::middleware('throttle:public')->group(function () {
        Route::post('menu/{tenantSlug}/{qrToken}/order', [CustomerMenuController::class, 'placeOrder']);
        Route::post('menu/{tenantSlug}/{qrToken}/request-bill', [CustomerMenuController::class, 'requestBill']);
        Route::post('menu/{tenantSlug}/{qrToken}/call-waiter', [CustomerMenuController::class, 'callWaiter']);
        Route::post('menu/{tenantSlug}/{qrToken}/notify-bill-paid', [CustomerMenuController::class, 'notifyBillPaid']);
    });
    Route::get('orders/{orderNumber}/status', [CustomerMenuController::class, 'orderStatus']);
    // Room service QR menu (no auth)
    Route::get('room/{tenantSlug}/{qrToken}', [RoomMenuController::class, 'menu']);
    Route::post('room/{tenantSlug}/{qrToken}/order', [RoomMenuController::class, 'placeOrder'])->middleware('throttle:public');
    // Feedback submission (public — no auth)
    // Google OAuth callback (redirects to frontend after token exchange)
    Route::get('auth/google/gmb/callback', [GmbController::class, 'connectCallback']);

    // Google Pub/Sub push webhook for review notifications
    Route::post('webhooks/gmb-reviews', [GmbWebhookController::class, 'handle']);

    Route::get('feedback/{token}', [FeedbackSubmissionController::class, 'show']);
    Route::post('feedback/{token}/submit', [FeedbackSubmissionController::class, 'submit'])->middleware('throttle:public');
    Route::post('feedback/{token}/ai-suggestions', [FeedbackSubmissionController::class, 'aiSuggestions'])->middleware('throttle:public-ai');
});

/*
|--------------------------------------------------------------------------
| Magic Tables — public consumer-facing discovery API
|--------------------------------------------------------------------------
*/
Route::prefix('magic-tables')->group(function () {
    Route::get('cities', [MagicTablesController::class, 'cities']);
    Route::get('locations', [MagicTablesController::class, 'locations']);
    Route::get('restaurants', [MagicTablesController::class, 'restaurants']);
    Route::get('restaurants/{slug}', [MagicTablesController::class, 'show']);
    Route::get('restaurants/{slug}/tables', [MagicTablesController::class, 'tables']);
    Route::get('restaurants/{slug}/menu', [MagicTablesController::class, 'menu']);
    Route::get('restaurants/{slug}/my-orders', [MagicTablesController::class, 'myOrders']);
    Route::middleware('throttle:public')->group(function () {
        Route::post('restaurants/{slug}/orders', [MagicTablesController::class, 'createOrder']);
        Route::post('restaurants/{slug}/orders/verify-payment', [MagicTablesController::class, 'verifyPayment']);
        Route::post('restaurants/{slug}/orders/submit-upi', [MagicTablesController::class, 'submitUpiOrder']);
        Route::post('restaurants/{slug}/call-waiter', [MagicTablesController::class, 'callWaiter']);
        Route::post('restaurants/{slug}/request-bill', [MagicTablesController::class, 'requestBill']);
        Route::post('restaurants/{slug}/orders/{orderId}/cancel', [MagicTablesController::class, 'cancelOrder']);
        Route::post('restaurants/{slug}/tables/{tableId}/notify-paid', [MagicTablesController::class, 'notifyBillPaid']);
    });
});

// Payment webhooks (no auth, verified by signature)
Route::post('webhooks/stripe', [PaymentGatewayController::class, 'stripeWebhook']);
Route::post('webhooks/razorpay', [PaymentGatewayController::class, 'razorpayWebhook']);
