<?php

namespace App\Http\Controllers;

use App\Models\AppNotification;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class NotificationController extends Controller
{
    use ApiResponse;

    /** Notifications older than this auto-expire from the box. */
    private const TTL_MINUTES = 10;

    public function index(): JsonResponse
    {
        $cutoff = now()->subMinutes(self::TTL_MINUTES);

        // Self-pruning: drop this user's expired notifications on every poll, so
        // they disappear after the TTL without needing a scheduled job.
        AppNotification::where('user_id', auth()->id())
            ->where('created_at', '<', $cutoff)
            ->delete();

        $notifications = AppNotification::where('user_id', auth()->id())
            ->where('created_at', '>=', $cutoff)
            ->latest()
            ->limit(50)
            ->get()
            ->map(fn($n) => array_merge($n->toArray(), ['is_read' => $n->is_read]));

        $unread = AppNotification::where('user_id', auth()->id())
            ->where('created_at', '>=', $cutoff)
            ->whereNull('read_at')
            ->count();

        return $this->success(['notifications' => $notifications, 'unread_count' => $unread]);
    }

    public function markRead(Request $request, ?int $id = null): JsonResponse
    {
        $query = AppNotification::where('user_id', auth()->id());

        if ($id) {
            $query->where('id', $id);
        }

        $query->whereNull('read_at')->update(['read_at' => now()]);

        return $this->success(null, 'Marked as read');
    }

    public function destroy(int $id): JsonResponse
    {
        AppNotification::where('user_id', auth()->id())->where('id', $id)->delete();
        return $this->success(null, 'Dismissed');
    }

    public function clearAll(): JsonResponse
    {
        AppNotification::where('user_id', auth()->id())->delete();
        return $this->success(null, 'Cleared');
    }
}
