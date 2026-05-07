<?php

namespace App\Http\Controllers\Superadmin;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AuditLogController extends Controller
{
    use ApiResponse;

    public function index(Request $request): JsonResponse
    {
        $query = AuditLog::with(['user:id,name,email,role', 'tenant:id,name'])
            ->latest('created_at');

        if ($request->tenant_id) {
            $query->where('tenant_id', $request->tenant_id);
        }

        if ($request->user_id) {
            $query->where('user_id', $request->user_id);
        }

        if ($request->action) {
            $query->where('action', 'like', "%{$request->action}%");
        }

        if ($request->from) {
            $query->whereDate('created_at', '>=', $request->from);
        }

        if ($request->to) {
            $query->whereDate('created_at', '<=', $request->to);
        }

        $logs = $query->paginate(50);

        return $this->success($logs);
    }

    public function purge(Request $request): JsonResponse
    {
        $days = $request->input('older_than_days', 90);

        $deleted = AuditLog::where('created_at', '<', now()->subDays($days))->delete();

        AuditLog::record('audit_logs.purged', null, [], ['deleted_count' => $deleted, 'older_than_days' => $days]);

        return $this->success(['deleted' => $deleted], "Purged {$deleted} log entries older than {$days} days");
    }
}
