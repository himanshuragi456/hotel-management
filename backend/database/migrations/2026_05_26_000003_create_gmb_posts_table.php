<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('gmb_posts', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('tenant_id');
            $table->enum('post_type', ['STANDARD', 'EVENT', 'OFFER'])->default('STANDARD');
            $table->string('topic')->nullable();
            $table->text('summary');
            $table->string('call_to_action_type')->nullable(); // LEARN_MORE, ORDER, BOOK etc.
            $table->string('call_to_action_url')->nullable();
            $table->string('event_title')->nullable();
            $table->date('event_start_date')->nullable();
            $table->date('event_end_date')->nullable();
            $table->string('offer_coupon_code')->nullable();
            $table->enum('status', ['suggested', 'published', 'dismissed'])->default('suggested');
            $table->string('google_post_name')->nullable();
            $table->timestamp('suggested_at');
            $table->timestamp('published_at')->nullable();
            $table->timestamps();

            $table->foreign('tenant_id')->references('id')->on('tenants')->onDelete('cascade');
            $table->index(['tenant_id', 'status']);
            $table->index(['tenant_id', 'suggested_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('gmb_posts');
    }
};
