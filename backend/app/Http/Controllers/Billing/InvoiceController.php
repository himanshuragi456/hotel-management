<?php

namespace App\Http\Controllers\Billing;

use App\Http\Controllers\Controller;
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

    public function readyOrders(): JsonResponse
    {
        $orders = Order::where('tenant_id', auth()->user()->tenant_id)
            ->where('status', 'ready')
            ->whereDoesntHave('invoice')
            ->with(['items', 'table'])
            ->latest()
            ->get();
        return $this->success($orders);
    }

    public function allOrders(Request $request): JsonResponse
    {
        $query = Order::where('tenant_id', auth()->user()->tenant_id)
            ->with(['items', 'table', 'invoice']);
        if ($request->status) $query->where('status', $request->status);
        return $this->success($query->latest()->paginate(20));
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

        // Mark order served and free the table
        $order->update(['status' => 'served']);
        if ($order->restaurant_table_id) {
            RestaurantTable::find($order->restaurant_table_id)?->free();
        }

        return $this->created($invoice->load('order.items'), 'Invoice created');
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

        $upiId  = request()->query('upi_id', 'restaurant@upi');
        $amount = $invoice->amount_due > 0 ? $invoice->amount_due : $invoice->total;
        $upiUrl = "upi://pay?pa={$upiId}&pn=" . urlencode($invoice->tenant->name) . "&am={$amount}&cu=INR";
        $upiQr  = base64_encode(QrCode::format('png')->size(120)->generate($upiUrl));

        $pdf = Pdf::loadView('invoices.receipt', [
            'invoice' => $invoice,
            'upiQr'   => $upiQr,
        ])->setPaper([0, 0, 226.77, 600], 'portrait'); // ~80mm thermal width

        return $pdf->download("invoice-{$invoice->invoice_number}.pdf");
    }
}
