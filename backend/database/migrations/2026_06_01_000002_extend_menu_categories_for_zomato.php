<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('menu_categories', function (Blueprint $table) {
            // Sub-category support: a category with a parent IS a sub-category (Zomato nesting)
            $table->unsignedBigInteger('parent_id')->nullable()->after('tenant_id');
            $table->foreign('parent_id')->references('id')->on('menu_categories')->nullOnDelete();
            // Category-level out-of-stock (marks the whole category + its sub-categories unavailable)
            $table->boolean('is_oos')->default(false)->after('is_active');
            // Optional Zomato category tag (e.g. "Recommended", "Bestseller")
            $table->string('category_tag')->nullable()->after('is_oos');
        });
    }

    public function down(): void
    {
        Schema::table('menu_categories', function (Blueprint $table) {
            $table->dropForeign(['parent_id']);
            $table->dropColumn(['parent_id', 'is_oos', 'category_tag']);
        });
    }
};
