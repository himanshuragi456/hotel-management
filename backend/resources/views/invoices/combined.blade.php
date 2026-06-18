<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'DejaVu Sans', sans-serif; font-size: 11px; width: 220px; }
  .center { text-align: center; }
  .bold { font-weight: bold; }
  .line { border-top: 1px dashed #000; margin: 4px 0; }
  .solid { border-top: 2px solid #000; margin: 4px 0; }
  table { width: 100%; border-collapse: collapse; }
  td { padding: 1px 0; vertical-align: top; }
  .right { text-align: right; }
  .total-row td { font-weight: bold; font-size: 13px; }
  .upi { text-align: center; margin-top: 6px; }
  .batch-label { font-size: 10px; color: #555; margin: 3px 0 1px; }
</style>
</head>
<body>
  <div class="center bold" style="font-size:14px;">{{ $invoices->first()->tenant->name }}</div>
  @php
    $hdrTenant = $invoices->first()->tenant;
    $addrLine  = collect([$hdrTenant->address, $hdrTenant->city, $hdrTenant->state])
      ->filter()->implode(', ');
  @endphp
  @if($addrLine)
  <div class="center">{{ $addrLine }}</div>
  @endif
  @if($invoices->first()->tenant->gstin)
  <div class="center">GSTIN: {{ $invoices->first()->tenant->gstin }}</div>
  @endif

  <div class="line"></div>
  <div class="center bold">CONSOLIDATED INVOICE</div>
  <table>
    <tr><td>Date</td><td class="right">{{ now()->format('d/m/Y H:i') }}</td></tr>
    @if($invoices->first()->order->table)
    <tr><td>Table</td><td class="right">{{ $invoices->first()->order->table->number }}</td></tr>
    @endif
    @if($invoices->first()->customer_name)
    <tr><td>Customer</td><td class="right">{{ $invoices->first()->customer_name }}</td></tr>
    @endif
  </table>

  <div class="line"></div>
  <table>
    <tr>
      <td class="bold">Item</td>
      <td class="bold center">Qty</td>
      <td class="bold right">Amt</td>
    </tr>
    <tr><td colspan="3"><div class="line"></div></td></tr>
    @foreach($invoices as $invoice)
    @foreach($invoice->order->items as $item)
    <tr>
      <td>{{ $item->item_name }}</td>
      <td class="center">{{ $item->quantity }}</td>
      <td class="right">&#8377;{{ number_format($item->subtotal, 2) }}</td>
    </tr>
    @if($item->notes)
    <tr><td colspan="3" style="font-size:10px;color:#555;">  * {{ $item->notes }}</td></tr>
    @endif
    @endforeach
    @endforeach
  </table>

  <div class="line"></div>
  <table>
    <tr><td>Subtotal</td><td class="right">&#8377;{{ number_format($totals['subtotal'], 2) }}</td></tr>
    <tr><td>GST</td><td class="right">&#8377;{{ number_format($totals['gst'], 2) }}</td></tr>
    @if($totals['discount'] > 0)
    <tr><td>Discount</td><td class="right">-&#8377;{{ number_format($totals['discount'], 2) }}</td></tr>
    @endif
    @if(!empty($totals['packing']) && $totals['packing'] > 0)
    <tr><td>Packing Charges</td><td class="right">&#8377;{{ number_format($totals['packing'], 2) }}</td></tr>
    @endif
    <tr class="total-row"><td>TOTAL</td><td class="right">&#8377;{{ number_format($totals['total'], 2) }}</td></tr>
    <tr><td>Paid ({{ strtoupper($invoices->first()->payment_method) }})</td><td class="right">&#8377;{{ number_format($totals['paid'], 2) }}</td></tr>
    @if($totals['due'] > 0)
    <tr><td class="bold">Balance Due</td><td class="right bold">&#8377;{{ number_format($totals['due'], 2) }}</td></tr>
    @endif
  </table>

  @if(!empty($upiQrBase64))
  <div class="line"></div>
  <div class="upi">
    @if($totals['due'] > 0)
    <div style="font-size:10px;margin-bottom:3px;">Scan to pay balance &#8377;{{ number_format($totals['due'], 2) }}</div>
    @else
    <div style="font-size:10px;margin-bottom:3px;">Scan to pay via UPI</div>
    @endif
    <img src="{{ $upiQrBase64 }}" width="120" height="120" style="display:block;margin:0 auto;" />
  </div>
  @endif

  <div class="line"></div>
  <div class="center" style="font-size:10px;">Thank you for visiting!</div>
  <div class="center" style="font-size:9px;margin-top:2px;">{{ $invoices->first()->tenant->name }}</div>
</body>
</html>
