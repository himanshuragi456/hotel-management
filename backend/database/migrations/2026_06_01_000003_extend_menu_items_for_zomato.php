<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('menu_items', function (Blueprint $table) {
            // India GST 5(9): item-level slab + whether tax is split into CGST/SGST
            $table->decimal('gst_slab', 5, 2)->nullable()->after('price');   // null = use tenant default
            $table->boolean('gst_cgst_sgst')->default(true)->after('gst_slab'); // split into CGST+SGST
            // Packaging charge applied per item (aggregator deliveries)
            $table->decimal('packaging_charge', 10, 2)->default(0)->after('gst_cgst_sgst');
            // Beverage flag + meat type for compliance tagging
            $table->boolean('is_beverage')->default(false)->after('type');
            $table->string('meat_type')->nullable()->after('is_beverage'); // chicken/mutton/fish/...
            // Compliance: nutritional info (JSON: calories, protein, etc.) + serving info
            $table->json('nutritional_info')->nullable()->after('description');
            $table->string('serving_info')->nullable()->after('nutritional_info'); // e.g. "Serves 2"
        });
    }

    public function down(): void
    {
        Schema::table('menu_items', function (Blueprint $table) {
            $table->dropColumn([
                'gst_slab', 'gst_cgst_sgst', 'packaging_charge',
                'is_beverage', 'meat_type', 'nutritional_info', 'serving_info',
            ]);
        });
    }
};
