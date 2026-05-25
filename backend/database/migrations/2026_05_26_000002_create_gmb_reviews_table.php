<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('gmb_reviews', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('tenant_id');
            $table->string('google_review_id')->unique();
            $table->string('reviewer_name')->nullable();
            $table->string('reviewer_photo')->nullable();
            $table->tinyInteger('star_rating')->nullable(); // 1-5
            $table->text('comment')->nullable();
            $table->timestamp('review_time');
            $table->text('reply_text')->nullable();
            $table->timestamp('reply_time')->nullable();
            $table->enum('reply_status', ['none', 'pending_ai', 'ai_generated', 'posted', 'failed'])->default('none');
            $table->text('ai_reply_draft')->nullable();
            $table->timestamp('replied_at')->nullable();
            $table->timestamps();

            $table->foreign('tenant_id')->references('id')->on('tenants')->onDelete('cascade');
            $table->index(['tenant_id', 'review_time']);
            $table->index(['tenant_id', 'reply_status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('gmb_reviews');
    }
};
