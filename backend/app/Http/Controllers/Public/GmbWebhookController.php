<?php

namespace App\Http\Controllers\Public;

use App\Http\Controllers\Controller;
use App\Models\GmbReview;
use App\Models\Tenant;
use App\Services\GmbAiService;
use App\Services\GmbService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class GmbWebhookController extends Controller
{
    public function __construct(
        private GmbService   $gmb,
        private GmbAiService $ai,
    ) {}

    public function handle(Request $request): \Illuminate\Http\JsonResponse
    {
        // Pub/Sub sends a JSON envelope with a base64-encoded message
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

        // Find the tenant that owns this location
        $tenant = Tenant::where('gmb_location_id', $locationName)->first();
        if (!$tenant) {
            Log::warning("GMB webhook: no tenant found for location {$locationName}");
            return response()->json(['status' => 'ok'], 200);
        }

        // Sync reviews to pick up the new/updated one
        $this->gmb->fetchReviews($tenant);

        // If auto-reply is enabled and this is a new review, generate and post AI reply
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
}
