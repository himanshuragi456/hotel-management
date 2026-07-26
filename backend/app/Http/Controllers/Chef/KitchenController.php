<?php

namespace App\Http\Controllers\Chef;

use App\Events\OrderStatusUpdated;
use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Order;
use App\Services\NotificationService;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class KitchenController extends Controller
{
    use ApiResponse;

    public function orders(): JsonResponse
    {
        $orders = Order::where('tenant_id', auth()->user()->tenant_id)
            ->whereIn('status', ['pending', 'preparing', 'ready'])
            ->where('payment_status', '!=', 'pending_payment')
            ->with(['items', 'table', 'room'])
            ->oldest()
            ->get()
            ->map(fn($order) => $this->withTimings($order));
        return $this->success($orders);
    }

    private function withTimings(Order $order): array
    {
        $data = $order->toArray();
        $mins = (int) round(abs(now()->diffInRealMinutes($order->created_at)));
        $data['elapsed_minutes'] = $mins;
        $data['elapsed_label']   = $this->fmtMins($mins);

        if ($order->preparing_at) {
            $km = (int) round(abs(now()->diffInRealMinutes($order->preparing_at)));
            $data['kitchen_minutes'] = $km;
            $data['kitchen_label']   = $this->fmtMins($km);
        } else {
            $data['kitchen_minutes'] = null;
            $data['kitchen_label']   = null;
        }
        return $data;
    }

    private function fmtMins(int $mins): string
    {
        return $mins >= 60 ? floor($mins / 60) . 'h ' . ($mins % 60) . 'm' : $mins . 'm';
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

        $prev = $order->status;
        $order->update([
            'status'       => $next,
            'preparing_at' => $next === 'preparing' ? now() : $order->preparing_at,
        ]);
        // Broadcasting (success or failure) is logged centrally — see
        // App\Broadcasting\LoggingAblyBroadcaster.
        try {
            broadcast(new OrderStatusUpdated($order->fresh()->load('items', 'table', 'room')))->toOthers();
        } catch (\Exception $e) {
            // best-effort — already logged by the broadcaster
        }
        AuditLog::record('order.status_changed', $order, ['status' => $prev], ['status' => $next, 'order_number' => $order->order_number]);

        // Order just became ready — alert the floor so it gets served: billers +
        // the assigned waiter (toFloor targets both).
        if ($next === 'ready' && $prev !== 'ready') {
            $this->notifyReady($order);
        }

        return $this->success(['status' => $order->fresh()->status], 'Status updated');
    }

    private function notifyReady(Order $order): void
    {
        try {
            $where = $this->orderLocationLabel($order);
            app(NotificationService::class)->toFloor(
                tenantId: $order->tenant_id,
                kind: 'order_ready',
                title: "Ready to serve — {$where}",
                body: "Order {$order->order_number} is ready",
                data: ['order_number' => $order->order_number],
                tableId: $order->restaurant_table_id,
                waiterId: $order->waiter_id,
                // Whoever marked it ready (often a biller) doesn't need to be
                // alerted about their own action.
                excludeUserId: auth()->id(),
            );
        } catch (\Throwable $e) {
            // notifications are best-effort
        }
    }

    private function orderLocationLabel(Order $order): string
    {
        if ($order->table?->number) {
            return 'Table ' . $order->table->number;
        }
        if ($order->room?->number ?? $order->room_id) {
            return 'Room ' . ($order->room?->number ?? $order->room_id);
        }
        if ($order->type === 'takeaway' || $order->source === 'aggregator') {
            return $order->platform ? ucfirst($order->platform) : ($order->customer_name ?: 'Takeaway');
        }
        return $order->order_number;
    }
}
