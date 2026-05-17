<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement("ALTER TABLE subscriptions MODIFY billing_cycle ENUM('monthly', 'yearly', 'custom') NOT NULL DEFAULT 'monthly'");
    }

    public function down(): void
    {
        DB::statement("ALTER TABLE subscriptions MODIFY billing_cycle ENUM('monthly', 'yearly') NOT NULL DEFAULT 'monthly'");
    }
};
