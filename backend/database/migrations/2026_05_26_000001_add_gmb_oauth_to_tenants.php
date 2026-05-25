<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tenants', function (Blueprint $table) {
            $table->string('gmb_account_id')->nullable()->after('google_review_url');
            $table->string('gmb_location_id')->nullable()->after('gmb_account_id');
            $table->text('gmb_access_token')->nullable()->after('gmb_location_id');
            $table->text('gmb_refresh_token')->nullable()->after('gmb_access_token');
            $table->timestamp('gmb_token_expires_at')->nullable()->after('gmb_refresh_token');
            $table->string('gmb_location_name')->nullable()->after('gmb_token_expires_at');
            $table->boolean('gmb_auto_reply_enabled')->default(false)->after('gmb_location_name');
            $table->string('gmb_auto_reply_tone')->default('professional')->after('gmb_auto_reply_enabled');
            $table->timestamp('gmb_reviews_last_fetched_at')->nullable()->after('gmb_auto_reply_tone');
        });
    }

    public function down(): void
    {
        Schema::table('tenants', function (Blueprint $table) {
            $table->dropColumn([
                'gmb_account_id', 'gmb_location_id',
                'gmb_access_token', 'gmb_refresh_token', 'gmb_token_expires_at',
                'gmb_location_name', 'gmb_auto_reply_enabled', 'gmb_auto_reply_tone',
                'gmb_reviews_last_fetched_at',
            ]);
        });
    }
};
