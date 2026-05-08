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

        $data = $request->validate([
            'rating'  => 'required|integer|min:4|max:5',
            'comment' => 'nullable|string|max:500',
        ]);

        $apiKey = config('services.openai.api_key');

        if (!$apiKey) {
            // Return generic suggestions when no API key is configured
            return response()->json([
                'status' => true,
                'data'   => [
                    'suggestions' => $this->genericSuggestions($data['rating']),
                ],
            ]);
        }

        $tenant = Tenant::find($qr->tenant_id);
        $suggestions = $this->generateWithOpenAI($apiKey, $tenant->name, $data['rating'], $data['comment'] ?? '');

        return response()->json(['status' => true, 'data' => ['suggestions' => $suggestions]]);
    }

    private function genericSuggestions(int $rating): array
    {
        $fiveStars = [
            'The food was absolutely amazing and the service was top-notch! Highly recommend.',
            'Had a wonderful experience here. The staff was incredibly attentive and friendly.',
            'Perfect in every way — from the ambiance to the food quality. Will definitely return!',
        ];
        $fourStars = [
            'Great experience overall. The food was delicious and the staff was very helpful.',
            'Really enjoyed my visit. Good food, comfortable setting, and friendly service.',
            'Would definitely come back. The quality here is consistently good.',
        ];
        return $rating === 5 ? $fiveStars : $fourStars;
    }

    private function generateWithOpenAI(string $apiKey, string $tenantName, int $rating, string $comment): array
    {
        $prompt = "A customer gave {$rating} stars to \"{$tenantName}\". " .
                  ($comment ? "Their comment: \"{$comment}\". " : '') .
                  "Write 3 short, natural Google review suggestions (1-2 sentences each) the customer can copy. " .
                  "Make them sound genuine and varied. Return as JSON array of strings.";

        $ch = curl_init('https://api.openai.com/v1/chat/completions');
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST           => true,
            CURLOPT_HTTPHEADER     => [
                'Authorization: Bearer ' . $apiKey,
                'Content-Type: application/json',
            ],
            CURLOPT_POSTFIELDS => json_encode([
                'model'      => 'gpt-4o-mini',
                'messages'   => [['role' => 'user', 'content' => $prompt]],
                'max_tokens' => 300,
                'temperature'=> 0.8,
            ]),
            CURLOPT_TIMEOUT => 15,
        ]);

        $response = curl_exec($ch);
        $error    = curl_error($ch);
        curl_close($ch);

        if ($error || !$response) return $this->genericSuggestions($rating);

        try {
            $parsed  = json_decode($response, true);
            $content = $parsed['choices'][0]['message']['content'] ?? '';
            // Extract JSON array from the response
            preg_match('/\[.*\]/s', $content, $matches);
            if ($matches) {
                $suggestions = json_decode($matches[0], true);
                if (is_array($suggestions) && count($suggestions) > 0) {
                    return array_slice($suggestions, 0, 3);
                }
            }
        } catch (\Throwable) {}

        return $this->genericSuggestions($rating);
    }
}
