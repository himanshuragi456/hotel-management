<?php

namespace App\Http\Controllers;

use App\Models\PushSubscription;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class PushSubscriptionController extends Controller
{
    use ApiResponse;

    /** The VAPID public key the browser needs to create a subscription. */
    public function vapidKey(): JsonResponse
    {
        return $this->success(['key' => config('webpush.public_key')]);
    }

    /** Register (or refresh) a device's push subscription for the current user. */
    public function store(Request $request): JsonResponse
    {
        $v = Validator::make($request->all(), [
            'endpoint'          => 'required|string',
            'keys.p256dh'       => 'required|string',
            'keys.auth'         => 'required|string',
            'content_encoding'  => 'nullable|string',
        ]);
        if ($v->fails()) return $this->validationError($v->errors());

        $user = auth()->user();

        $sub = PushSubscription::updateOrCreate(
            ['endpoint_hash' => hash('sha256', $request->endpoint)],
            [
                'user_id'          => $user->id,
                'tenant_id'        => $user->tenant_id,
                'endpoint'         => $request->endpoint,
                'public_key'       => $request->input('keys.p256dh'),
                'auth_token'       => $request->input('keys.auth'),
                'content_encoding' => $request->input('content_encoding', 'aesgcm'),
            ]
        );

        return $this->success(['id' => $sub->id], 'Subscribed to push notifications');
    }

    /** Remove a device's subscription (e.g. user disabled phone alerts). */
    public function destroy(Request $request): JsonResponse
    {
        if ($request->endpoint) {
            PushSubscription::where('endpoint_hash', hash('sha256', $request->endpoint))
                ->where('user_id', auth()->id())
                ->delete();
        }
        return $this->success(null, 'Unsubscribed');
    }
}
