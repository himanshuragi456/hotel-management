<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        // Global catalogue of rejection reasons (Zomato-aligned). Not tenant-scoped —
        // a shared reference list; the eventual Zomato adapter maps `zomato_message_id`.
        Schema::create('order_rejection_reasons', function (Blueprint $table) {
            $table->id();
            $table->string('code')->unique();          // internal stable key
            $table->string('label');                   // shown to staff
            $table->string('zomato_message_id')->nullable(); // maps to Zomato rejection-message id (filled post-approval)
            $table->boolean('requires_item')->default(false); // true for item-out-of-stock reasons (IOOS)
            $table->boolean('is_active')->default(true);
            $table->integer('sort_order')->default(0);
            $table->timestamps();
        });

        // Capture rejection/cancellation context on the order itself.
        Schema::table('orders', function (Blueprint $table) {
            $table->string('rejection_code')->nullable()->after('aggregator_status');
            $table->text('rejection_note')->nullable()->after('rejection_code');
            // For IOOS rejections: which item(s) were out of stock (snapshot of menu_item ids)
            $table->json('rejected_item_ids')->nullable()->after('rejection_note');
            $table->timestamp('cancelled_at')->nullable()->after('rejected_item_ids');
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropColumn(['rejection_code', 'rejection_note', 'rejected_item_ids', 'cancelled_at']);
        });
        Schema::dropIfExists('order_rejection_reasons');
    }
};
