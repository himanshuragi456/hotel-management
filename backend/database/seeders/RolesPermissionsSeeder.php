<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Role;
use Spatie\Permission\Models\Permission;

class RolesPermissionsSeeder extends Seeder
{
    public function run(): void
    {
        app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();

        $permissions = [
            // Tenant management
            'tenant.view', 'tenant.create', 'tenant.edit', 'tenant.delete',
            // Users
            'user.view', 'user.create', 'user.edit', 'user.delete',
            // Menu
            'menu.view', 'menu.create', 'menu.edit', 'menu.delete',
            // Orders
            'order.view', 'order.create', 'order.edit', 'order.delete',
            // Kitchen
            'kitchen.view', 'kitchen.update_status',
            // Tables
            'table.view', 'table.create', 'table.edit', 'table.delete',
            // Billing
            'billing.view', 'billing.create', 'billing.edit',
            // Rooms
            'room.view', 'room.create', 'room.edit', 'room.delete',
            // Bookings
            'booking.view', 'booking.create', 'booking.edit', 'booking.delete',
            // Reports
            'report.view', 'report.export',
            // Feedback
            'feedback.view', 'feedback.manage',
            // Subscriptions
            'subscription.view', 'subscription.manage',
        ];

        foreach ($permissions as $perm) {
            Permission::firstOrCreate(['name' => $perm, 'guard_name' => 'api']);
        }

        $roles = [
            'superadmin' => Permission::all()->pluck('name')->toArray(),
            'owner'      => [
                'user.view', 'user.create', 'user.edit', 'user.delete',
                'menu.view', 'menu.create', 'menu.edit', 'menu.delete',
                'order.view', 'order.edit',
                'table.view', 'table.create', 'table.edit', 'table.delete',
                'billing.view', 'billing.create', 'billing.edit',
                'room.view', 'room.create', 'room.edit', 'room.delete',
                'booking.view', 'booking.create', 'booking.edit', 'booking.delete',
                'report.view', 'report.export',
                'feedback.view', 'feedback.manage',
                'kitchen.view',
            ],
            'waiter'  => ['menu.view', 'order.view', 'order.create', 'table.view'],
            'chef'    => ['kitchen.view', 'kitchen.update_status', 'order.view'],
            'billing' => ['billing.view', 'billing.create', 'billing.edit', 'order.view', 'booking.view'],
            'customer'=> ['menu.view', 'order.create'],
        ];

        foreach ($roles as $roleName => $rolePermissions) {
            $role = Role::firstOrCreate(['name' => $roleName, 'guard_name' => 'api']);
            $role->syncPermissions($rolePermissions);
        }
    }
}
