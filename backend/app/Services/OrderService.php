<?php

namespace App\Services;

use App\Events\OrderStatusUpdated;
use App\Models\Addon;
use App\Models\MenuItem;
use App\Models\MenuItemVariant;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Tenant;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Single source of truth for building orders + order items.
 *
 * Every order-creation path (waiter, customer QR, magic tables, billing, aggregator)
 * should resolve its line items into the canonical shape and call createOrders().
 * Variant pricing, add-on snapshots and per-line GST bifurcation all live here so the
 * logic is computed once rather than duplicated across controllers.
 */
class OrderService
{
    /**
     * Resolve raw request line rows into fully-priced line definitions.
     *
     * Each input row: ['menu_item_id', 'quantity', 'variant_id'?, 'addon_ids'?, 'notes'?]
     * Returns a collection of arrays carrying the resolved MenuItem plus a built
     * OrderItem attribute payload (without order_id).
     *
     * @throws \Illuminate\Database\Eloquent\ModelNotFoundException when an id is invalid / cross-tenant
     */
    public function resolveLines(int $tenantId, array $rows, Tenant $tenant): Collection
    {
        return collect($rows)->map(function (array $row) use ($tenantId, $tenant) {
            $menuItem = MenuItem::where('id', $row['menu_item_id'])
                ->where('tenant_id', $tenantId)
                ->firstOrFail();

            $variant = null;
            if (! empty($row['variant_id'])) {
                $variant = MenuItemVariant::where('id', $row['variant_id'])
                    ->where('menu_item_id', $menuItem->id)
                    ->where('tenant_id', $tenantId)
                    ->firstOrFail();
            }

            // Variant price overrides the base item price when a variant is chosen.
            $unitPrice = $variant ? $variant->price : $menuItem->price;

            // Snapshot selected add-ons so the line stays self-describing even if the
            // add-on is later edited or deleted.
            $addonSnapshots = [];
            $addonsTotal = 0.0;
            if (! empty($row['addon_ids'])) {
                $addons = Addon::whereIn('id', $row['addon_ids'])
                    ->where('tenant_id', $tenantId)
                    ->whereHas('group', fn ($q) => $q->where('menu_item_id', $menuItem->id))
                    ->get();
                foreach ($addons as $addon) {
                    $addonSnapshots[] = [
                        'addon_id' => $addon->id,
                        'name'     => $addon->name,
                        'price'    => (float) $addon->price,
                        'group'    => $addon->group?->name,
                    ];
                    $addonsTotal += (float) $addon->price;
                }
            }

            $quantity = max(1, (int) ($row['quantity'] ?? 1));
            $lineUnit = $unitPrice + $addonsTotal;
            $subtotal = round($lineUnit * $quantity, 2);

            // Per-line GST. Item slab overrides tenant default.
            // When gst_inclusive=true, prices already include GST: extract it.
            // When gst_inclusive=false, GST is additional on top of price.
            $gstRate   = (float) ($menuItem->gst_slab ?? $tenant->gst_rate ?? 5);
            $inclusive = (bool) ($tenant->gst_inclusive ?? false);

            if ($inclusive) {
                // GST is baked into the price — extract it: gst = price - price/(1 + rate/100)
                $gstAmount = round($subtotal - $subtotal / (1 + $gstRate / 100), 2);
            } else {
                $gstAmount = round($subtotal * ($gstRate / 100), 2);
            }

            if ($menuItem->gst_cgst_sgst) {
                $cgst = round($gstAmount / 2, 2);
                $sgst = $gstAmount - $cgst;
            } else {
                $cgst = 0.0;
                $sgst = 0.0;
            }

            return [
                'menu_item'  => $menuItem,
                'is_ready_made' => (bool) $menuItem->is_ready_made,
                'attributes' => [
                    'menu_item_id'         => $menuItem->id,
                    'menu_item_variant_id' => $variant?->id,
                    'item_name'            => $menuItem->name,
                    'variant_name'         => $variant?->name,
                    'item_price'           => $unitPrice,
                    'quantity'             => $quantity,
                    'subtotal'             => $subtotal,
                    'notes'                => $row['notes'] ?? null,
                    'addons'               => $addonSnapshots ?: null,
                    'addons_total'         => round($addonsTotal * $quantity, 2),
                    'gst_rate'             => $gstRate,
                    'cgst_amount'          => $cgst,
                    'sgst_amount'          => $sgst,
                ],
            ];
        });
    }

    /**
     * Create one or two orders from resolved lines, splitting ready-made items
     * (which skip the kitchen and are instantly "ready") from kitchen items.
     *
     * @param  array  $orderAttributes  base attributes applied to every created order
     *                                   (tenant_id, table/room, waiter_id, type, source, etc.)
     * @return Order[]  created orders, each with items + table loaded
     */
    public function createOrders(int $tenantId, Tenant $tenant, array $rows, array $orderAttributes, bool $splitReadyMade = true): array
    {
        $resolved = $this->resolveLines($tenantId, $rows, $tenant);

        $groups = $splitReadyMade
            ? [
                'kitchen'   => ['lines' => $resolved->reject(fn ($l) => $l['is_ready_made']), 'status' => 'pending'],
                'readymade' => ['lines' => $resolved->filter(fn ($l) => $l['is_ready_made']), 'status' => 'ready'],
            ]
            : ['single' => ['lines' => $resolved, 'status' => $orderAttributes['status'] ?? 'pending']];

        $created = [];

        DB::transaction(function () use ($groups, $orderAttributes, $tenantId, &$created) {
            foreach ($groups as $group) {
                if ($group['lines']->isEmpty()) continue;

                $order = Order::create(array_merge(
                    ['tenant_id' => $tenantId],
                    $orderAttributes,
                    ['status' => $orderAttributes['status'] ?? $group['status']],
                ));

                foreach ($group['lines'] as $line) {
                    OrderItem::create(array_merge(['order_id' => $order->id], $line['attributes']));
                }

                $order->load('items');
                $order->recalculate();
                $created[] = $order->fresh()->load('items', 'table');
            }
        });

        return $created;
    }

    /**
     * Append resolved lines to an existing order and recalculate its totals.
     * Used by "add items" flows (waiter/billing) so variant/add-on/GST handling
     * stays consistent with fresh order creation.
     */
    public function addLinesToOrder(Order $order, array $rows): Order
    {
        $tenant = $order->tenant;
        $resolved = $this->resolveLines($order->tenant_id, $rows, $tenant);

        DB::transaction(function () use ($order, $resolved) {
            foreach ($resolved as $line) {
                OrderItem::create(array_merge(['order_id' => $order->id], $line['attributes']));
            }
            $order->load('items');
            $order->recalculate();
        });

        return $order->fresh()->load('items', 'table');
    }

    /**
     * Broadcast + audit a freshly created order (best-effort broadcast).
     */
    public function announce(Order $order, string $auditAction = 'order.placed', array $extraAudit = []): void
    {
        try {
            broadcast(new OrderStatusUpdated($order->fresh()->load('items', 'table')))->toOthers();
        } catch (\Throwable $e) {
            // broadcasting is best-effort; never block an order on it
        }

        \App\Models\AuditLog::record($auditAction, $order, [], array_merge([
            'order_number' => $order->order_number,
            'items'        => $order->items->map(fn ($i) => $i->quantity . '× ' . $i->item_name)->implode(', '),
            'total'        => $order->total,
        ], $extraAudit));
    }
}
