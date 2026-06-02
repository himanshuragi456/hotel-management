<?php

namespace App\Http\Controllers;

use App\Events\OrderStatusUpdated;
use App\Models\AuditLog;
use App\Models\MenuItem;
use App\Models\MenuItemVariant;
use App\Models\MenuCategory;
use App\Models\Order;
use App\Models\OrderRejectionReason;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

/**
 * Cross-cutting order actions shared by chef/billing/owner:
 *  - reject an order with a reason code (+ item ids for IOOS) — Zomato parity
 *  - merchant-agreed cancellation loop closure
 *  - mark item / variant / category out of stock directly from the order screen
 */
class OrderActionController extends Controller
{
    use ApiResponse;

    /** List active rejection reasons for the picker. */
    public function rejectionReasons(): JsonResponse
    {
        $reasons = OrderRejectionReason::where('is_active', true)->orderBy('sort_order')->get();
        return $this->success($reasons);
    }

    /** Reject an order with a reason (Zomato rejection flow). */
    public function reject(Request $request, Order $order): JsonResponse
    {
        if ($order->tenant_id !== auth()->user()->tenant_id) return $this->forbidden();
        if (in_array($order->status, ['served', 'cancelled'])) {
            return $this->error('Order is already closed.', 422);
        }

        $v = Validator::make($request->all(), [
            'reason_code'      => 'required|exists:order_rejection_reasons,code',
            'note'             => 'nullable|string|max:500',
            'rejected_item_ids'=> 'nullable|array',
            'rejected_item_ids.*' => 'integer',
        ]);
        if ($v->fails()) return $this->validationError($v->errors());

        $reason = OrderRejectionReason::where('code', $request->reason_code)->first();
        if ($reason->requires_item && empty($request->rejected_item_ids)) {
            return $this->error('Select the out-of-stock item(s) for this reason.', 422);
        }

        $prev = $order->status;
        $order->update([
            'status'            => 'cancelled',
            'aggregator_status' => $order->source === 'aggregator' ? 'rejected' : $order->aggregator_status,
            'rejection_code'    => $reason->code,
            'rejection_note'    => $request->note,
            'rejected_item_ids' => $request->rejected_item_ids,
            'cancelled_at'      => now(),
        ]);

        try { broadcast(new OrderStatusUpdated($order->fresh()->load('items', 'table', 'room')))->toOthers(); } catch (\Throwable $e) {}
        AuditLog::record('order.rejected', $order, ['status' => $prev], [
            'order_number' => $order->order_number,
            'reason'       => $reason->label,
            'note'         => $request->note,
        ]);

        return $this->success($order->fresh(), 'Order rejected');
    }

    /** Merchant-agreed cancellation — closes the loop on a cancelled order. */
    public function cancel(Request $request, Order $order): JsonResponse
    {
        if ($order->tenant_id !== auth()->user()->tenant_id) return $this->forbidden();
        if ($order->status === 'cancelled') return $this->error('Order already cancelled.', 422);
        if ($order->invoice) return $this->error('Cannot cancel an invoiced order.', 422);

        $v = Validator::make($request->all(), ['note' => 'nullable|string|max:500']);
        if ($v->fails()) return $this->validationError($v->errors());

        $prev = $order->status;
        $order->update([
            'status'            => 'cancelled',
            'aggregator_status' => $order->source === 'aggregator' ? 'cancelled' : $order->aggregator_status,
            'rejection_code'    => 'customer_request',
            'rejection_note'    => $request->note,
            'cancelled_at'      => now(),
        ]);

        try { broadcast(new OrderStatusUpdated($order->fresh()->load('items', 'table', 'room')))->toOthers(); } catch (\Throwable $e) {}
        AuditLog::record('order.cancelled', $order, ['status' => $prev], [
            'order_number' => $order->order_number,
            'note'         => $request->note,
        ]);

        return $this->success($order->fresh(), 'Order cancelled');
    }

    /**
     * Mark an item / variant / category out of stock straight from the order screen.
     * type=item|variant|category, id=target id.
     */
    public function markOos(Request $request): JsonResponse
    {
        $v = Validator::make($request->all(), [
            'type' => 'required|in:item,variant,category',
            'id'   => 'required|integer',
            'oos'  => 'boolean', // default true; allow toggling back in stock
        ]);
        if ($v->fails()) return $this->validationError($v->errors());

        $tenantId = auth()->user()->tenant_id;
        $oos = $request->boolean('oos', true);

        $model = match ($request->type) {
            'item'     => MenuItem::where('tenant_id', $tenantId)->find($request->id),
            'variant'  => MenuItemVariant::where('tenant_id', $tenantId)->find($request->id),
            'category' => MenuCategory::where('tenant_id', $tenantId)->find($request->id),
        };
        if (! $model) return $this->error('Not found.', 404);

        // Categories use is_oos; items/variants use is_available (inverted).
        if ($request->type === 'category') {
            $model->update(['is_oos' => $oos]);
        } else {
            $model->update(['is_available' => ! $oos]);
        }

        AuditLog::record('menu.oos_changed', $model, [], [
            'type' => $request->type, 'name' => $model->name ?? $model->id, 'oos' => $oos,
        ]);

        return $this->success(['oos' => $oos], $oos ? 'Marked out of stock' : 'Marked back in stock');
    }
}
