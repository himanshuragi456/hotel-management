<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * One row per browser/device that opted in to OS-level push. A user (e.g. a
 * chef) may have several (phone + tablet). Keyed by the unique push `endpoint`
 * the browser returns; re-subscribing updates the keys rather than duplicating.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('push_subscriptions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('tenant_id')->nullable()->constrained()->nullOnDelete();
            $table->text('endpoint');
            // SHA-256 of the endpoint — endpoints are too long to index directly
            // (MySQL unique-index limit), so we dedupe on this fixed-length hash.
            $table->char('endpoint_hash', 64);
            $table->string('public_key');   // p256dh
            $table->string('auth_token');    // auth
            $table->string('content_encoding')->default('aesgcm');
            $table->timestamps();

            $table->index('user_id');
            $table->unique('endpoint_hash', 'push_subscriptions_endpoint_hash_unique');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('push_subscriptions');
    }
};
