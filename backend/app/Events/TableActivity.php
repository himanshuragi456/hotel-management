<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

/**
 * A floor/table activity that the front-of-house (biller / waiter) should be
 * alerted to in real-time with a sound — distinct from the kitchen order flow
 * carried by OrderStatusUpdated.
 *
 * Examples: customer called a waiter, requested the bill, claimed they paid via
 * UPI, or a Magic Tables order needs payment confirmation.
 *
 * Broadcasts on the existing per-tenant kitchen channel so every open
 * biller/waiter/chef dashboard already subscribed receives it instantly; the
 * client decides (by role + kind + waiter assignment) whether to ring + show.
 * The durable copy lives in app_notifications (see NotificationService) so a
 * late login still surfaces what was missed.
 */
class TableActivity implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    /**
     * @param string   $kind       waiter_called | bill_requested | payment_claimed | mt_order | mt_paid | new_order | new_kot
     * @param array    $payload    display data (title, body, table number, amount, etc.)
     * @param int|null $tableId    restaurant table involved, if any
     * @param int|null $waiterId   assigned waiter, when the alert is waiter-targeted
     * @param int|null $excludeUserId  user who triggered the action — clients for
     *   this user skip the ring (they don't need to be alerted about their own action)
     */
    public function __construct(
        public int $tenantId,
        public string $kind,
        public array $payload = [],
        public ?int $tableId = null,
        public ?int $waiterId = null,
        public ?int $excludeUserId = null,
    ) {}

    public function broadcastOn(): array
    {
        return [new Channel("tenant.{$this->tenantId}.kitchen")];
    }

    public function broadcastAs(): string
    {
        return 'table.activity';
    }

    public function broadcastWith(): array
    {
        return [
            'kind'            => $this->kind,
            'table_id'        => $this->tableId,
            'waiter_id'       => $this->waiterId,
            'exclude_user_id' => $this->excludeUserId,
            'payload'         => $this->payload,
            'at'              => now()->toIso8601String(),
        ];
    }
}
