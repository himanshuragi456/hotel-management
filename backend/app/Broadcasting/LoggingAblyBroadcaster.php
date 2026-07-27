<?php

namespace App\Broadcasting;

use Illuminate\Broadcasting\Broadcasters\AblyBroadcaster;

/**
 * Wraps the stock Ably broadcaster so every API endpoint that broadcasts
 * over Ably — order updates, floor alerts, everything — logs a single
 * consistent line to laravel.log, without every controller having to
 * remember to log it themselves.
 */
class LoggingAblyBroadcaster extends AblyBroadcaster
{
    public function broadcast(array $channels, $event, array $payload = [])
    {
        $channelList = implode(', ', array_map(fn ($c) => (string) $c, $channels));

        try {
            parent::broadcast($channels, $event, $payload);
            logger()->info("Ably broadcast sent: {$event} on {$channelList}", $this->logContext($payload));
        } catch (\Throwable $e) {
            logger()->error("Ably broadcast failed: {$event} on {$channelList} — {$e->getMessage()}");
            throw $e;
        }
    }

    /**
     * Pull a few small, useful fields out of the payload for the log line
     * without dumping the whole (sometimes large) broadcast payload.
     */
    private function logContext(array $payload): array
    {
        return array_filter([
            'order_number' => $payload['order_number'] ?? null,
            'status'       => $payload['status'] ?? null,
            'kind'         => $payload['kind'] ?? null,
            'table_id'     => $payload['table_id'] ?? null,
        ], fn ($v) => $v !== null);
    }
}
