<?php

namespace App\Http\Controllers\Owner;

use App\Http\Controllers\Controller;
use App\Models\Booking;
use App\Models\Expense;
use App\Models\Invoice;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Room;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class AnalyticsController extends Controller
{
    use ApiResponse;

    public function overview(Request $request): JsonResponse
    {
        $tid  = auth()->user()->tenant_id;
        $days = (int) $request->query('days', 30);
        $from = now()->subDays($days)->startOfDay();

        // Revenue by day
        $revenueByDay = Invoice::where('tenant_id', $tid)
            ->where('status', 'paid')
            ->where('created_at', '>=', $from)
            ->selectRaw('DATE(created_at) as date, SUM(total) as revenue, COUNT(*) as orders')
            ->groupBy('date')
            ->orderBy('date')
            ->get();

        // Expense by day
        $expenseByDay = Expense::where('tenant_id', $tid)
            ->where('expense_date', '>=', $from->toDateString())
            ->selectRaw('expense_date as date, SUM(amount) as expenses')
            ->groupBy('date')
            ->orderBy('date')
            ->get()
            ->keyBy('date');

        // Merge into combined chart data
        $chartData = $revenueByDay->map(fn($row) => [
            'date'     => $row->date,
            'revenue'  => (float) $row->revenue,
            'orders'   => (int) $row->orders,
            'expenses' => (float) ($expenseByDay[$row->date]?->expenses ?? 0),
            'profit'   => (float) $row->revenue - (float) ($expenseByDay[$row->date]?->expenses ?? 0),
        ]);

        // Totals
        $totalRevenue  = $revenueByDay->sum('revenue');
        $totalExpenses = Expense::where('tenant_id', $tid)->where('expense_date', '>=', $from->toDateString())->sum('amount');
        $totalOrders   = $revenueByDay->sum('orders');

        // Top menu items
        $topItems = OrderItem::whereHas('order', fn($q) => $q->where('tenant_id', $tid)->where('created_at', '>=', $from))
            ->selectRaw('item_name, SUM(quantity) as total_qty, SUM(subtotal) as total_revenue')
            ->groupBy('item_name')
            ->orderByDesc('total_qty')
            ->limit(10)
            ->get();

        // Peak hours (order count by hour)
        $peakHours = Order::where('tenant_id', $tid)
            ->where('created_at', '>=', $from)
            ->selectRaw('HOUR(created_at) as hour, COUNT(*) as count')
            ->groupBy('hour')
            ->orderBy('hour')
            ->get()
            ->keyBy('hour');

        $hourlyData = collect(range(0, 23))->map(fn($h) => [
            'hour'  => $h,
            'label' => str_pad($h, 2, '0', STR_PAD_LEFT) . ':00',
            'count' => (int) ($peakHours[$h]?->count ?? 0),
        ]);

        // Table turnover
        $tableStats = Order::where('tenant_id', $tid)
            ->where('created_at', '>=', $from)
            ->whereNotNull('restaurant_table_id')
            ->where('status', 'served')
            ->selectRaw('restaurant_table_id, COUNT(*) as orders')
            ->groupBy('restaurant_table_id')
            ->with('table:id,number')
            ->get();

        // Occupancy (hotel)
        $totalRooms   = Room::where('tenant_id', $tid)->count();
        $bookedNights = Booking::where('tenant_id', $tid)
            ->whereNotIn('status', ['cancelled'])
            ->where('check_in_date', '>=', $from->toDateString())
            ->get()
            ->sum('nights');
        $occupancyRate = $totalRooms > 0 ? round(($bookedNights / ($totalRooms * $days)) * 100, 1) : 0;

        return $this->success([
            'period'        => ['days' => $days, 'from' => $from->toDateString(), 'to' => now()->toDateString()],
            'totals'        => [
                'revenue'       => (float) $totalRevenue,
                'expenses'      => (float) $totalExpenses,
                'profit'        => (float) $totalRevenue - (float) $totalExpenses,
                'orders'        => (int)   $totalOrders,
            ],
            'chart_data'    => $chartData->values(),
            'top_items'     => $topItems,
            'peak_hours'    => $hourlyData->values(),
            'table_stats'   => $tableStats,
            'hotel'         => [
                'total_rooms'    => $totalRooms,
                'booked_nights'  => $bookedNights,
                'occupancy_rate' => $occupancyRate,
            ],
        ]);
    }

    public function ownerAuditLog(Request $request): JsonResponse
    {
        $tid  = auth()->user()->tenant_id;
        $from = $request->query('from');
        $to   = $request->query('to');
        $action = $request->query('action');

        $query = \App\Models\AuditLog::where('tenant_id', $tid)
            ->with('user:id,name,role')
            ->latest();

        if ($from)   $query->whereDate('created_at', '>=', $from);
        if ($to)     $query->whereDate('created_at', '<=', $to);
        if ($action) $query->where('action', 'like', "%{$action}%");

        return $this->success($query->paginate(30));
    }
}
