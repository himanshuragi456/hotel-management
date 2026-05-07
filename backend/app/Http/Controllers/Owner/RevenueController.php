<?php

namespace App\Http\Controllers\Owner;

use App\Http\Controllers\Controller;
use App\Models\Expense;
use App\Models\Invoice;
use App\Models\Order;
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
            ->with(['items', 'table', 'waiter:id,name'])
            ->latest()
            ->get()
            ->map(function ($o) {
                $data = $o->toArray();
                $data['elapsed_minutes'] = now()->diffInMinutes($o->created_at);
                return $data;
            });
        return $this->success($orders);
    }

    public function todayRevenue(): JsonResponse
    {
        $tenantId = auth()->user()->tenant_id;
        $revenue = Invoice::where('tenant_id', $tenantId)
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

        return $this->success([
            'revenue'     => $revenue,
            'order_count' => $orderCount,
            'expenses'    => $expenses,
            'net'         => $revenue - $expenses,
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
            ->latest()
            ->get();

        return $this->success($orders);
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
            ->with(['items', 'table', 'invoice'])
            ->get();

        $pdf = Pdf::loadView('reports.orders', [
            'orders' => $orders,
            'from'   => $request->from,
            'to'     => $request->to,
            'tenant' => auth()->user()->tenant,
        ]);

        return $pdf->download("orders-{$request->from}-to-{$request->to}.pdf");
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
