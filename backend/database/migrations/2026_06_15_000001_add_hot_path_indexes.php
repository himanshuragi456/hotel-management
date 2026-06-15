<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Composite indexes for the highest-frequency polling queries.
 *
 * - orders(tenant_id, status): every chef / waiter / billing dashboard runs
 *   `WHERE tenant_id = ? AND status IN (...)` on a short timer. Previously only
 *   single-column tenant_id / FK indexes existed, so this filtered with a scan.
 * - app_notifications(user_id, created_at): the notification box prunes, lists
 *   (latest 50) and counts unread — all `WHERE user_id = ? AND created_at ...`
 *   — polled every ~20s by every signed-in dashboard.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->index(['tenant_id', 'status'], 'orders_tenant_status_index');
        });

        Schema::table('app_notifications', function (Blueprint $table) {
            $table->index(['user_id', 'created_at'], 'app_notifications_user_created_index');
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropIndex('orders_tenant_status_index');
        });

        Schema::table('app_notifications', function (Blueprint $table) {
            $table->dropIndex('app_notifications_user_created_index');
        });
    }
};
