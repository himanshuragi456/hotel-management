<?php

namespace Database\Seeders;

use App\Models\SubscriptionPlan;
use Illuminate\Database\Seeder;

class SubscriptionPlansSeeder extends Seeder
{
    public function run(): void
    {
        $plans = [
            [
                'name'               => 'Restaurant Basic',
                'slug'               => 'restaurant-basic',
                'description'        => 'Menu, tables, orders, kitchen dashboard, billing',
                'price_monthly'      => 999,
                'price_yearly'       => 9990,
                'module_restaurant'  => true,
                'module_hotel'       => false,
                'module_feedback'    => false,
                'max_users'          => 5,
                'max_tables'         => 20,
                'max_rooms'          => 0,
                'features'           => ['Menu management', 'Table orders', 'Kitchen dashboard', 'Billing & invoices', 'PDF bills with UPI QR'],
            ],
            [
                'name'               => 'Hotel Basic',
                'slug'               => 'hotel-basic',
                'description'        => 'Room management, bookings, guest profiles, checkout',
                'price_monthly'      => 1499,
                'price_yearly'       => 14990,
                'module_restaurant'  => false,
                'module_hotel'       => true,
                'module_feedback'    => false,
                'max_users'          => 5,
                'max_tables'         => 0,
                'max_rooms'          => 30,
                'features'           => ['Room management', 'Guest profiles', 'Bookings calendar', 'Check-in/out', 'Occupancy reports'],
            ],
            [
                'name'               => 'Feedback Module',
                'slug'               => 'feedback',
                'description'        => 'QR feedback, Google review redirect, AI review suggestions',
                'price_monthly'      => 499,
                'price_yearly'       => 4990,
                'module_restaurant'  => false,
                'module_hotel'       => false,
                'module_feedback'    => true,
                'max_users'          => 2,
                'max_tables'         => 0,
                'max_rooms'          => 0,
                'features'           => ['QR code generation', 'Smart review routing', 'AI compliment suggestions', 'Feedback dashboard'],
            ],
            [
                'name'               => 'Restaurant + Feedback',
                'slug'               => 'restaurant-feedback',
                'description'        => 'Full restaurant operations with smart review collection',
                'price_monthly'      => 1299,
                'price_yearly'       => 12990,
                'module_restaurant'  => true,
                'module_hotel'       => false,
                'module_feedback'    => true,
                'max_users'          => 8,
                'max_tables'         => 30,
                'max_rooms'          => 0,
                'features'           => ['All Restaurant Basic features', 'All Feedback features'],
            ],
            [
                'name'               => 'Complete Suite',
                'slug'               => 'combo',
                'description'        => 'All 3 modules — Restaurant, Hotel & Feedback',
                'price_monthly'      => 2499,
                'price_yearly'       => 24990,
                'module_restaurant'  => true,
                'module_hotel'       => true,
                'module_feedback'    => true,
                'max_users'          => 20,
                'max_tables'         => 50,
                'max_rooms'          => 50,
                'features'           => ['All Restaurant features', 'All Hotel features', 'All Feedback features', 'Priority support'],
            ],
        ];

        foreach ($plans as $plan) {
            SubscriptionPlan::firstOrCreate(['slug' => $plan['slug']], $plan);
        }
    }
}
