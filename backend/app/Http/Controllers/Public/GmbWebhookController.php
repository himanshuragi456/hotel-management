<?php

namespace App\Http\Controllers\Public;

use App\Http\Controllers\Controller;
use App\Models\GmbReview;
use App\Models\Tenant;
use App\Services\GmbAiService;
use App\Services\GmbService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class GmbWebhookController extends Controller
{
    public function __construct(
        private GmbService   $gmb,
        private GmbAiService $ai,
    ) {}

    public function handle(Request $request): \Illuminate\Http\JsonResponse
    {
        // Verify the Pub/Sub push JWT so only Google can call this endpoint
        if (!$this->verifyPubSubToken($request)) {
            Log::warning('GMB webhook: JWT verification failed', [
                'ip' => $request->ip(),
            ]);
            return response()->json(['status' => 'unauthorized'], 401);
        }

        $envelope = $request->json()->all();
        $message  = $envelope['message'] ?? null;

        if (!$message || empty($message['data'])) {
            return response()->json(['status' => 'ignored'], 200);
        }

        $payload = json_decode(base64_decode($message['data']), true);
        if (!$payload) {
            Log::warning('GMB webhook: could not decode Pub/Sub payload');
            return response()->json(['status' => 'ignored'], 200);
        }

        Log::info('GMB webhook received', ['type' => $payload['type'] ?? 'unknown']);

        $notificationType = $payload['type'] ?? null;
        $locationName     = $payload['location']['name'] ?? null;

        if (!in_array($notificationType, ['NEW_REVIEW', 'UPDATED_REVIEW']) || !$locationName) {
            return response()->json(['status' => 'ignored'], 200);
        }

        $tenant = Tenant::where('gmb_location_id', $locationName)->first();
        if (!$tenant) {
            Log::warning("GMB webhook: no tenant found for location {$locationName}");
            return response()->json(['status' => 'ok'], 200);
        }

        $this->gmb->fetchReviews($tenant);

        if ($tenant->gmb_auto_reply_enabled && $notificationType === 'NEW_REVIEW') {
            $reviewName = $payload['reviewId'] ?? null;
            if ($reviewName) {
                $review = GmbReview::where('tenant_id', $tenant->id)
                    ->where('google_review_id', $reviewName)
                    ->where('reply_status', 'none')
                    ->first();

                if ($review) {
                    $draft = $this->ai->generateReviewReply($tenant, $review);
                    if ($draft) {
                        $review->update(['reply_status' => 'pending_ai', 'ai_reply_draft' => $draft]);
                        $this->gmb->postReply($tenant, $review, $draft);
                    }
                }
            }
        }

        return response()->json(['status' => 'ok'], 200);
    }

    // -------------------------------------------------------------------------
    // Verify Google's Pub/Sub push JWT
    // -------------------------------------------------------------------------

    private function verifyPubSubToken(Request $request): bool
    {
        // In local dev, skip verification
        if (app()->environment('local')) {
            return true;
        }

        $authHeader = $request->header('Authorization');
        if (!$authHeader || !str_starts_with($authHeader, 'Bearer ')) {
            return false;
        }

        $jwt = substr($authHeader, 7);

        try {
            // Fetch Google's public certs
            $certs = Http::get('https://www.googleapis.com/oauth2/v1/certs')->json();

            // Decode JWT header to find which key to use
            $parts = explode('.', $jwt);
            if (count($parts) !== 3) return false;

            $header = json_decode(base64_decode(str_pad(strtr($parts[0], '-_', '+/'), strlen($parts[0]) % 4 == 0 ? strlen($parts[0]) : strlen($parts[0]) + 4 - strlen($parts[0]) % 4, '=')), true);
            $kid    = $header['kid'] ?? null;

            if (!$kid || !isset($certs[$kid])) return false;

            $cert    = $certs[$kid];
            $payload = json_decode(base64_decode(str_pad(strtr($parts[1], '-_', '+/'), strlen($parts[1]) % 4 == 0 ? strlen($parts[1]) : strlen($parts[1]) + 4 - strlen($parts[1]) % 4, '=')), true);

            // Validate expiry and audience
            if (($payload['exp'] ?? 0) < time()) return false;

            $expectedAudience = config('app.url') . '/api/webhooks/gmb-reviews';
            $audience         = $payload['aud'] ?? '';

            // Google Pub/Sub sets aud to the push endpoint URL
            if ($audience !== $expectedAudience) {
                // Also allow production URL
                $productionAudience = 'https://magicmanagement.dentask.in/api/webhooks/gmb-reviews';
                if ($audience !== $productionAudience) {
                    Log::warning('GMB webhook: audience mismatch', ['got' => $audience, 'expected' => $productionAudience]);
                    return false;
                }
            }

            // Verify the email is Google's service account for Pub/Sub
            $email = $payload['email'] ?? '';
            if (!str_ends_with($email, '.gserviceaccount.com') && $email !== 'noreply@google.com') {
                return false;
            }

            // Verify signature
            $pubkey = openssl_pkey_get_public($cert);
            if (!$pubkey) return false;

            $signingInput = $parts[0] . '.' . $parts[1];
            $signature    = base64_decode(str_pad(strtr($parts[2], '-_', '+/'), strlen($parts[2]) % 4 == 0 ? strlen($parts[2]) : strlen($parts[2]) + 4 - strlen($parts[2]) % 4, '='));

            return openssl_verify($signingInput, $signature, $pubkey, OPENSSL_ALGO_SHA256) === 1;

        } catch (\Exception $e) {
            Log::error('GMB webhook JWT verification error: ' . $e->getMessage());
            return false;
        }
    }
}
