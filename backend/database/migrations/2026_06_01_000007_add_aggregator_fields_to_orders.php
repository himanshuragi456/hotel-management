<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        // Extend source enum to include aggregator orders (Zomato/Swiggy).
        // MySQL needs an explicit MODIFY; sqlite stores enums as TEXT so the new value just works.
        if (DB::getDriverName() === 'mysql') {
            DB::statement(
                "ALTER TABLE orders MODIFY COLUMN source ENUM('pos','qr','magic_tables','aggregator') NOT NULL DEFAULT 'pos'"
            );
        }

        Schema::table('orders', function (Blueprint $table) {
            // Which aggregator this manual order belongs to
            $table->string('platform')->nullable()->after('source'); // zomato / swiggy / other
            // Aggregator's own order id (manual entry now; API later)
            $table->string('external_order_id')->nullable()->after('platform');
            // Aggregator-side status separate from kitchen status (placed/accepted/rejected/...)
            $table->string('aggregator_status')->nullable()->after('external_order_id');
            // Structured cooking instructions / cutlery preference
            $table->boolean('no_cutlery')->default(false)->after('notes');

            $table->index(['tenant_id', 'platform']);
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropIndex(['tenant_id', 'platform']);
            $table->dropColumn(['platform', 'external_order_id', 'aggregator_status', 'no_cutlery']);
        });
        if (DB::getDriverName() === 'mysql') {
            DB::statement(
                "ALTER TABLE orders MODIFY COLUMN source ENUM('pos','qr','magic_tables') NOT NULL DEFAULT 'pos'"
            );
        }
    }
};
