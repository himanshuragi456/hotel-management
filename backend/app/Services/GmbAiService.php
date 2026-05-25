<?php

namespace App\Services;

use App\Models\GmbPost;
use App\Models\GmbReview;
use App\Models\Tenant;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class GmbAiService
{
    private const API_URL = 'https://api.openai.com/v1/chat/completions';
    private const MODEL   = 'gpt-4o-mini';

    private function chat(array $messages, int $maxTokens = 300): ?string
    {
        $apiKey = config('services.openai.api_key');
        if (!$apiKey) {
            Log::warning('OpenAI API key not configured');
            return null;
        }

        $response = Http::withToken($apiKey)
            ->timeout(30)
            ->post(self::API_URL, [
                'model'      => self::MODEL,
                'messages'   => $messages,
                'max_tokens' => $maxTokens,
                'temperature' => 0.7,
            ]);

        if ($response->failed()) {
            Log::error('OpenAI request failed: ' . $response->body());
            return null;
        }

        return $response->json('choices.0.message.content');
    }

    public function generateReviewReply(Tenant $tenant, GmbReview $review): ?string
    {
        $tone = $tenant->gmb_auto_reply_tone ?? 'professional';
        $stars = $review->star_rating;
        $comment = $review->comment ? "Customer comment: \"{$review->comment}\"" : "No comment left.";

        $toneGuide = match($tone) {
            'friendly'     => 'warm, friendly, and conversational',
            'formal'       => 'formal and corporate',
            'enthusiastic' => 'enthusiastic and energetic',
            default        => 'professional and courteous',
        };

        $prompt = <<<PROMPT
You are writing a Google review reply on behalf of "{$tenant->name}", a restaurant/hotel.

Review details:
- Star rating: {$stars}/5
- {$comment}

Write a {$toneGuide} reply that:
- Is 2-4 sentences max
- Addresses the specific feedback if a comment was left
- Thanks the reviewer genuinely (don't use "Dear [name]")
- For 4-5 stars: expresses gratitude and invites them back
- For 1-3 stars: apologizes sincerely, acknowledges the issue, and asks them to reach out directly
- Never uses generic filler phrases like "We hope to see you soon!"
- Does NOT include any placeholders or brackets

Reply only with the response text, nothing else.
PROMPT;

        return $this->chat([
            ['role' => 'system', 'content' => 'You write concise, genuine Google review replies for hospitality businesses.'],
            ['role' => 'user',   'content' => $prompt],
        ], 200);
    }

    public function generateWeeklyPostSuggestions(Tenant $tenant): array
    {
        $businessType = $tenant->business_domain ?? 'restaurant';
        $name         = $tenant->name;
        $city         = $tenant->city ?? 'the local area';

        $prompt = <<<PROMPT
You are a local SEO expert creating Google Business Profile post suggestions for "{$name}", a {$businessType} in {$city}.

Generate exactly 3 post suggestions that will improve their local search ranking and attract customers.
Each suggestion should be for a different post type: one STANDARD update, one OFFER, one EVENT.

Format as a JSON array with exactly 3 objects. Each object must have:
- "post_type": "STANDARD" | "OFFER" | "EVENT"
- "topic": short label (e.g. "Weekend Special", "Happy Hour Offer", "Live Music Night")
- "summary": the post text (60-150 words, engaging, with relevant keywords for local SEO)
- "call_to_action_type": "LEARN_MORE" | "ORDER" | "BOOK" | "CALL" | "SHOP" (pick the most relevant)
- "event_title": (only for EVENT type, else null)
- "event_start_date": (only for EVENT, format YYYY-MM-DD, set 7 days from today, else null)
- "event_end_date": (only for EVENT, format YYYY-MM-DD, set 8 days from today, else null)
- "offer_coupon_code": (only for OFFER, a simple code like "SAVE10", else null)

Today is {$this->todayDate()}. Make the content feel timely and relevant to this week.

Return only the raw JSON array, no markdown, no explanation.
PROMPT;

        $raw = $this->chat([
            ['role' => 'system', 'content' => 'You are a local SEO and Google Business Profile expert. Return only valid JSON.'],
            ['role' => 'user',   'content' => $prompt],
        ], 800);

        if (!$raw) return [];

        // Strip markdown code fences if model wraps in them
        $raw = preg_replace('/^```(?:json)?\s*/i', '', trim($raw));
        $raw = preg_replace('/\s*```$/', '', $raw);

        $suggestions = json_decode($raw, true);
        if (!is_array($suggestions)) {
            Log::error('GMB AI post suggestions returned invalid JSON: ' . $raw);
            return [];
        }

        $saved = [];
        foreach ($suggestions as $s) {
            $saved[] = GmbPost::create([
                'tenant_id'            => $tenant->id,
                'post_type'            => $s['post_type'] ?? 'STANDARD',
                'topic'                => $s['topic'] ?? null,
                'summary'              => $s['summary'] ?? '',
                'call_to_action_type'  => $s['call_to_action_type'] ?? null,
                'event_title'          => $s['event_title'] ?? null,
                'event_start_date'     => $s['event_start_date'] ?? null,
                'event_end_date'       => $s['event_end_date'] ?? null,
                'offer_coupon_code'    => $s['offer_coupon_code'] ?? null,
                'status'               => 'suggested',
                'suggested_at'         => now(),
            ]);
        }

        return $saved;
    }

    private function todayDate(): string
    {
        return now()->format('Y-m-d');
    }
}
