<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('feedback_submissions', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('tenant_id');
            $table->unsignedBigInteger('feedback_qr_code_id')->nullable();
            $table->tinyInteger('rating');        // 1–5
            $table->text('comment')->nullable();
            $table->boolean('is_internal')->default(false); // true when rating <= 3
            $table->string('submitter_name')->nullable();
            $table->string('submitter_phone')->nullable();
            $table->string('ip_address')->nullable();
            $table->timestamps();

            $table->foreign('tenant_id')->references('id')->on('tenants')->onDelete('cascade');
            $table->foreign('feedback_qr_code_id')->references('id')->on('feedback_qr_codes')->nullOnDelete();
            $table->index(['tenant_id', 'rating']);
            $table->index(['tenant_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('feedback_submissions');
    }
};
