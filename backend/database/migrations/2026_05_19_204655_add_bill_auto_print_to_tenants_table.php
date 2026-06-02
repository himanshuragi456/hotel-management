<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('tenants', function (Blueprint $table) {
            // No ->after(): the referenced 'kot_printer' column is created by a later-dated
            // migration (2026_05_20_000001), so a clean migrate:fresh would fail. Column
            // position is cosmetic; appending is order-independent and safe on existing DBs.
            $table->boolean('bill_auto_print')->default(false);
        });
    }

    public function down(): void
    {
        Schema::table('tenants', function (Blueprint $table) {
            $table->dropColumn('bill_auto_print');
        });
    }
};
