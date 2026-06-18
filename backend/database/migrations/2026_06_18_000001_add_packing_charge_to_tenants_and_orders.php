<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tenants', function (Blueprint $table) {
            // Owner-controlled: charge packing on takeaway orders (uses each item's packaging_charge).
            $table->boolean('packing_charge_enabled')->default(false)->after('customer_bill_request_enabled');
            // Whether aggregator (Swiggy/Zomato) takeaway orders also get the packing charge.
            $table->boolean('packing_charge_on_aggregator')->default(false)->after('packing_charge_enabled');
        });

        Schema::table('orders', function (Blueprint $table) {
            // Snapshot of the packing charge applied to this order (sum of per-item packaging_charge).
            $table->decimal('packing_charge', 10, 2)->default(0)->after('discount');
        });

        Schema::table('invoices', function (Blueprint $table) {
            // Packing charge carried onto the invoice and included in the total.
            $table->decimal('packing_charge', 10, 2)->default(0)->after('discount_amount');
        });
    }

    public function down(): void
    {
        Schema::table('tenants', function (Blueprint $table) {
            $table->dropColumn(['packing_charge_enabled', 'packing_charge_on_aggregator']);
        });

        Schema::table('orders', function (Blueprint $table) {
            $table->dropColumn('packing_charge');
        });

        Schema::table('invoices', function (Blueprint $table) {
            $table->dropColumn('packing_charge');
        });
    }
};
