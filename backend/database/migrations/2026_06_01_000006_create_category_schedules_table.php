<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        // Day + time scheduling for a category/sub-category (Zomato category timing).
        // A category with no schedule rows is always available.
        Schema::create('category_schedules', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('menu_category_id')->constrained()->cascadeOnDelete();
            $table->unsignedTinyInteger('day_of_week'); // 0=Sun ... 6=Sat
            $table->time('start_time');
            $table->time('end_time');
            $table->timestamps();

            $table->index(['menu_category_id', 'day_of_week']);
        });
    }

    public function down(): void { Schema::dropIfExists('category_schedules'); }
};
