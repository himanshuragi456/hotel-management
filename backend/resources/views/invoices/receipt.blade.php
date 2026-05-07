<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: monospace; font-size: 11px; width: 220px; }
  .center { text-align: center; }
  .bold { font-weight: bold; }
  .line { border-top: 1px dashed #000; margin: 4px 0; }
  table { width: 100%; border-collapse: collapse; }
  td { padding: 1px 0; vertical-align: top; }
  .right { text-align: right; }
  .total-row td { font-weight: bold; font-size: 13px; }
  .upi { text-align: center; margin-top: 6px; }
</style>
</head>
<body>
  <div class="center bold" style="font-size:14px;">{{ $invoice->tenant->name }}</div>
  @if($invoice->tenant->address)
  <div class="center">{{ $invoice->tenant->address }}, {{ $invoice->tenant->city }}</div>
  @endif
  @if($invoice->tenant->gstin)
  <div class="center">GSTIN: {{ $invoice->tenant->gstin }}</div>
  @endif

  <div class="line"></div>
  <div class="center bold">INVOICE</div>
  <table>
    <tr><td>Invoice#</td><td class="right">{{ $invoice->invoice_number }}</td></tr>
    <tr><td>Date</td><td class="right">{{ $invoice->created_at->format('d/m/Y H:i') }}</td></tr>
    @if($invoice->order->table)
    <tr><td>Table</td><td class="right">{{ $invoice->order->table->number }}</td></tr>
    @endif
    @if($invoice->customer_name)
    <tr><td>Customer</td><td class="right">{{ $invoice->customer_name }}</td></tr>
    @endif
  </table>

  <div class="line"></div>
  <table>
    <tr>
      <td class="bold">Item</td>
      <td class="bold center">Qty</td>
      <td class="bold right">Amount</td>
    </tr>
    <tr><td colspan="3"><div class="line"></div></td></tr>
    @foreach($invoice->order->items as $item)
    <tr>
      <td>{{ $item->item_name }}</td>
      <td class="center">{{ $item->quantity }}</td>
      <td class="right">₹{{ number_format($item->subtotal, 2) }}</td>
    </tr>
    @if($item->notes)
    <tr><td colspan="3" style="font-size:10px;color:#555;">  * {{ $item->notes }}</td></tr>
    @endif
    @endforeach
  </table>

  <div class="line"></div>
  <table>
    <tr><td>Subtotal</td><td class="right">₹{{ number_format($invoice->subtotal, 2) }}</td></tr>
    <tr><td>GST ({{ $invoice->gst_rate }}%)</td><td class="right">₹{{ number_format($invoice->gst_amount, 2) }}</td></tr>
    @if($invoice->discount_amount > 0)
    <tr><td>Discount</td><td class="right">-₹{{ number_format($invoice->discount_amount, 2) }}</td></tr>
    @endif
    <tr class="total-row"><td>TOTAL</td><td class="right">₹{{ number_format($invoice->total, 2) }}</td></tr>
    <tr><td>Paid ({{ strtoupper($invoice->payment_method) }})</td><td class="right">₹{{ number_format($invoice->amount_paid, 2) }}</td></tr>
    @if($invoice->amount_due > 0)
    <tr><td class="bold">Balance Due</td><td class="right bold">₹{{ number_format($invoice->amount_due, 2) }}</td></tr>
    @endif
  </table>

  @if(isset($upiQr) && $invoice->amount_due > 0)
  <div class="line"></div>
  <div class="upi">
    <div style="font-size:10px;margin-bottom:3px;">Scan to pay ₹{{ number_format($invoice->amount_due, 2) }}</div>
    <img src="data:image/png;base64,{{ $upiQr }}" width="100" height="100" />
  </div>
  @endif

  <div class="line"></div>
  <div class="center" style="font-size:10px;">Thank you for visiting!</div>
  <div class="center" style="font-size:9px;margin-top:2px;">{{ $invoice->tenant->name }}</div>
</body>
</html>
