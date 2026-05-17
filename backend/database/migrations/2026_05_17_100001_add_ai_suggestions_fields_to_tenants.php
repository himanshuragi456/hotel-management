<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tenants', function (Blueprint $table) {
            $table->boolean('ai_suggestions_enabled')->default(false)->after('review_suggestions');
            $table->unsignedInteger('ai_monthly_quota')->default(100)->after('ai_suggestions_enabled');
            $table->unsignedInteger('ai_usage_this_month')->default(0)->after('ai_monthly_quota');
            $table->date('ai_usage_reset_at')->nullable()->after('ai_usage_this_month');
        });
    }

    public function down(): void
    {
        Schema::table('tenants', function (Blueprint $table) {
            $table->dropColumn(['ai_suggestions_enabled', 'ai_monthly_quota', 'ai_usage_this_month', 'ai_usage_reset_at']);
        });
    }
};
