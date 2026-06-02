<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('order_items', function (Blueprint $table) {
            // Variant chosen for this line (nullable — items without variants are unaffected)
            $table->unsignedBigInteger('menu_item_variant_id')->nullable()->after('menu_item_id');
            $table->string('variant_name')->nullable()->after('item_name');
            // Snapshot of selected add-ons: [{addon_id, name, price, group}] — JSON keeps line self-describing
            $table->json('addons')->nullable()->after('notes');
            $table->decimal('addons_total', 10, 2)->default(0)->after('addons');
            // Per-line GST snapshot for India GST 5(9) bifurcation
            $table->decimal('gst_rate', 5, 2)->nullable()->after('addons_total');
            $table->decimal('cgst_amount', 10, 2)->default(0)->after('gst_rate');
            $table->decimal('sgst_amount', 10, 2)->default(0)->after('cgst_amount');
        });
    }

    public function down(): void
    {
        Schema::table('order_items', function (Blueprint $table) {
            $table->dropColumn([
                'menu_item_variant_id', 'variant_name', 'addons', 'addons_total',
                'gst_rate', 'cgst_amount', 'sgst_amount',
            ]);
        });
    }
};
