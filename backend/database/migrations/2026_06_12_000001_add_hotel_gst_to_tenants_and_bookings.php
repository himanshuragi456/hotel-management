<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tenants', function (Blueprint $table) {
            $table->decimal('hotel_gst_rate', 5, 2)->default(0)->after('gst_inclusive');
            $table->boolean('hotel_gst_inclusive')->default(false)->after('hotel_gst_rate');
        });

        Schema::table('bookings', function (Blueprint $table) {
            $table->decimal('gst_rate', 5, 2)->default(0)->after('price_per_night');
            $table->boolean('gst_inclusive')->default(false)->after('gst_rate');
        });
    }

    public function down(): void
    {
        Schema::table('tenants', function (Blueprint $table) {
            $table->dropColumn(['hotel_gst_rate', 'hotel_gst_inclusive']);
        });

        Schema::table('bookings', function (Blueprint $table) {
            $table->dropColumn(['gst_rate', 'gst_inclusive']);
        });
    }
};
