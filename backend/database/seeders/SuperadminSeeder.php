<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class SuperadminSeeder extends Seeder
{
    public function run(): void
    {
        $superadmin = User::firstOrCreate(
            ['email' => 'superadmin@hotel.com'],
            [
                'name'      => 'Super Admin',
                'password'  => 'm@g1cManag3ment',
                'role'      => 'superadmin',
                'is_active' => true,
            ]
        );

        $superadmin->assignRole('superadmin');
    }
}
