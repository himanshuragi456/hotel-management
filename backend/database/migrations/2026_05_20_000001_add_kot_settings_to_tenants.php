<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tenants', function (Blueprint $table) {
            $table->boolean('kot_enabled')->default(false)->after('customer_bill_request_enabled');
            $table->boolean('kot_auto_print')->default(false)->after('kot_enabled');
            // 'kitchen' = kitchen screen prints KOT, 'billing' = billing counter prints KOT
            $table->string('kot_printer')->default('kitchen')->after('kot_auto_print');
        });
    }

    public function down(): void
    {
        Schema::table('tenants', function (Blueprint $table) {
            $table->dropColumn(['kot_enabled', 'kot_auto_print', 'kot_printer']);
        });
    }
};
