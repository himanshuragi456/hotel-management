<?php

namespace App\Http\Controllers\Owner;

use App\Exports\OrdersExport;
use App\Http\Controllers\Controller;
use App\Models\Booking;
use App\Models\Expense;
use App\Models\Invoice;
use App\Models\Order;
use App\Models\Room;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Maatwebsite\Excel\Facades\Excel;
use Barryvdh\DomPDF\Facade\Pdf;

class RevenueController extends Controller
{
    use ApiResponse;

    public function liveOrders(): JsonResponse
    {
        $orders = Order::where('tenant_id', auth()->user()->tenant_id)
            ->whereNotIn('status', ['served', 'cancelled'])
            ->with(['items', 'table', 'waiter:id,name', 'booking.room', 'booking.guest'])
            ->latest()
            ->get()
            ->map(function ($o) {
                $data = $o->toArray();
                $mins = (int) round(abs(now()->diffInRealMinutes($o->created_at)));
                $data['elapsed_minutes'] = $mins;
                $data['elapsed_label']   = $mins >= 60 ? floor($mins / 60) . 'h ' . ($mins % 60) . 'm' : $mins . 'm';
                if ($o->preparing_at) {
                    $km = (int) round(abs(now()->diffInRealMinutes($o->preparing_at)));
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

    public function todayRevenue(): JsonResponse
    {
        $tenantId = auth()->user()->tenant_id;

        // Food revenue — paid invoices today
        $foodRevenue = Invoice::where('tenant_id', $tenantId)
            ->whereDate('created_at', today())
            ->where('status', 'paid')
            ->sum('total');

        $orderCount = Order::where('tenant_id', $tenantId)
            ->whereDate('created_at', today())
            ->where('status', 'served')
            ->count();

        $expenses = Expense::where('tenant_id', $tenantId)
            ->whereDate('expense_date', today())
            ->sum('amount');

        // Hotel — checkouts today (room revenue collected)
        $checkoutsToday = Booking::where('tenant_id', $tenantId)
            ->where('status', 'checked_out')
            ->whereDate('actual_check_out', today())
            ->get();

        $roomRevenue = $checkoutsToday->sum(fn($b) => $b->advance_paid);

        // Hotel — current occupancy
        $occupiedRooms = Room::where('tenant_id', $tenantId)->where('status', 'occupied')->count();
        $totalRooms    = Room::where('tenant_id', $tenantId)->count();

        // Hotel — check-ins and check-outs today
        $checkinsToday  = Booking::where('tenant_id', $tenantId)
            ->whereDate('actual_check_in', today())
            ->count();
        $checkoutsCount = $checkoutsToday->count();

        // Hotel — guests currently staying (outstanding balance)
        $activeBookings = Booking::where('tenant_id', $tenantId)
            ->where('status', 'checked_in')
            ->get();
        $outstandingBalance = $activeBookings->sum(fn($b) => $b->balance_due);

        $totalRevenue = $foodRevenue + $roomRevenue;

        // Per-channel order breakdown today (dine-in/takeaway/QR + Zomato/Swiggy aggregator).
        // Aggregator orders split out by platform; everything else grouped by source.
        $channelRows = Order::where('tenant_id', $tenantId)
            ->whereDate('created_at', today())
            ->where('status', '!=', 'cancelled')
            ->get(['source', 'platform', 'total']);
        $channels = $channelRows->groupBy(fn($o) => $o->source === 'aggregator' ? ($o->platform ?: 'aggregator') : $o->source)
            ->map(fn($grp, $key) => [
                'channel' => $key,
                'count'   => $grp->count(),
                'total'   => round($grp->sum('total'), 2),
            ])
            ->values();

        return $this->success([
            'channels'            => $channels,
            'revenue'             => $totalRevenue,
            'food_revenue'        => $foodRevenue,
            'room_revenue'        => $roomRevenue,
            'order_count'         => $orderCount,
            'expenses'            => $expenses,
            'net'                 => $totalRevenue - $expenses,
            'occupied_rooms'      => $occupiedRooms,
            'total_rooms'         => $totalRooms,
            'checkins_today'      => $checkinsToday,
            'checkouts_today'     => $checkoutsCount,
            'active_guests'       => $activeBookings->count(),
            'outstanding_balance' => $outstandingBalance,
        ]);
    }

    public function ordersReport(Request $request): JsonResponse
    {
        $v = Validator::make($request->all(), [
            'from' => 'required|date',
            'to'   => 'required|date|after_or_equal:from',
        ]);
        if ($v->fails()) return $this->validationError($v->errors());

        $orders = Order::where('tenant_id', auth()->user()->tenant_id)
            ->whereBetween('created_at', [$request->from, $request->to . ' 23:59:59'])
            ->with(['items', 'table', 'invoice'])
            ->withCount('items')
            ->latest()
            ->get();

        $billedOrders = $orders->filter(fn($o) => $o->invoice);
        $revenue  = $billedOrders->sum(fn($o) => $o->invoice->total ?? 0);
        $tax      = $billedOrders->sum(fn($o) => $o->invoice->tax ?? 0);
        $count    = $orders->count();
        $avgOrder = $count > 0 ? round($revenue / $count, 2) : 0;

        return $this->success([
            'summary' => [
                'order_count' => $count,
                'revenue'     => round($revenue, 2),
                'tax'         => round($tax, 2),
                'avg_order'   => $avgOrder,
            ],
            'orders' => $orders->values(),
        ]);
    }

    public function exportPdf(Request $request): mixed
    {
        $v = Validator::make($request->all(), [
            'from' => 'required|date',
            'to'   => 'required|date',
        ]);
        if ($v->fails()) return $this->validationError($v->errors());

        $tenantId = auth()->user()->tenant_id;
        $orders = Order::where('tenant_id', $tenantId)
            ->whereBetween('created_at', [$request->from, $request->to . ' 23:59:59'])
            ->where('status', 'served')
            ->with(['items', 'table', 'room', 'invoice'])
            ->get();

        $pdf = Pdf::loadView('reports.orders', [
            'orders' => $orders,
            'from'   => $request->from,
            'to'     => $request->to,
            'tenant' => auth()->user()->tenant,
        ]);

        return $pdf->download("orders-{$request->from}-to-{$request->to}.pdf");
    }

    public function exportExcel(Request $request): mixed
    {
        $v = Validator::make($request->all(), [
            'from' => 'required|date',
            'to'   => 'required|date|after_or_equal:from',
        ]);
        if ($v->fails()) return $this->validationError($v->errors());

        $orders = Order::where('tenant_id', auth()->user()->tenant_id)
            ->whereBetween('created_at', [$request->from, $request->to . ' 23:59:59'])
            ->with(['items', 'table', 'invoice'])
            ->withCount('items')
            ->latest()
            ->get();

        return Excel::download(
            new OrdersExport($orders),
            "orders-{$request->from}-to-{$request->to}.xlsx"
        );
    }

    // Expenses
    public function storeExpense(Request $request): JsonResponse
    {
        $v = Validator::make($request->all(), [
            'category'     => 'required|string|max:100',
            'description'  => 'nullable|string',
            'amount'       => 'required|numeric|min:0',
            'expense_date' => 'required|date',
        ]);
        if ($v->fails()) return $this->validationError($v->errors());

        $expense = Expense::create([
            'tenant_id'    => auth()->user()->tenant_id,
            'created_by'   => auth()->id(),
            'category'     => $request->category,
            'description'  => $request->description,
            'amount'       => $request->amount,
            'expense_date' => $request->expense_date,
        ]);
        return $this->created($expense);
    }

    public function expenses(Request $request): JsonResponse
    {
        $query = Expense::where('tenant_id', auth()->user()->tenant_id);
        if ($request->from) $query->whereDate('expense_date', '>=', $request->from);
        if ($request->to)   $query->whereDate('expense_date', '<=', $request->to);
        return $this->success($query->latest('expense_date')->get());
    }

    public function destroyExpense(Expense $expense): JsonResponse
    {
        if ($expense->tenant_id !== auth()->user()->tenant_id) return $this->forbidden();
        $expense->delete();
        return $this->success(null, 'Expense deleted');
    }
}
