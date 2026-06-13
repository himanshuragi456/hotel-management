<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration {
    public function up(): void
    {
        if (DB::getDriverName() === 'mysql') {
            DB::statement(
                "ALTER TABLE orders MODIFY COLUMN source ENUM('pos','qr','magic_tables','aggregator','room_qr') NOT NULL DEFAULT 'pos'"
            );
        }
    }

    public function down(): void
    {
        if (DB::getDriverName() === 'mysql') {
            DB::statement(
                "ALTER TABLE orders MODIFY COLUMN source ENUM('pos','qr','magic_tables','aggregator') NOT NULL DEFAULT 'pos'"
            );
        }
    }
};
