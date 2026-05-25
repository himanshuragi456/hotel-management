<?php

namespace App\Services;

use App\Models\GmbPost;
use App\Models\GmbReview;
use App\Models\Tenant;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class GmbService
{
    private const OAUTH_TOKEN_URL     = 'https://oauth2.googleapis.com/token';
    private const ACCOUNTS_URL        = 'https://mybusinessaccountmanagement.googleapis.com/v1/accounts';
    private const BUSINESS_INFO_BASE  = 'https://mybusinessbusinessinformation.googleapis.com/v1';
    private const REVIEWS_BASE        = 'https://mybusiness.googleapis.com/v4';
    private const POSTS_BASE          = 'https://mybusiness.googleapis.com/v4';
    private const NOTIFICATIONS_BASE  = 'https://mybusiness.googleapis.com/v4';

    // -------------------------------------------------------------------------
    // OAuth helpers
    // -------------------------------------------------------------------------

    public static function buildAuthUrl(): string
    {
        $params = http_build_query([
            'client_id'     => config('services.google.client_id'),
            'redirect_uri'  => config('services.google.redirect_uri'),
            'response_type' => 'code',
            'scope'         => 'https://www.googleapis.com/auth/business.manage',
            'access_type'   => 'offline',
            'prompt'        => 'consent',
        ]);

        return "https://accounts.google.com/o/oauth2/v2/auth?{$params}";
    }

    public static function exchangeCode(string $code): array
    {
        $response = Http::asForm()->post(self::OAUTH_TOKEN_URL, [
            'code'          => $code,
            'client_id'     => config('services.google.client_id'),
            'client_secret' => config('services.google.client_secret'),
            'redirect_uri'  => config('services.google.redirect_uri'),
            'grant_type'    => 'authorization_code',
        ]);

        if ($response->failed()) {
            throw new \RuntimeException('Google token exchange failed: ' . $response->body());
        }

        return $response->json();
    }

    public function refreshTokenIfNeeded(Tenant $tenant): void
    {
        if (!$tenant->gmb_refresh_token) return;

        // Refresh 5 minutes before expiry
        if ($tenant->gmb_token_expires_at && $tenant->gmb_token_expires_at->gt(now()->addMinutes(5))) {
            return;
        }

        $response = Http::asForm()->post(self::OAUTH_TOKEN_URL, [
            'client_id'     => config('services.google.client_id'),
            'client_secret' => config('services.google.client_secret'),
            'refresh_token' => $tenant->gmb_refresh_token,
            'grant_type'    => 'refresh_token',
        ]);

        if ($response->failed()) {
            Log::error("GMB token refresh failed for tenant {$tenant->id}: " . $response->body());
            return;
        }

        $data = $response->json();
        $tenant->update([
            'gmb_access_token'    => $data['access_token'],
            'gmb_token_expires_at' => now()->addSeconds($data['expires_in'] ?? 3600),
        ]);
    }

    private function authHeader(Tenant $tenant): array
    {
        $this->refreshTokenIfNeeded($tenant);
        return ['Authorization' => 'Bearer ' . $tenant->gmb_access_token];
    }

    // -------------------------------------------------------------------------
    // Account & Location discovery
    // -------------------------------------------------------------------------

    public function listAccounts(Tenant $tenant): array
    {
        $response = Http::withHeaders($this->authHeader($tenant))
            ->get(self::ACCOUNTS_URL);

        if ($response->failed()) {
            throw new \RuntimeException('Failed to list GMB accounts: ' . $response->body());
        }

        return $response->json('accounts', []);
    }

    public function listLocations(Tenant $tenant, string $accountId): array
    {
        $url = self::BUSINESS_INFO_BASE . "/{$accountId}/locations";
        $response = Http::withHeaders($this->authHeader($tenant))
            ->get($url, [
                'readMask' => 'name,title,storefrontAddress,websiteUri,phoneNumbers,placeId',
            ]);

        if ($response->failed()) {
            throw new \RuntimeException('Failed to list GMB locations: ' . $response->body());
        }

        return $response->json('locations', []);
    }

    // -------------------------------------------------------------------------
    // Reviews
    // -------------------------------------------------------------------------

    public function fetchReviews(Tenant $tenant): array
    {
        if (!$tenant->gmb_location_id) return [];

        $url = self::REVIEWS_BASE . "/{$tenant->gmb_location_id}/reviews";
        $response = Http::withHeaders($this->authHeader($tenant))->get($url, ['pageSize' => 50]);

        if ($response->failed()) {
            Log::error("GMB fetchReviews failed for tenant {$tenant->id}: " . $response->body());
            return [];
        }

        $reviews = $response->json('reviews', []);
        $saved   = 0;

        foreach ($reviews as $r) {
            $googleId = $r['reviewId'] ?? null;
            if (!$googleId) continue;

            $rating = match($r['starRating'] ?? '') {
                'ONE'   => 1, 'TWO'   => 2, 'THREE' => 3,
                'FOUR'  => 4, 'FIVE'  => 5, default => null,
            };

            GmbReview::updateOrCreate(
                ['google_review_id' => $googleId],
                [
                    'tenant_id'      => $tenant->id,
                    'reviewer_name'  => $r['reviewer']['displayName'] ?? null,
                    'reviewer_photo' => $r['reviewer']['profilePhotoUrl'] ?? null,
                    'star_rating'    => $rating,
                    'comment'        => $r['comment'] ?? null,
                    'review_time'    => $r['createTime'] ?? now(),
                    'reply_text'     => $r['reviewReply']['comment'] ?? null,
                    'reply_time'     => $r['reviewReply']['updateTime'] ?? null,
                    'reply_status'   => isset($r['reviewReply']) ? 'posted' : 'none',
                ]
            );
            $saved++;
        }

        $tenant->update(['gmb_reviews_last_fetched_at' => now()]);
        return ['synced' => $saved];
    }

    public function postReply(Tenant $tenant, GmbReview $review, string $replyText): bool
    {
        $url = self::REVIEWS_BASE . "/{$review->google_review_id}/reply";
        $response = Http::withHeaders($this->authHeader($tenant))
            ->put($url, ['comment' => $replyText]);

        if ($response->failed()) {
            Log::error("GMB postReply failed for review {$review->id}: " . $response->body());
            $review->update(['reply_status' => 'failed']);
            return false;
        }

        $review->update([
            'reply_text'   => $replyText,
            'reply_status' => 'posted',
            'replied_at'   => now(),
        ]);

        return true;
    }

    // -------------------------------------------------------------------------
    // Posts
    // -------------------------------------------------------------------------

    public function publishPost(Tenant $tenant, GmbPost $post): bool
    {
        if (!$tenant->gmb_location_id) return false;

        $url = self::POSTS_BASE . "/{$tenant->gmb_location_id}/localPosts";

        $body = [
            'languageCode' => 'en',
            'summary'      => $post->summary,
            'topicType'    => $post->post_type,
        ];

        if ($post->call_to_action_type && $post->call_to_action_url) {
            $body['callToAction'] = [
                'actionType' => $post->call_to_action_type,
                'url'        => $post->call_to_action_url,
            ];
        }

        if ($post->post_type === 'EVENT' && $post->event_title) {
            $body['event'] = [
                'title'    => $post->event_title,
                'schedule' => [
                    'startDate' => ['year' => $post->event_start_date?->year, 'month' => $post->event_start_date?->month, 'day' => $post->event_start_date?->day],
                    'endDate'   => ['year' => $post->event_end_date?->year,   'month' => $post->event_end_date?->month,   'day' => $post->event_end_date?->day],
                ],
            ];
        }

        if ($post->post_type === 'OFFER' && $post->offer_coupon_code) {
            $body['offer'] = ['couponCode' => $post->offer_coupon_code];
        }

        $response = Http::withHeaders($this->authHeader($tenant))->post($url, $body);

        if ($response->failed()) {
            Log::error("GMB publishPost failed for post {$post->id}: " . $response->body());
            return false;
        }

        $post->update([
            'status'           => 'published',
            'google_post_name' => $response->json('name'),
            'published_at'     => now(),
        ]);

        return true;
    }

    // -------------------------------------------------------------------------
    // Pub/Sub notification subscription
    // -------------------------------------------------------------------------

    public function registerPubSubNotifications(Tenant $tenant): bool
    {
        if (!$tenant->gmb_location_id) return false;

        $topicName = config('services.google.pubsub_topic');
        if (!$topicName) return false;

        $url      = self::NOTIFICATIONS_BASE . "/{$tenant->gmb_account_id}/notificationSetting";
        $response = Http::withHeaders($this->authHeader($tenant))
            ->patch($url, [
                'name'              => "{$tenant->gmb_account_id}/notificationSetting",
                'pubsubTopic'       => $topicName,
                'notificationTypes' => ['NEW_REVIEW', 'UPDATED_REVIEW'],
            ]);

        if ($response->failed()) {
            Log::warning("GMB Pub/Sub registration failed for tenant {$tenant->id}: " . $response->body());
            return false;
        }

        return true;
    }
}
