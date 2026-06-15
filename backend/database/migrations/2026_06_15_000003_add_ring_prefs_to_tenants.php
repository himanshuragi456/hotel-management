<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Per-restaurant control over which alerts ring. Stored as a flat JSON map of
 * "<role>.<kind>" => bool (e.g. "chef.new_kot" => true). Null/absent means
 * "use the default" (ring), so existing tenants keep current behaviour; the
 * owner only stores the keys they explicitly turn off.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tenants', function (Blueprint $table) {
            $table->json('ring_prefs')->nullable()->after('swiggy_online');
        });
    }

    public function down(): void
    {
        Schema::table('tenants', function (Blueprint $table) {
            $table->dropColumn('ring_prefs');
        });
    }
};
