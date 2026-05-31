<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tenants', function (Blueprint $table) {
            $table->json('contact_phones')->nullable()->after('phone');       // up to 5 numbers
            $table->string('active_contact_phone', 20)->nullable()->after('contact_phones');
        });
    }

    public function down(): void
    {
        Schema::table('tenants', function (Blueprint $table) {
            $table->dropColumn(['contact_phones', 'active_contact_phone']);
        });
    }
};
