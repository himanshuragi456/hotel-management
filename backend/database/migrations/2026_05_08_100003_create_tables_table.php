<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('restaurant_tables', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->string('number');
            $table->integer('capacity')->default(4);
            $table->string('section')->nullable();
            $table->enum('status', ['free', 'occupied'])->default('free');
            $table->timestamp('occupied_since')->nullable();
            $table->string('qr_token')->unique()->nullable();
            $table->timestamps();
        });
    }
    public function down(): void { Schema::dropIfExists('restaurant_tables'); }
};
