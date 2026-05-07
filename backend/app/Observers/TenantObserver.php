<?php

namespace App\Observers;

use App\Models\AuditLog;
use App\Models\Tenant;

class TenantObserver
{
    public function updated(Tenant $tenant): void
    {
        if ($tenant->wasChanged('status')) {
            AuditLog::record(
                'tenant.status_changed',
                $tenant,
                ['status' => $tenant->getOriginal('status')],
                ['status' => $tenant->status]
            );
        }
    }
}
