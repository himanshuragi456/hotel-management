<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tenants', function (Blueprint $table) {
            // When true, item prices already include GST — show "incl. GST" on menus,
            // extract tax on invoices rather than adding on top.
            $table->boolean('gst_inclusive')->default(false)->after('gst_rate');
        });
    }

    public function down(): void
    {
        Schema::table('tenants', function (Blueprint $table) {
            $table->dropColumn('gst_inclusive');
        });
    }
};
