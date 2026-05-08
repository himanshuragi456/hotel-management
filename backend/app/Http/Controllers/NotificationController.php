<?php

namespace App\Http\Controllers;

use App\Models\AppNotification;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class NotificationController extends Controller
{
    use ApiResponse;

    public function index(): JsonResponse
    {
        $notifications = AppNotification::where('user_id', auth()->id())
            ->latest()
            ->limit(50)
            ->get()
            ->map(fn($n) => array_merge($n->toArray(), ['is_read' => $n->is_read]));

        $unread = AppNotification::where('user_id', auth()->id())->whereNull('read_at')->count();

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

    public function clearAll(): JsonResponse
    {
        AppNotification::where('user_id', auth()->id())->delete();
        return $this->success(null, 'Cleared');
    }
}
