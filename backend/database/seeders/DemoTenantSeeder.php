<?php

namespace Database\Seeders;

use App\Models\Subscription;
use App\Models\SubscriptionPlan;
use App\Models\Tenant;
use App\Models\TenantModule;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DemoTenantSeeder extends Seeder
{
    public function run(): void
    {
        $tenant = Tenant::firstOrCreate(
            ['slug' => 'demo-restaurant'],
            [
                'name'     => 'Demo Restaurant & Hotel',
                'email'    => 'demo@restaurant.com',
                'phone'    => '+919999999999',
                'city'     => 'Indore',
                'state'    => 'Madhya Pradesh',
                'gstin'    => '23ABCDE1234F1Z5',
                'gst_rate' => 5.00,
                'status'   => 'active',
            ]
        );

        TenantModule::firstOrCreate(
            ['tenant_id' => $tenant->id],
            ['restaurant' => true, 'hotel' => true, 'feedback' => true]
        );

        $plan = SubscriptionPlan::where('slug', 'combo')->first();
        if ($plan) {
            Subscription::firstOrCreate(
                ['tenant_id' => $tenant->id],
                [
                    'subscription_plan_id' => $plan->id,
                    'billing_cycle'        => 'monthly',
                    'status'               => 'active',
                    'payment_gateway'      => 'manual',
                    'amount'               => $plan->price_monthly,
                    'current_period_start' => now(),
                    'current_period_end'   => now()->addMonth(),
                ]
            );
        }

        $users = [
            ['name' => 'Demo Owner',   'email' => 'owner@demo.com',   'role' => 'owner'],
            ['name' => 'Demo Waiter',  'email' => 'waiter@demo.com',  'role' => 'waiter'],
            ['name' => 'Demo Chef',    'email' => 'chef@demo.com',    'role' => 'chef'],
            ['name' => 'Demo Billing', 'email' => 'billing@demo.com', 'role' => 'billing'],
        ];

        foreach ($users as $userData) {
            $user = User::firstOrCreate(
                ['email' => $userData['email']],
                [
                    'name'      => $userData['name'],
                    'password'  => Hash::make('password'),
                    'role'      => $userData['role'],
                    'tenant_id' => $tenant->id,
                    'is_active' => true,
                ]
            );
            $user->assignRole($userData['role']);
        }
    }
}
