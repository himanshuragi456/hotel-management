<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('tenants', function (Blueprint $table) {
            // Per-channel aggregator on/off (independent of is_open which drives Magic Tables).
            $table->boolean('zomato_online')->default(true)->after('is_open');
            $table->boolean('swiggy_online')->default(true)->after('zomato_online');
            // Why the outlet is offline (Zomato offline-reason glossary) + auto-resume time.
            $table->string('offline_reason')->nullable()->after('swiggy_online');
            $table->timestamp('offline_until')->nullable()->after('offline_reason');
        });

        // Operational hours per channel. No rows for a channel = open 24/7 for that channel.
        Schema::create('outlet_hours', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->string('channel')->default('all'); // all | zomato | swiggy | dine_in
            $table->unsignedTinyInteger('day_of_week'); // 0=Sun..6=Sat
            $table->time('open_time');
            $table->time('close_time');
            $table->timestamps();

            $table->index(['tenant_id', 'channel', 'day_of_week']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('outlet_hours');
        Schema::table('tenants', function (Blueprint $table) {
            $table->dropColumn(['zomato_online', 'swiggy_online', 'offline_reason', 'offline_until']);
        });
    }
};
