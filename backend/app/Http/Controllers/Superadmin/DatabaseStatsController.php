<?php

namespace App\Http\Controllers\Superadmin;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Tenant;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class DatabaseStatsController extends Controller
{
    use ApiResponse;

    public function overview(): JsonResponse
    {
        $stats = [
            'total_tenants'       => Tenant::count(),
            'active_tenants'      => Tenant::where('status', 'active')->count(),
            'suspended_tenants'   => Tenant::where('status', 'suspended')->count(),
            'trial_tenants'       => Tenant::where('status', 'trial')->count(),
            'total_users'         => DB::table('users')->where('role', '!=', 'superadmin')->count(),
            'total_audit_logs'    => AuditLog::count(),
        ];

        return $this->success($stats);
    }

    public function tenantStats(Tenant $tenant): JsonResponse
    {
        $tables = ['users', 'audit_logs'];
        $stats = [];

        foreach ($tables as $table) {
            $count = DB::table($table)->where('tenant_id', $tenant->id)->count();
            $stats[$table] = $count;
        }

        return $this->success([
            'tenant' => $tenant->only(['id', 'name', 'email', 'status']),
            'records' => $stats,
        ]);
    }

    public function exportTenantData(Tenant $tenant): JsonResponse
    {
        $data = [
            'tenant'       => $tenant->toArray(),
            'modules'      => $tenant->modules?->toArray(),
            'subscription' => $tenant->subscription?->load('plan')->toArray(),
            'users'        => $tenant->users->map->only(['id', 'name', 'email', 'role', 'created_at'])->toArray(),
        ];

        AuditLog::record('tenant.data_exported', $tenant, [], ['exported_at' => now()]);

        return $this->success($data, 'Tenant data exported');
    }
}
