<?php

namespace App\Http\Controllers\Owner\Feedback;

use App\Http\Controllers\Controller;
use App\Models\GmbPost;
use App\Models\GmbReview;
use App\Models\Tenant;
use App\Services\GmbAiService;
use App\Services\GmbService;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class GmbController extends Controller
{
    use ApiResponse;

    public function __construct(
        private GmbService   $gmb,
        private GmbAiService $ai,
    ) {}

    // -------------------------------------------------------------------------
    // OAuth connect flow
    // -------------------------------------------------------------------------

    public function connectRedirect(Request $request): JsonResponse
    {
        $url = GmbService::buildAuthUrl($request->_tenant_id);
        return $this->success(['url' => $url]);
    }

    public function connectCallback(Request $request): \Illuminate\Http\RedirectResponse
    {
        $code     = $request->query('code');
        $tenantId = $request->query('state');

        if (!$code || !$tenantId) {
            return redirect(config('app.frontend_url') . '/owner/feedback/setup?gmb_error=missing_code');
        }

        try {
            $tokens = GmbService::exchangeCode($code);
        } catch (\Exception $e) {
            return redirect(config('app.frontend_url') . '/owner/feedback/setup?gmb_error=token_exchange_failed');
        }

        $tenant = Tenant::find($tenantId);
        if (!$tenant) {
            return redirect(config('app.frontend_url') . '/owner/feedback/setup?gmb_error=tenant_not_found');
        }

        $tenant->update([
            'gmb_access_token'    => $tokens['access_token'],
            'gmb_refresh_token'   => $tokens['refresh_token'] ?? $tenant->gmb_refresh_token,
            'gmb_token_expires_at' => now()->addSeconds($tokens['expires_in'] ?? 3600),
        ]);

        // Fetch accounts so owner can pick a location
        return redirect(config('app.frontend_url') . '/owner/feedback/setup?gmb_connected=1');
    }

    public function disconnect(Request $request): JsonResponse
    {
        $tenant = Tenant::find($request->_tenant_id);
        $tenant->update([
            'gmb_access_token'    => null,
            'gmb_refresh_token'   => null,
            'gmb_token_expires_at' => null,
            'gmb_account_id'      => null,
            'gmb_location_id'     => null,
            'gmb_location_name'   => null,
        ]);
        return $this->success(null, 'Google Business account disconnected.');
    }

    // -------------------------------------------------------------------------
    // Account & Location selection
    // -------------------------------------------------------------------------

    public function listAccounts(Request $request): JsonResponse
    {
        $tenant = Tenant::find($request->_tenant_id);
        if (!$tenant->gmb_access_token) return $this->error('Google account not connected.', 400);

        try {
            $accounts = $this->gmb->listAccounts($tenant);
        } catch (\Exception $e) {
            return $this->error('Failed to fetch accounts: ' . $e->getMessage(), 500);
        }

        $mapped = array_map(fn($a) => [
            'id'   => $a['name'],
            'name' => $a['accountName'] ?? $a['name'],
            'type' => $a['type'] ?? null,
        ], $accounts);

        return $this->success($mapped);
    }

    public function listLocations(Request $request): JsonResponse
    {
        $request->validate(['account_id' => 'required|string']);
        $tenant = Tenant::find($request->_tenant_id);

        try {
            $locations = $this->gmb->listLocations($tenant, $request->account_id);
        } catch (\Exception $e) {
            return $this->error('Failed to fetch locations: ' . $e->getMessage(), 500);
        }

        $mapped = array_map(fn($l) => [
            'id'       => $l['name'],
            'title'    => $l['title'] ?? $l['name'],
            'address'  => $l['storefrontAddress']['addressLines'][0] ?? null,
            'place_id' => $l['metadata']['placeId'] ?? null,
        ], $locations);

        return $this->success($mapped);
    }

    public function selectLocation(Request $request): JsonResponse
    {
        $data = $request->validate([
            'account_id'    => 'required|string',
            'location_id'   => 'required|string',
            'location_name' => 'required|string',
            'place_id'      => 'nullable|string',
        ]);

        $tenant = Tenant::find($request->_tenant_id);

        $reviewUrl = $data['place_id']
            ? "https://search.google.com/local/writereview?placeid={$data['place_id']}"
            : $tenant->google_review_url;

        $tenant->update([
            'gmb_account_id'   => $data['account_id'],
            'gmb_location_id'  => $data['location_id'],
            'gmb_location_name' => $data['location_name'],
            'google_place_id'  => $data['place_id'] ?? $tenant->google_place_id,
            'google_review_url' => $reviewUrl,
        ]);

        // Register Pub/Sub notifications (non-blocking — logs failure)
        try {
            $this->gmb->registerPubSubNotifications($tenant->fresh());
        } catch (\Exception $e) {
            // Not fatal — reviews can still be polled manually
        }

        return $this->success([
            'location_name'    => $data['location_name'],
            'google_review_url' => $reviewUrl,
        ], 'Location connected successfully.');
    }

    // -------------------------------------------------------------------------
    // GMB connection status
    // -------------------------------------------------------------------------

    public function status(Request $request): JsonResponse
    {
        $tenant = Tenant::find($request->_tenant_id);

        return $this->success([
            'connected'            => (bool) $tenant->gmb_access_token,
            'location_name'        => $tenant->gmb_location_name,
            'location_id'          => $tenant->gmb_location_id,
            'google_review_url'    => $tenant->google_review_url,
            'auto_reply_enabled'   => (bool) $tenant->gmb_auto_reply_enabled,
            'auto_reply_tone'      => $tenant->gmb_auto_reply_tone ?? 'professional',
            'reviews_last_fetched' => $tenant->gmb_reviews_last_fetched_at?->toIso8601String(),
        ]);
    }

    public function updateSettings(Request $request): JsonResponse
    {
        $data = $request->validate([
            'auto_reply_enabled' => 'sometimes|boolean',
            'auto_reply_tone'    => 'sometimes|in:professional,friendly,formal,enthusiastic',
        ]);

        $tenant = Tenant::find($request->_tenant_id);
        $tenant->update([
            'gmb_auto_reply_enabled' => $data['auto_reply_enabled'] ?? $tenant->gmb_auto_reply_enabled,
            'gmb_auto_reply_tone'    => $data['auto_reply_tone']    ?? $tenant->gmb_auto_reply_tone,
        ]);

        return $this->success(null, 'Settings updated.');
    }

    // -------------------------------------------------------------------------
    // Reviews
    // -------------------------------------------------------------------------

    public function syncReviews(Request $request): JsonResponse
    {
        $tenant = Tenant::find($request->_tenant_id);
        if (!$tenant->gmb_location_id) return $this->error('No GMB location connected.', 400);

        $result = $this->gmb->fetchReviews($tenant);
        return $this->success($result, 'Reviews synced.');
    }

    public function listReviews(Request $request): JsonResponse
    {
        $tenantId = $request->_tenant_id;

        $reviews = GmbReview::where('tenant_id', $tenantId)
            ->when($request->reply_status, fn($q) => $q->where('reply_status', $request->reply_status))
            ->when($request->rating, fn($q) => $q->where('star_rating', $request->rating))
            ->orderByDesc('review_time')
            ->paginate(20);

        return $this->success($reviews);
    }

    public function generateAiReply(Request $request, GmbReview $review): JsonResponse
    {
        if ($review->tenant_id !== $request->_tenant_id) return $this->notFound();

        $tenant = Tenant::find($request->_tenant_id);
        $draft  = $this->ai->generateReviewReply($tenant, $review);

        if (!$draft) return $this->error('AI reply generation failed. Please try again.', 500);

        $review->update(['ai_reply_draft' => $draft, 'reply_status' => 'ai_generated']);
        return $this->success(['draft' => $draft]);
    }

    public function postReply(Request $request, GmbReview $review): JsonResponse
    {
        if ($review->tenant_id !== $request->_tenant_id) return $this->notFound();

        $data = $request->validate(['reply_text' => 'required|string|max:4096']);
        $tenant = Tenant::find($request->_tenant_id);

        $ok = $this->gmb->postReply($tenant, $review, $data['reply_text']);
        if (!$ok) return $this->error('Failed to post reply to Google. Please try again.', 500);

        return $this->success(['reply_text' => $data['reply_text']], 'Reply posted successfully.');
    }

    // -------------------------------------------------------------------------
    // GMB Posts
    // -------------------------------------------------------------------------

    public function listPosts(Request $request): JsonResponse
    {
        $posts = GmbPost::where('tenant_id', $request->_tenant_id)
            ->when($request->status, fn($q) => $q->where('status', $request->status))
            ->orderByDesc('suggested_at')
            ->get();

        return $this->success($posts);
    }

    public function generatePostSuggestions(Request $request): JsonResponse
    {
        $tenant = Tenant::find($request->_tenant_id);
        $posts  = $this->ai->generateWeeklyPostSuggestions($tenant);

        if (empty($posts)) return $this->error('Failed to generate post suggestions. Please try again.', 500);

        return $this->success($posts, count($posts) . ' post suggestions generated.');
    }

    public function publishPost(Request $request, GmbPost $post): JsonResponse
    {
        if ($post->tenant_id !== $request->_tenant_id) return $this->notFound();

        $tenant = Tenant::find($request->_tenant_id);
        if (!$tenant->gmb_location_id) return $this->error('No GMB location connected.', 400);

        $ok = $this->gmb->publishPost($tenant, $post);
        if (!$ok) return $this->error('Failed to publish post to Google. Please try again.', 500);

        return $this->success(['status' => 'published'], 'Post published to Google Business Profile.');
    }

    public function dismissPost(Request $request, GmbPost $post): JsonResponse
    {
        if ($post->tenant_id !== $request->_tenant_id) return $this->notFound();

        $post->update(['status' => 'dismissed']);
        return $this->success(null, 'Post dismissed.');
    }

    public function updatePost(Request $request, GmbPost $post): JsonResponse
    {
        if ($post->tenant_id !== $request->_tenant_id) return $this->notFound();
        if ($post->status === 'published') return $this->error('Published posts cannot be edited.', 400);

        $data = $request->validate([
            'summary'              => 'sometimes|string|max:1500',
            'call_to_action_type'  => 'sometimes|nullable|string',
            'call_to_action_url'   => 'sometimes|nullable|url',
            'event_title'          => 'sometimes|nullable|string',
            'event_start_date'     => 'sometimes|nullable|date',
            'event_end_date'       => 'sometimes|nullable|date',
            'offer_coupon_code'    => 'sometimes|nullable|string',
        ]);

        $post->update($data);
        return $this->success($post->fresh());
    }
}
