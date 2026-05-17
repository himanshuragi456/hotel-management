<?php

namespace App\Http\Controllers\Public;

use App\Http\Controllers\Controller;
use App\Models\FeedbackQrCode;
use App\Models\FeedbackSubmission;
use App\Models\Tenant;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class FeedbackSubmissionController extends Controller
{
    public function show(string $token): JsonResponse
    {
        $qr = FeedbackQrCode::where('qr_token', $token)->where('is_active', true)->first();

        if (!$qr) {
            return response()->json(['status' => false, 'message' => 'Invalid or inactive QR code'], 404);
        }

        $tenant = Tenant::find($qr->tenant_id);

        return response()->json([
            'status' => true,
            'data'   => [
                'tenant_name'       => $tenant->name,
                'placement'         => $qr->placement,
                'label'             => $qr->label,
                'google_review_url' => $tenant->google_review_url,
            ],
        ]);
    }

    public function submit(Request $request, string $token): JsonResponse
    {
        $qr = FeedbackQrCode::where('qr_token', $token)->where('is_active', true)->first();

        if (!$qr) {
            return response()->json(['status' => false, 'message' => 'Invalid QR code'], 404);
        }

        $data = $request->validate([
            'rating'           => 'required|integer|min:1|max:5',
            'comment'          => 'nullable|string|max:1000',
            'submitter_name'   => 'nullable|string|max:100',
            'submitter_phone'  => 'nullable|string|max:20',
        ]);

        $isInternal = $data['rating'] <= 3;

        $submission = FeedbackSubmission::create([
            'tenant_id'           => $qr->tenant_id,
            'feedback_qr_code_id' => $qr->id,
            'rating'              => $data['rating'],
            'comment'             => $data['comment'] ?? null,
            'is_internal'         => $isInternal,
            'submitter_name'      => $data['submitter_name'] ?? null,
            'submitter_phone'     => $data['submitter_phone'] ?? null,
            'ip_address'          => $request->ip(),
        ]);

        $tenant = Tenant::find($qr->tenant_id);

        return response()->json([
            'status' => true,
            'data'   => [
                'id'                => $submission->id,
                'rating'            => $submission->rating,
                'is_internal'       => $isInternal,
                'google_review_url' => $isInternal ? null : $tenant->google_review_url,
                'tenant_name'       => $tenant->name,
            ],
        ]);
    }

    public function aiSuggestions(Request $request, string $token): JsonResponse
    {
        $qr = FeedbackQrCode::where('qr_token', $token)->where('is_active', true)->first();
        if (!$qr) {
            return response()->json(['status' => false, 'message' => 'Invalid QR code'], 404);
        }

        $tenant = Tenant::find($qr->tenant_id);

        // Feature not enabled for this tenant — still show static suggestions
        if (!$tenant->ai_suggestions_enabled) {
            return response()->json(['status' => true, 'data' => [
                'suggestions' => $this->threeUniqueStatics(),
                'ai_enabled'  => false,
            ]]);
        }

        // Reset monthly counter on first call of a new month
        $today = now()->startOfMonth()->toDateString();
        if ($tenant->ai_usage_reset_at === null || $tenant->ai_usage_reset_at->toDateString() < $today) {
            $tenant->update(['ai_usage_this_month' => 0, 'ai_usage_reset_at' => $today]);
            $tenant->refresh();
        }

        // Quota exhausted — return fallback silently (still show suggestions, just not AI)
        if ($tenant->ai_usage_this_month >= $tenant->ai_monthly_quota) {
            return response()->json(['status' => true, 'data' => [
                'suggestions' => $this->threeUniqueStatics(),
                'ai_enabled'  => false,  // quota hit — don't badge as AI
            ]]);
        }

        // 1 AI review + 2 unique static reviews — saves tokens, stays fresh
        $aiReview      = $this->generateOneLiveSuggestion($tenant->name, $tenant->business_domain ?? 'hotel and restaurant');
        $staticTwo     = $this->twoUniqueStatics();
        $suggestions   = array_values(array_merge([$aiReview], $staticTwo));

        $tenant->increment('ai_usage_this_month');

        return response()->json(['status' => true, 'data' => [
            'suggestions' => $suggestions,
            'ai_enabled'  => true,
        ]]);
    }

    private function generateOneLiveSuggestion(string $businessName, string $domain): string
    {
        $apiKey = config('services.openai.api_key');
        if (!$apiKey) {
            return $this->staticPool()[array_rand($this->staticPool())];
        }

        $langs = ['English', 'Hinglish', 'Hindi'];
        $lang  = $langs[array_rand($langs)];
        $seed  = substr(md5(uniqid('', true)), 0, 8);

        $prompt = "One short Google review for \"{$businessName}\" ({$domain}). Language: {$lang}. Max 18 words. Natural, specific, no emojis, no names. Seed:{$seed}. Return only the plain review text, nothing else.";

        $ch = curl_init('https://api.openai.com/v1/chat/completions');
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST           => true,
            CURLOPT_HTTPHEADER     => ['Authorization: Bearer ' . $apiKey, 'Content-Type: application/json'],
            CURLOPT_POSTFIELDS     => json_encode([
                'model'       => 'gpt-4o-mini',
                'messages'    => [['role' => 'user', 'content' => $prompt]],
                'max_tokens'  => 40,
                'temperature' => 1.2,
            ]),
            CURLOPT_TIMEOUT => 15,
        ]);

        $response = curl_exec($ch);
        $err      = curl_error($ch);
        curl_close($ch);

        if ($err || !$response) {
            return $this->staticPool()[array_rand($this->staticPool())];
        }

        try {
            $parsed  = json_decode($response, true);
            $content = trim($parsed['choices'][0]['message']['content'] ?? '');
            // Strip any accidental quotes GPT wraps around the text
            $content = trim($content, '"\'');
            if (strlen($content) > 5) return $content;
        } catch (\Throwable) {}

        return $this->staticPool()[array_rand($this->staticPool())];
    }

    // Pick 2 unique entries from the large static pool, never the same pair
    private function twoUniqueStatics(): array
    {
        $pool = $this->staticPool();
        shuffle($pool);
        return array_slice($pool, 0, 2);
    }

    // 3 all-static reviews when AI is off / quota hit
    private function threeUniqueStatics(): array
    {
        $pool = $this->staticPool();
        shuffle($pool);
        return array_slice($pool, 0, 3);
    }

    private function staticPool(): array
    {
        return [
            // English
            'Absolutely loved it — the service was fast and the staff genuinely cared.',
            'Best experience I have had in a while. Will definitely be back soon.',
            'Great ambience, warm staff, and excellent value for money. Highly recommend.',
            'The quality here is consistently top-notch. A must-visit for anyone in the area.',
            'Felt right at home from the moment I walked in. Wonderful hospitality.',
            'Everything was spotless and the team was incredibly attentive throughout.',
            'Really impressed — exceeded my expectations on every front. Five stars easily.',
            'One of the best places I have visited in this city. Will spread the word.',
            'Smooth experience from start to finish. Professional, warm, and very well-managed.',
            'The attention to detail sets this place apart. Genuinely outstanding service.',
            'Perfect from beginning to end. The staff made us feel like VIPs.',
            'Clean, comfortable, and run with real care. This is how it should be done.',
            // Hinglish
            'Yaar, ekdum mast jagah hai. Service bhi fast aur staff bhi bahut friendly tha.',
            'Bahut achha experience raha. Definitely dobara aaunga — highly recommend!',
            'Is jagah ka koi jawab nahi. Sab kuch top-class tha, paise bhi wasool lage.',
            'Service itni achhi thi ki dil khush ho gaya. Zaroor try karo ek baar.',
            'Atmosphere bilkul chill tha aur staff ne bhi bahut achhe se treat kiya.',
            'Bhai, seriously ek baar jaao — acha lagega, guarantee hai.',
            'Sab kuch neat aur clean tha. Staff ka behaviour bhi bahut professional tha.',
            'First time gaya tha, but ab toh regular ban gaya hoon. Kaafi achha hai.',
            // Hindi
            'Bahut hi accha anubhav raha. Seva bahut tez aur staff ati vinaysheel tha.',
            'Yahan ki sewa ne dil jeet liya. Sabse acchi jagah hai sheher mein.',
            'Saaf-safai aur mahaul dono laajawab the. Zaroor aana chahiye ek baar.',
            'Staff ne itne pyar se swagat kiya ki bilkul ghar jaisa laga. Bahut shukriya.',
        ];
    }
}
