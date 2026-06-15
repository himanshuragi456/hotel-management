<?php

namespace App\Services;

use App\Events\TableActivity;
use App\Models\AppNotification;
use App\Models\User;

/**
 * Central fan-out for front-of-house alerts.
 *
 * Each alert is (a) written to app_notifications for every targeted user so a
 * late login still sees what was missed, and (b) broadcast over Pusher as a
 * TableActivity event so any open dashboard rings instantly. The client maps
 * `kind` → sound file and decides whether to ring.
 *
 * Targeting is by the users.role column (waiter | chef | billing | owner),
 * scoped to the tenant. A specific waiter can additionally be addressed.
 */
class NotificationService
{
    /**
     * Dispatch an alert to all users of the given roles in a tenant.
     *
     * @param array $roles  e.g. ['billing'] or ['chef'] or ['billing', 'owner']
     */
    public function toRoles(
        int $tenantId,
        array $roles,
        string $kind,
        string $title,
        ?string $body = null,
        array $data = [],
        ?int $tableId = null,
        ?int $waiterId = null,
    ): void {
        $userIds = User::where('tenant_id', $tenantId)
            ->whereIn('role', $roles)
            ->where('is_active', true)
            ->pluck('id');

        $this->deliver($tenantId, $userIds->all(), $kind, $title, $body, $data, $tableId, $waiterId);
    }

    /**
     * Dispatch an alert to all billers, plus the assigned waiter if there is one.
     * Used for floor signals (waiter call, bill request, payment claimed).
     */
    public function toFloor(
        int $tenantId,
        string $kind,
        string $title,
        ?string $body = null,
        array $data = [],
        ?int $tableId = null,
        ?int $waiterId = null,
    ): void {
        $query = User::where('tenant_id', $tenantId)
            ->where('is_active', true)
            ->where(function ($q) use ($waiterId) {
                $q->where('role', 'billing');
                if ($waiterId) {
                    $q->orWhere('id', $waiterId);
                }
            });

        $this->deliver($tenantId, $query->pluck('id')->all(), $kind, $title, $body, $data, $tableId, $waiterId);
    }

    /**
     * Write durable rows + broadcast a single realtime event.
     *
     * @param int[] $userIds
     */
    private function deliver(
        int $tenantId,
        array $userIds,
        string $kind,
        string $title,
        ?string $body,
        array $data,
        ?int $tableId,
        ?int $waiterId,
    ): void {
        $now = now();
        $rows = [];
        foreach ($userIds as $uid) {
            $rows[] = [
                'tenant_id'  => $tenantId,
                'user_id'    => $uid,
                'type'       => $kind,
                'title'      => $title,
                'body'       => $body,
                'data'       => $data ? json_encode($data) : null,
                'read_at'    => null,
                'created_at' => $now,
                'updated_at' => $now,
            ];
        }

        if ($rows) {
            AppNotification::insert($rows);
        }

        // Realtime ring — best-effort, never block the originating action.
        try {
            broadcast(new TableActivity(
                tenantId: $tenantId,
                kind: $kind,
                payload: array_merge(['title' => $title, 'body' => $body], $data),
                tableId: $tableId,
                waiterId: $waiterId,
            ));
        } catch (\Throwable $e) {
            // broadcasting is best-effort
        }
    }
}
