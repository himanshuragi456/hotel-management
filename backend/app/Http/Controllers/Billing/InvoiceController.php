<?php

namespace App\Http\Controllers\Billing;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Invoice;
use App\Models\Order;
use App\Models\RestaurantTable;
use App\Traits\ApiResponse;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use SimpleSoftwareIO\QrCode\Facades\QrCode;

class InvoiceController extends Controller
{
    use ApiResponse;

    public function tables(): JsonResponse
    {
        $tables = \App\Models\RestaurantTable::where('tenant_id', auth()->user()->tenant_id)
            ->with('activeOrder.items')
            ->orderBy('number')
            ->get()
            ->map(function ($t) {
                $mins = $t->occupied_since ? (int) round(abs(now()->diffInRealMinutes($t->occupied_since))) : null;
                return [
                    'id'             => $t->id,
                    'number'         => $t->number,
                    'section'        => $t->section,
                    'capacity'       => $t->capacity,
                    'status'         => $t->status,
                    'occupied_since' => $t->occupied_since,
                    'occupied_minutes' => $mins,
                    'occupied_label' => $mins !== null ? ($mins >= 60 ? floor($mins / 60) . 'hr ' . ($mins % 60) . 'm' : $mins . 'm') : null,
                    'active_order'      => $t->activeOrder,
                    'active_order_id'  => $t->activeOrder?->id,
                    'bill_requested_at'=> $t->bill_requested_at,
                ];
            });
        return $this->success($tables);
    }

    public function tableOrders(int $tableId): JsonResponse
    {
        $table = RestaurantTable::where('id', $tableId)
            ->where('tenant_id', auth()->user()->tenant_id)
            ->firstOrFail();

        if ($table->status === 'free') {
            return $this->success([]);
        }

        $orders = Order::where('tenant_id', auth()->user()->tenant_id)
            ->where('restaurant_table_id', $tableId)
            ->where('status', '!=', 'cancelled')
            ->when($table->occupied_since, fn($q) => $q->where('created_at', '>=', $table->occupied_since))
            ->with(['items', 'table', 'invoice'])
            ->oldest()
            ->get()
            ->map(function ($order) {
                $data = $order->toArray();
                $mins = (int) round(abs(now()->diffInRealMinutes($order->created_at)));
                $data['elapsed_minutes'] = $mins;
                $data['elapsed_label']   = $mins >= 60 ? floor($mins / 60) . 'h ' . ($mins % 60) . 'm' : $mins . 'm';
                if ($order->preparing_at) {
                    $km = (int) round(abs(now()->diffInRealMinutes($order->preparing_at)));
                    $data['kitchen_minutes'] = $km;
                    $data['kitchen_label']   = $km >= 60 ? floor($km / 60) . 'h ' . ($km % 60) . 'm' : $km . 'm';
                } else {
                    $data['kitchen_minutes'] = null;
                    $data['kitchen_label']   = null;
                }
                return $data;
            });
        return $this->success($orders);
    }

    public function tableHistory(int $tableId): JsonResponse
    {
        $orders = Order::where('tenant_id', auth()->user()->tenant_id)
            ->where('restaurant_table_id', $tableId)
            ->where('status', '!=', 'cancelled')
            ->with(['items', 'invoice'])
            ->latest()
            ->get();
        return $this->success($orders);
    }

    public function addItems(Request $request, Order $order): JsonResponse
    {
        if ($order->tenant_id !== auth()->user()->tenant_id) return $this->forbidden();
        if (in_array($order->status, ['served', 'cancelled'])) return $this->error('Cannot modify a closed order');

        $v = Validator::make($request->all(), [
            'items'                => 'required|array|min:1',
            'items.*.menu_item_id' => 'required|exists:menu_items,id',
            'items.*.quantity'     => 'required|integer|min:1',
            'items.*.notes'        => 'nullable|string',
        ]);
        if ($v->fails()) return $this->validationError($v->errors());

        foreach ($request->items as $row) {
            $menuItem = \App\Models\MenuItem::where('id', $row['menu_item_id'])
                ->where('tenant_id', auth()->user()->tenant_id)->firstOrFail();
            \App\Models\OrderItem::create([
                'order_id'     => $order->id,
                'menu_item_id' => $menuItem->id,
                'item_name'    => $menuItem->name,
                'item_price'   => $menuItem->price,
                'quantity'     => $row['quantity'],
                'subtotal'     => $menuItem->price * $row['quantity'],
                'notes'        => $row['notes'] ?? null,
            ]);
        }
        $order->load('items');
        $order->recalculate();
        broadcast(new \App\Events\OrderStatusUpdated($order->fresh()->load('items', 'table')))->toOthers();
        return $this->success($order->fresh()->load('items'), 'Items added');
    }

    public function waiters(): JsonResponse
    {
        $waiters = \App\Models\User::where('tenant_id', auth()->user()->tenant_id)
            ->where('role', 'waiter')
            ->where('is_active', true)
            ->orderBy('name')
            ->get(['id', 'name']);
        return $this->success($waiters);
    }

    public function newOrderForTable(Request $request): JsonResponse
    {
        $v = Validator::make($request->all(), [
            'restaurant_table_id' => 'required|exists:restaurant_tables,id',
            'waiter_id'           => 'nullable|exists:users,id',
            'items'               => 'required|array|min:1',
            'items.*.menu_item_id'=> 'required|exists:menu_items,id',
            'items.*.quantity'    => 'required|integer|min:1',
            'items.*.notes'       => 'nullable|string',
        ]);
        if ($v->fails()) return $this->validationError($v->errors());

        $tenantId = auth()->user()->tenant_id;
        $table = \App\Models\RestaurantTable::where('id', $request->restaurant_table_id)
            ->where('tenant_id', $tenantId)->firstOrFail();

        // Use provided waiter_id if given, otherwise fall back to the billing user themselves
        $waiterId = $request->waiter_id ?? auth()->id();

        $resolvedItems = collect($request->items)->map(function ($row) use ($tenantId) {
            $menuItem = \App\Models\MenuItem::where('id', $row['menu_item_id'])->where('tenant_id', $tenantId)->firstOrFail();
            return array_merge($row, ['menu_item' => $menuItem]);
        });

        $kitchenItems   = $resolvedItems->filter(fn($r) => ! $r['menu_item']->is_ready_made);
        $readyMadeItems = $resolvedItems->filter(fn($r) =>   $r['menu_item']->is_ready_made);

        \Illuminate\Support\Facades\DB::beginTransaction();
        try {
            $createdOrders = [];

            if ($kitchenItems->isNotEmpty()) {
                $order = Order::create([
                    'tenant_id'           => $tenantId,
                    'restaurant_table_id' => $table->id,
                    'waiter_id'           => $waiterId,
                    'type'                => 'dine-in',
                    'status'              => 'pending',
                ]);
                foreach ($kitchenItems as $row) {
                    $m = $row['menu_item'];
                    \App\Models\OrderItem::create([
                        'order_id'     => $order->id,
                        'menu_item_id' => $m->id,
                        'item_name'    => $m->name,
                        'item_price'   => $m->price,
                        'quantity'     => $row['quantity'],
                        'subtotal'     => $m->price * $row['quantity'],
                        'notes'        => $row['notes'] ?? null,
                    ]);
                }
                $order->load('items');
                $order->recalculate();
                $createdOrders[] = $order->fresh()->load('items', 'table');
            }

            if ($readyMadeItems->isNotEmpty()) {
                $rmOrder = Order::create([
                    'tenant_id'           => $tenantId,
                    'restaurant_table_id' => $table->id,
                    'waiter_id'           => $waiterId,
                    'type'                => 'dine-in',
                    'status'              => 'ready',
                ]);
                foreach ($readyMadeItems as $row) {
                    $m = $row['menu_item'];
                    \App\Models\OrderItem::create([
                        'order_id'     => $rmOrder->id,
                        'menu_item_id' => $m->id,
                        'item_name'    => $m->name,
                        'item_price'   => $m->price,
                        'quantity'     => $row['quantity'],
                        'subtotal'     => $m->price * $row['quantity'],
                        'notes'        => $row['notes'] ?? null,
                    ]);
                }
                $rmOrder->load('items');
                $rmOrder->recalculate();
                $createdOrders[] = $rmOrder->fresh()->load('items', 'table');
            }

            if ($table->status === 'free') $table->occupy();
            \Illuminate\Support\Facades\DB::commit();

            foreach ($createdOrders as $o) {
                broadcast(new \App\Events\OrderStatusUpdated($o))->toOthers();
            }

            return $this->created($createdOrders, 'Order added');
        } catch (\Exception $e) {
            \Illuminate\Support\Facades\DB::rollBack();
            return $this->error('Failed: ' . $e->getMessage(), 500);
        }
    }

    public function storeTakeaway(Request $request): JsonResponse
    {
        $v = Validator::make($request->all(), [
            'items'               => 'required|array|min:1',
            'items.*.menu_item_id'=> 'required|exists:menu_items,id',
            'items.*.quantity'    => 'required|integer|min:1',
            'items.*.notes'       => 'nullable|string',
            'customer_name'       => 'required|string|max:100',
            'customer_phone'      => 'nullable|string|max:20',
            'notes'               => 'nullable|string',
        ]);
        if ($v->fails()) return $this->validationError($v->errors());

        $tenantId = auth()->user()->tenant_id;

        $resolvedItems = collect($request->items)->map(function ($row) use ($tenantId) {
            $menuItem = \App\Models\MenuItem::where('id', $row['menu_item_id'])->where('tenant_id', $tenantId)->firstOrFail();
            return array_merge($row, ['menu_item' => $menuItem]);
        });

        $kitchenItems   = $resolvedItems->filter(fn($r) => ! $r['menu_item']->is_ready_made);
        $readyMadeItems = $resolvedItems->filter(fn($r) =>   $r['menu_item']->is_ready_made);

        \Illuminate\Support\Facades\DB::beginTransaction();
        try {
            $createdOrders = [];

            if ($kitchenItems->isNotEmpty()) {
                $order = Order::create([
                    'tenant_id'      => $tenantId,
                    'waiter_id'      => auth()->id(),
                    'type'           => 'takeaway',
                    'status'         => 'pending',
                    'customer_name'  => $request->customer_name,
                    'customer_phone' => $request->customer_phone,
                    'notes'          => $request->notes,
                ]);
                foreach ($kitchenItems as $row) {
                    $m = $row['menu_item'];
                    \App\Models\OrderItem::create([
                        'order_id'     => $order->id,
                        'menu_item_id' => $m->id,
                        'item_name'    => $m->name,
                        'item_price'   => $m->price,
                        'quantity'     => $row['quantity'],
                        'subtotal'     => $m->price * $row['quantity'],
                        'notes'        => $row['notes'] ?? null,
                    ]);
                }
                $order->load('items');
                $order->recalculate();
                $createdOrders[] = $order->fresh()->load('items');
            }

            if ($readyMadeItems->isNotEmpty()) {
                $rmOrder = Order::create([
                    'tenant_id'      => $tenantId,
                    'waiter_id'      => auth()->id(),
                    'type'           => 'takeaway',
                    'status'         => 'ready',
                    'customer_name'  => $request->customer_name,
                    'customer_phone' => $request->customer_phone,
                    'notes'          => $request->notes,
                ]);
                foreach ($readyMadeItems as $row) {
                    $m = $row['menu_item'];
                    \App\Models\OrderItem::create([
                        'order_id'     => $rmOrder->id,
                        'menu_item_id' => $m->id,
                        'item_name'    => $m->name,
                        'item_price'   => $m->price,
                        'quantity'     => $row['quantity'],
                        'subtotal'     => $m->price * $row['quantity'],
                        'notes'        => $row['notes'] ?? null,
                    ]);
                }
                $rmOrder->load('items');
                $rmOrder->recalculate();
                $createdOrders[] = $rmOrder->fresh()->load('items');
            }

            \Illuminate\Support\Facades\DB::commit();

            foreach ($createdOrders as $o) {
                broadcast(new \App\Events\OrderStatusUpdated($o))->toOthers();
                AuditLog::record('order.placed', $o, [], [
                    'order_number' => $o->order_number,
                    'type'         => 'takeaway',
                    'customer'     => $request->customer_name ?? 'Walk-in',
                    'items'        => $o->items->map(fn($i) => $i->quantity . '× ' . $i->item_name)->implode(', '),
                ]);
            }

            return $this->created($createdOrders, 'Takeaway order placed');
        } catch (\Exception $e) {
            \Illuminate\Support\Facades\DB::rollBack();
            return $this->error('Failed: ' . $e->getMessage(), 500);
        }
    }

    public function markServed(Order $order): JsonResponse
    {
        if ($order->tenant_id !== auth()->user()->tenant_id) return $this->forbidden();
        if ($order->status !== 'ready') return $this->error('Order must be ready before marking as served');
        $order->update(['status' => 'served']);
        broadcast(new \App\Events\OrderStatusUpdated($order->fresh()->load('items', 'table')))->toOthers();
        return $this->success(null, 'Order marked as served');
    }

    public function closeTable(Request $request, int $tableId): JsonResponse
    {
        $tenantId = auth()->user()->tenant_id;
        $table = \App\Models\RestaurantTable::where('id', $tableId)->where('tenant_id', $tenantId)->firstOrFail();
        // Mark all open orders as served
        Order::where('tenant_id', $tenantId)
            ->where('restaurant_table_id', $tableId)
            ->whereNotIn('status', ['served', 'cancelled'])
            ->update(['status' => 'served']);
        $table->free();
        return $this->success(null, 'Table closed');
    }

    public function getBillingMenu(): JsonResponse
    {
        $tenantId = auth()->user()->tenant_id;
        $cats = \App\Models\MenuCategory::where('tenant_id', $tenantId)
            ->where('is_active', true)
            ->with(['items' => fn($q) => $q->where('is_available', true)->orderBy('sort_order')])
            ->orderBy('sort_order')
            ->get();
        return $this->success($cats);
    }

    public function readyOrders(): JsonResponse
    {
        $orders = Order::where('tenant_id', auth()->user()->tenant_id)
            ->where('status', 'served')
            ->whereDoesntHave('invoice')
            ->with(['items', 'table', 'booking.room', 'booking.guest'])
            ->oldest()
            ->get()
            ->map(function ($order) {
                $data = $order->toArray();
                $mins = (int) round(abs(now()->diffInRealMinutes($order->created_at)));
                $data['elapsed_minutes'] = $mins;
                $data['elapsed_label']   = $mins >= 60 ? floor($mins / 60) . 'h ' . ($mins % 60) . 'm' : $mins . 'm';
                if ($order->preparing_at) {
                    $km = (int) round(abs(now()->diffInRealMinutes($order->preparing_at)));
                    $data['kitchen_minutes'] = $km;
                    $data['kitchen_label']   = $km >= 60 ? floor($km / 60) . 'h ' . ($km % 60) . 'm' : $km . 'm';
                } else {
                    $data['kitchen_minutes'] = null;
                    $data['kitchen_label']   = null;
                }
                return $data;
            });
        return $this->success($orders);
    }

    public function markServedRoom(Order $order): JsonResponse
    {
        if ($order->tenant_id !== auth()->user()->tenant_id) return $this->forbidden();
        if ($order->type !== 'room-service') return $this->error('Not a room service order');
        if (!in_array($order->status, ['pending', 'preparing', 'ready'])) return $this->error('Order cannot be marked served');
        $order->update(['status' => 'served']);
        broadcast(new \App\Events\OrderStatusUpdated($order->fresh()->load('items', 'room')))->toOthers();
        return $this->success(null, 'Order marked as served');
    }

    public function bookingOrders(int $bookingId): JsonResponse
    {
        $tenantId = auth()->user()->tenant_id;
        $booking  = \App\Models\Booking::where('id', $bookingId)
            ->where('tenant_id', $tenantId)
            ->with(['room', 'guest'])
            ->firstOrFail();

        $orders = Order::where('tenant_id', $tenantId)
            ->where('type', 'room-service')
            ->where(function ($q) use ($bookingId, $booking) {
                $q->where('booking_id', $bookingId)
                  ->orWhere(function ($q2) use ($booking) {
                      // fallback for orders placed before booking_id was tracked
                      $q2->whereNull('booking_id')->where('room_id', $booking->room_id);
                  });
            })
            ->whereNotIn('status', ['cancelled'])
            ->with(['items', 'invoice'])
            ->oldest()
            ->get()
            ->map(function ($order) {
                $data = $order->toArray();
                $mins = (int) round(abs(now()->diffInRealMinutes($order->created_at)));
                $data['elapsed_minutes'] = $mins;
                $data['elapsed_label']   = $mins >= 60 ? floor($mins / 60) . 'h ' . ($mins % 60) . 'm' : $mins . 'm';
                return $data;
            });

        return $this->success([
            'booking' => $booking,
            'orders'  => $orders,
        ]);
    }

    public function allOrders(Request $request): JsonResponse
    {
        $query = Order::where('tenant_id', auth()->user()->tenant_id)
            ->with(['items', 'table', 'invoice']);
        if ($request->status) $query->where('status', $request->status);
        return $this->success($query->latest()->paginate(20));
    }

    public function activeOrders(): JsonResponse
    {
        $tid = auth()->user()->tenant_id;

        $orders = Order::where('tenant_id', $tid)
            ->whereNotIn('status', ['served', 'cancelled'])
            ->whereDoesntHave('invoice')
            ->with(['items', 'table', 'booking.room', 'booking.guest'])
            ->oldest()
            ->get()
            ->map(function ($order) {
                $data = $order->toArray();
                $mins = (int) round(abs(now()->diffInRealMinutes($order->created_at)));
                $data['elapsed_minutes'] = $mins;
                $data['elapsed_label']   = $mins >= 60 ? floor($mins / 60) . 'h ' . ($mins % 60) . 'm' : $mins . 'm';
                return $data;
            });

        return $this->success($orders);
    }

    public function store(Request $request): JsonResponse
    {
        $v = Validator::make($request->all(), [
            'order_id'       => 'required|exists:orders,id',
            'payment_method' => 'required|in:cash,card,upi,split',
            'discount_type'  => 'nullable|in:0,1,2',
            'discount_value' => 'nullable|numeric|min:0',
            'amount_paid'    => 'required|numeric|min:0',
            'customer_name'  => 'nullable|string|max:100',
            'customer_phone' => 'nullable|string|max:20',
            'split_payments' => 'nullable|array',
        ]);
        if ($v->fails()) return $this->validationError($v->errors());

        $order = Order::where('id', $request->order_id)
            ->where('tenant_id', auth()->user()->tenant_id)
            ->with('items')
            ->firstOrFail();

        if ($order->invoice) return $this->error('Invoice already exists for this order');

        $tenant       = auth()->user()->tenant;
        $subtotal     = $order->subtotal;
        $gstRate      = $tenant->gst_rate ?? 5;
        $gstAmount    = round($subtotal * ($gstRate / 100), 2);

        $discountType   = (int)($request->discount_type ?? 0);
        $discountValue  = (float)($request->discount_value ?? 0);
        $discountAmount = match ($discountType) {
            1 => min($discountValue, $subtotal),
            2 => round($subtotal * ($discountValue / 100), 2),
            default => 0,
        };

        $total     = $subtotal + $gstAmount - $discountAmount;
        $amtPaid   = (float)$request->amount_paid;
        $amtDue    = max(0, $total - $amtPaid);
        $status    = $amtDue <= 0 ? 'paid' : ($amtPaid > 0 ? 'partial' : 'unpaid');

        $invoice = Invoice::create([
            'tenant_id'       => auth()->user()->tenant_id,
            'order_id'        => $order->id,
            'customer_name'   => $request->customer_name ?? $order->customer_name,
            'customer_phone'  => $request->customer_phone ?? $order->customer_phone,
            'subtotal'        => $subtotal,
            'gst_rate'        => $gstRate,
            'gst_amount'      => $gstAmount,
            'discount_type'   => $discountType,
            'discount_value'  => $discountValue,
            'discount_amount' => $discountAmount,
            'total'           => $total,
            'payment_method'  => $request->payment_method,
            'amount_paid'     => $amtPaid,
            'amount_due'      => $amtDue,
            'status'          => $status,
            'split_payments'  => $request->split_payments,
            'created_by'      => auth()->id(),
        ]);

        AuditLog::record('invoice.created', $invoice, [], [
            'invoice_number' => $invoice->invoice_number,
            'order_number'   => $order->order_number,
            'table'          => $order->restaurant_table_id ? 'Table ' . ($order->table?->number ?? $order->restaurant_table_id) : null,
            'total'          => $invoice->total,
            'payment_method' => $invoice->payment_method,
        ]);

        // Mark order as served now that it's invoiced
        $order->update(['status' => 'served']);
        broadcast(new \App\Events\OrderStatusUpdated($order->fresh()->load('items', 'table')))->toOthers();

        // Free table only if no other unbilled orders remain
        if ($order->restaurant_table_id) {
            $remaining = Order::where('tenant_id', auth()->user()->tenant_id)
                ->where('restaurant_table_id', $order->restaurant_table_id)
                ->where('id', '!=', $order->id)
                ->where('status', '!=', 'cancelled')
                ->whereDoesntHave('invoice')
                ->count();
            if ($remaining === 0) {
                RestaurantTable::find($order->restaurant_table_id)?->free();
            }
        }

        return $this->created($invoice->load('order.items'), 'Invoice created');
    }

    public function billAll(Request $request, int $tableId): JsonResponse
    {
        $v = Validator::make($request->all(), [
            'payment_method' => 'required|in:cash,card,upi,split',
            'amount_paid'    => 'required|numeric|min:0',
            'customer_name'  => 'nullable|string|max:100',
            'customer_phone' => 'nullable|string|max:20',
        ]);
        if ($v->fails()) return $this->validationError($v->errors());

        $tenantId = auth()->user()->tenant_id;
        $tenant   = auth()->user()->tenant;
        $table    = RestaurantTable::where('id', $tableId)->where('tenant_id', $tenantId)->firstOrFail();

        $orders = Order::where('tenant_id', $tenantId)
            ->where('restaurant_table_id', $tableId)
            ->whereNotIn('status', ['cancelled'])
            ->whereDoesntHave('invoice')
            ->with('items')
            ->get();

        if ($orders->isEmpty()) return $this->error('No unbilled orders on this table');

        $gstRate    = $tenant->gst_rate ?? 5;
        $amtPaid    = (float)$request->amount_paid;
        $invoices   = [];

        \Illuminate\Support\Facades\DB::beginTransaction();
        try {
            // Distribute paid amount proportionally across orders
            $grandSubtotal = $orders->sum('subtotal');

            foreach ($orders as $order) {
                $subtotal      = $order->subtotal;
                $gstAmount     = round($subtotal * ($gstRate / 100), 2);
                $total         = $subtotal + $gstAmount;
                $proportion    = $grandSubtotal > 0 ? $subtotal / $grandSubtotal : 1 / $orders->count();
                $paid          = round($amtPaid * $proportion, 2);
                $due           = max(0, $total - $paid);
                $status        = $due <= 0 ? 'paid' : ($paid > 0 ? 'partial' : 'unpaid');

                $invoice = Invoice::create([
                    'tenant_id'       => $tenantId,
                    'order_id'        => $order->id,
                    'customer_name'   => $request->customer_name,
                    'customer_phone'  => $request->customer_phone,
                    'subtotal'        => $subtotal,
                    'gst_rate'        => $gstRate,
                    'gst_amount'      => $gstAmount,
                    'discount_type'   => 0,
                    'discount_value'  => 0,
                    'discount_amount' => 0,
                    'total'           => $total,
                    'payment_method'  => $request->payment_method,
                    'amount_paid'     => $paid,
                    'amount_due'      => $due,
                    'status'          => $status,
                    'created_by'      => auth()->id(),
                ]);
                $order->update(['status' => 'served']);
                $invoices[] = $invoice->id;
            }

            $table->free();
            \Illuminate\Support\Facades\DB::commit();
        } catch (\Exception $e) {
            \Illuminate\Support\Facades\DB::rollBack();
            return $this->error('Failed: ' . $e->getMessage(), 500);
        }

        AuditLog::record('invoice.bill_all', null, [], [
            'table'          => 'Table ' . $table->number,
            'invoice_count'  => count($invoices),
            'total'          => $request->amount_paid,
            'payment_method' => $request->payment_method,
        ]);

        return $this->success(['invoice_ids' => $invoices], 'All orders billed and table closed');
    }

    public function recent(): JsonResponse
    {
        $invoices = Invoice::where('tenant_id', auth()->user()->tenant_id)
            ->with('order.table')
            ->latest()
            ->limit(50)
            ->get();

        // Group into table sessions: consecutive invoices on the same table
        // where each invoice is within 2 hours of the previous one in that table's group.
        $sessions = [];
        // keyed by table_id => last invoice created_at for gap detection
        $openSessions = []; // table_id => session index

        foreach ($invoices as $inv) {
            $tableId     = $inv->order?->restaurant_table_id;
            $tableNumber = $inv->order?->table?->number;
            $tableSection= $inv->order?->table?->section;
            $createdAt   = $inv->created_at;

            $row = [
                'id'             => $inv->id,
                'invoice_number' => $inv->invoice_number,
                'total'          => $inv->total,
                'payment_method' => $inv->payment_method,
                'customer_name'  => $inv->customer_name,
                'created_at'     => $createdAt,
            ];

            if (!$tableId) {
                // Walk-in / no table — each invoice is its own session
                $sessions[] = [
                    'table_id'      => null,
                    'table_number'  => null,
                    'table_section' => null,
                    'label'         => 'Walk-in',
                    'closed_at'     => $createdAt,
                    'session_total' => $inv->total,
                    'invoices'      => [$row],
                ];
                continue;
            }

            // Check if there's an open session for this table within 2 hours
            if (isset($openSessions[$tableId])) {
                $idx      = $openSessions[$tableId];
                $lastTime = $sessions[$idx]['_last_time'];
                if ($createdAt->diffInHours($lastTime) < 2) {
                    $sessions[$idx]['invoices'][]     = $row;
                    $sessions[$idx]['session_total'] += $inv->total;
                    $sessions[$idx]['_last_time']     = $createdAt;
                    continue;
                }
            }

            // New session for this table
            $idx = count($sessions);
            $openSessions[$tableId] = $idx;
            $label = 'Table ' . $tableNumber . ($tableSection ? ' · ' . $tableSection : '');
            $sessions[] = [
                'table_id'      => $tableId,
                'table_number'  => $tableNumber,
                'table_section' => $tableSection,
                'label'         => $label,
                'closed_at'     => $createdAt,
                'session_total' => $inv->total,
                'invoices'      => [$row],
                '_last_time'    => $createdAt,
            ];
        }

        // Strip internal tracking key before sending
        $sessions = array_map(function ($s) {
            unset($s['_last_time']);
            return $s;
        }, $sessions);

        return $this->success($sessions);
    }

    public function show(Invoice $invoice): JsonResponse
    {
        if ($invoice->tenant_id !== auth()->user()->tenant_id) return $this->forbidden();
        return $this->success($invoice->load('order.items', 'order.table'));
    }

    public function pdf(Invoice $invoice): mixed
    {
        if ($invoice->tenant_id !== auth()->user()->tenant_id) return $this->forbidden();
        $invoice->load('order.items', 'order.table', 'tenant');

        $upiQrBase64      = null;
        $feedbackQrBase64 = null;

        $upiIdParam = request()->query('upi_id', $invoice->tenant->upi_id ?? null);
        if ($invoice->payment_method === 'upi' && $upiIdParam) {
            $amount      = $invoice->amount_due > 0 ? $invoice->amount_due : $invoice->total;
            $upiUrl      = "upi://pay?pa={$upiIdParam}&pn=" . urlencode($invoice->tenant->name) . "&am={$amount}&cu=INR";
            $pngData     = QrCode::format('png')->size(120)->generate($upiUrl);
            $upiQrBase64 = 'data:image/png;base64,' . base64_encode($pngData);
        }

        $tenant = $invoice->tenant;
        $hasFeedbackModule = $tenant->modules?->feedback ?? false;
        if ($hasFeedbackModule && ($tenant->feedback_on_bill ?? false)) {
            $feedbackQr = \App\Models\FeedbackQrCode::where('tenant_id', $tenant->id)
                ->where('is_active', true)
                ->first();
            if ($feedbackQr) {
                $feedbackUrl      = url("/feedback/{$feedbackQr->qr_token}");
                $pngData          = QrCode::format('png')->size(50)->generate($feedbackUrl);
                $feedbackQrBase64 = 'data:image/png;base64,' . base64_encode($pngData);
            }
        }

        $pdf = Pdf::loadView('invoices.receipt', [
            'invoice'          => $invoice,
            'upiQrBase64'      => $upiQrBase64,
            'feedbackQrBase64' => $feedbackQrBase64,
        ])->setPaper([0, 0, 226.77, 600], 'portrait'); // ~80mm thermal width

        return $pdf->download("invoice-{$invoice->invoice_number}.pdf");
    }

    public function combinedPdf(Request $request): mixed
    {
        $ids      = array_filter(array_map('intval', explode(',', $request->query('ids', ''))));
        $tenantId = auth()->user()->tenant_id;

        if (empty($ids)) return $this->error('No invoice IDs provided');

        $invoices = Invoice::whereIn('id', $ids)
            ->where('tenant_id', $tenantId)
            ->with('order.items', 'order.table', 'tenant')
            ->get();

        if ($invoices->isEmpty()) return $this->error('Invoices not found');

        $totals = [
            'subtotal' => $invoices->sum('subtotal'),
            'gst'      => $invoices->sum('gst_amount'),
            'discount' => $invoices->sum('discount_amount'),
            'total'    => $invoices->sum('total'),
            'paid'     => $invoices->sum('amount_paid'),
            'due'      => $invoices->sum('amount_due'),
        ];

        $tenant      = $invoices->first()->tenant;
        $upiQrBase64 = null;
        // Show UPI QR on combined PDF if all invoices share the same UPI payment method
        $allUpi = $invoices->every(fn($inv) => $inv->payment_method === 'upi');
        if ($allUpi && $tenant->upi_id) {
            $amount      = $totals['due'] > 0 ? $totals['due'] : $totals['total'];
            $upiUrl      = "upi://pay?pa={$tenant->upi_id}&pn=" . urlencode($tenant->name) . "&am={$amount}&cu=INR";
            $pngData     = QrCode::format('png')->size(120)->generate($upiUrl);
            $upiQrBase64 = 'data:image/png;base64,' . base64_encode($pngData);
        }

        $pdf = Pdf::loadView('invoices.combined', [
            'invoices'    => $invoices,
            'totals'      => $totals,
            'upiQrBase64' => $upiQrBase64,
        ])->setPaper([0, 0, 226.77, 800], 'portrait');

        return $pdf->download('combined-invoice.pdf');
    }
}
