<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('tenants', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('slug')->unique();
            $table->string('email')->unique();
            $table->string('phone')->nullable();
            $table->string('address')->nullable();
            $table->string('city')->nullable();
            $table->string('state')->nullable();
            $table->string('country')->default('India');
            $table->string('gstin')->nullable();
            $table->decimal('gst_rate', 5, 2)->default(5.00);
            $table->string('logo')->nullable();
            $table->string('currency')->default('INR');
            $table->string('timezone')->default('Asia/Kolkata');
            $table->enum('status', ['active', 'suspended', 'trial'])->default('trial');
            $table->string('google_place_id')->nullable();
            $table->string('google_review_url')->nullable();
            $table->string('payment_gateway')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tenants');
    }
};
