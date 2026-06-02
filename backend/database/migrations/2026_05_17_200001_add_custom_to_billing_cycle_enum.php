<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // Raw enum MODIFY is MySQL-only; sqlite (test DB) stores enums as TEXT so the
        // new 'custom' value already works without altering the column.
        if (DB::getDriverName() === 'mysql') {
            DB::statement("ALTER TABLE subscriptions MODIFY billing_cycle ENUM('monthly', 'yearly', 'custom') NOT NULL DEFAULT 'monthly'");
        }
    }

    public function down(): void
    {
        if (DB::getDriverName() === 'mysql') {
            DB::statement("ALTER TABLE subscriptions MODIFY billing_cycle ENUM('monthly', 'yearly') NOT NULL DEFAULT 'monthly'");
        }
    }
};
