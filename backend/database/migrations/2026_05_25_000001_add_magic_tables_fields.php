<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        // Orders: track source and payment status for Magic Tables pre-orders
        Schema::table('orders', function (Blueprint $table) {
            $table->enum('source', ['pos', 'qr', 'magic_tables'])->default('pos')->after('type');
            $table->enum('payment_status', ['not_applicable', 'pending_payment', 'paid'])->default('not_applicable')->after('source');
            $table->string('razorpay_order_id')->nullable()->after('payment_status');
            $table->string('razorpay_payment_id')->nullable()->after('razorpay_order_id');
        });

        // Extend table status enum (kept for compatibility; 'reserved' is not actively used)
        \Illuminate\Support\Facades\DB::statement(
            "ALTER TABLE restaurant_tables MODIFY COLUMN status ENUM('free','occupied','reserved') NOT NULL DEFAULT 'free'"
        );
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropColumn(['source', 'payment_status', 'razorpay_order_id', 'razorpay_payment_id']);
        });
        \Illuminate\Support\Facades\DB::statement(
            "ALTER TABLE restaurant_tables MODIFY COLUMN status ENUM('free','occupied') NOT NULL DEFAULT 'free'"
        );
    }
};
