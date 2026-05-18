<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('restaurant_tables', function (Blueprint $table) {
            $table->timestamp('bill_requested_at')->nullable()->after('occupied_since');
        });

        Schema::table('tenants', function (Blueprint $table) {
            $table->boolean('customer_bill_request_enabled')->default(true)->after('qr_ordering_enabled');
        });
    }

    public function down(): void
    {
        Schema::table('restaurant_tables', function (Blueprint $table) {
            $table->dropColumn('bill_requested_at');
        });

        Schema::table('tenants', function (Blueprint $table) {
            $table->dropColumn('customer_bill_request_enabled');
        });
    }
};
