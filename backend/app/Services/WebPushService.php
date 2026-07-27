<?php

namespace App\Services;

use App\Models\PushSubscription;
use Illuminate\Support\Facades\Log;
use Minishlink\WebPush\Subscription;
use Minishlink\WebPush\WebPush;

/**
 * Sends OS-level push notifications (Web Push / VAPID) to users' registered
 * devices, so a sleeping or backgrounded phone still rings for a new order.
 * This is the durable, screen-off layer; the in-app Ably sound is the
 * foreground layer. Both are driven from NotificationService.
 *
 * Best-effort: a failed push never blocks the originating action. Dead
 * subscriptions (browser returns 404/410 Gone) are pruned automatically.
 */
class WebPushService
{
    /**
     * Push a notification to every device belonging to the given users.
     *
     * @param int[] $userIds
     */
    public function sendToUsers(array $userIds, string $title, ?string $body, array $data = []): void
    {
        if (empty($userIds) || ! config('webpush.public_key') || ! config('webpush.private_key')) {
            return;
        }

        $subs = PushSubscription::whereIn('user_id', $userIds)->get();
        if ($subs->isEmpty()) {
            return;
        }

        try {
            $webPush = new WebPush([
                'VAPID' => [
                    'subject'    => config('webpush.subject'),
                    'publicKey'  => config('webpush.public_key'),
                    'privateKey' => config('webpush.private_key'),
                ],
            ]);

            $payload = json_encode([
                'title' => $title,
                'body'  => $body,
                'kind'  => $data['kind'] ?? null,
                'data'  => $data,
            ]);

            foreach ($subs as $sub) {
                $webPush->queueNotification(
                    Subscription::create([
                        'endpoint'        => $sub->endpoint,
                        'publicKey'       => $sub->public_key,
                        'authToken'       => $sub->auth_token,
                        'contentEncoding' => $sub->content_encoding ?: 'aesgcm',
                    ]),
                    $payload
                );
            }

            // flush() returns a report per subscription; drop the dead ones.
            foreach ($webPush->flush() as $report) {
                $endpoint = $report->getRequest()->getUri()->__toString();
                if (! $report->isSuccess() && $report->isSubscriptionExpired()) {
                    PushSubscription::where('endpoint_hash', hash('sha256', $endpoint))->delete();
                }
            }
        } catch (\Throwable $e) {
            Log::warning('WebPush send failed: ' . $e->getMessage());
        }
    }
}
