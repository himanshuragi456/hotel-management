<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('expenses', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('created_by')->constrained('users')->cascadeOnDelete();
            $table->string('category');
            $table->string('description')->nullable();
            $table->decimal('amount', 10, 2);
            $table->date('expense_date');
            $table->timestamps();
        });
    }
    public function down(): void { Schema::dropIfExists('expenses'); }
};
