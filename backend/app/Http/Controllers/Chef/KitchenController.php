<?php

namespace App\Http\Controllers\Chef;

use App\Events\OrderStatusUpdated;
use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class KitchenController extends Controller
{
    use ApiResponse;

    public function orders(): JsonResponse
    {
        $orders = Order::where('tenant_id', auth()->user()->tenant_id)
            ->whereIn('status', ['pending', 'preparing'])
            ->with(['items', 'table'])
            ->oldest()
            ->get()
            ->map(function ($order) {
                $data = $order->toArray();
                $data['elapsed_minutes'] = now()->diffInMinutes($order->created_at);
                return $data;
            });
        return $this->success($orders);
    }

    public function updateStatus(Request $request, Order $order): JsonResponse
    {
        if ($order->tenant_id !== auth()->user()->tenant_id) return $this->forbidden();

        $transitions = [
            'pending'   => 'preparing',
            'preparing' => 'ready',
        ];

        $next = $request->status ?? ($transitions[$order->status] ?? null);

        $allowed = ['pending', 'preparing', 'ready', 'cancelled'];
        if (!in_array($next, $allowed)) {
            return $this->error("Invalid status transition to '{$next}'");
        }

        $order->update(['status' => $next]);
        broadcast(new OrderStatusUpdated($order->fresh()->load('items', 'table')))->toOthers();

        return $this->success(['status' => $order->fresh()->status], 'Status updated');
    }
}
