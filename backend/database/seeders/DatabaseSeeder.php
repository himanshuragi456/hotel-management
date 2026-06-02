<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $this->call([
            RolesPermissionsSeeder::class,
            SuperadminSeeder::class,
            SubscriptionPlansSeeder::class,
            OrderRejectionReasonsSeeder::class,
            DemoTenantSeeder::class,
            TenantDataSeeder::class,
        ]);
    }
}
