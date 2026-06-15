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
  table { width: 100%; border-collapse: collapse; table-layout: fixed; }
  td { padding: 1px 0; vertical-align: top; word-break: break-word; }
  .right { text-align: right; }
  .col-item { width: 55%; }
  .col-qty  { width: 15%; text-align: center; }
  .col-amt  { width: 30%; text-align: right; }
  .total-row td { font-weight: bold; font-size: 13px; }
  .sub-line { font-size: 9px; color: #555; padding-left: 6px; }
  .upi { text-align: center; margin-top: 6px; margin-bottom: 8px; }
  .feedback { text-align: center; margin: 4px 0; }
</style>
</head>
<body>
  <div class="center bold" style="font-size:14px;">{{ $invoice->tenant->name }}</div>
  @php
    $addrLine = collect([$invoice->tenant->address, $invoice->tenant->city, $invoice->tenant->state])
      ->filter()->implode(', ');
  @endphp
  @if($addrLine)
  <div class="center">{{ $addrLine }}</div>
  @endif
  @if($invoice->tenant->gstin)
  <div class="center">GSTIN: {{ $invoice->tenant->gstin }}</div>
  @endif

  @if(!empty($feedbackQrBase64))
  <div class="line"></div>
  <div class="feedback">
    <div style="font-size:10px;margin-bottom:3px;font-weight:bold;">Leave us your feedback!</div>
    <img src="{{ $feedbackQrBase64 }}" width="65" height="65" style="display:block;margin:0 auto;" />
    <div style="font-size:9px;color:#555;margin-top:2px;">Scan to rate your experience</div>
  </div>
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

  @php $gstInclusive = (bool) ($invoice->tenant->gst_inclusive ?? false); @endphp

  <table>
    <tr>
      <td class="bold col-item">Item</td>
      <td class="bold col-qty">Qty</td>
      <td class="bold col-amt">Amount{{ $gstInclusive ? '*' : '' }}</td>
    </tr>
    <tr><td colspan="3"><div class="line"></div></td></tr>
    @foreach($invoice->order->items as $item)
    <tr>
      <td class="col-item">
        {{ $item->item_name }}
        @if($item->variant_name)
        <div class="sub-line">({{ $item->variant_name }})</div>
        @endif
        @if(!empty($item->addons))
          @foreach($item->addons as $addon)
          <div class="sub-line">+ {{ $addon['name'] }}@if(!empty($addon['price']) && $addon['price'] > 0) &#8377;{{ number_format($addon['price'], 0) }}@endif</div>
          @endforeach
        @endif
        @if($item->notes)
        <div class="sub-line">* {{ $item->notes }}</div>
        @endif
        @php
          // Show per-item GST slab if it differs from the invoice-level rate
          $itemGstRate = $item->gst_rate;
          $invoiceGstRate = round($invoice->gst_rate, 1);
          $showItemGst = $itemGstRate !== null && round($itemGstRate, 1) !== $invoiceGstRate;
        @endphp
        @if($showItemGst)
        <div class="sub-line">GST {{ round($itemGstRate, 1) }}%</div>
        @endif
      </td>
      <td class="col-qty">{{ $item->quantity }}</td>
      <td class="col-amt">&#8377;{{ number_format($item->subtotal, 2) }}</td>
    </tr>
    @endforeach
  </table>

  @if($gstInclusive)
  <div style="font-size:9px;color:#555;margin-top:2px;">* Prices include GST</div>
  @endif

  <div class="line"></div>
  <table>
    <tr><td>Subtotal</td><td class="right">&#8377;{{ number_format($invoice->subtotal, 2) }}</td></tr>
    @if($gstInclusive)
    @php $effRate = round($invoice->gst_rate, 2); $rateLabel = ($effRate == floor($effRate)) ? (int)$effRate : $effRate; @endphp
    <tr><td style="font-size:9px;color:#555;">  incl. GST ({{ $rateLabel }}%)</td><td class="right" style="font-size:9px;color:#555;">&#8377;{{ number_format($invoice->gst_amount, 2) }}</td></tr>
    @else
    @php $r = round($invoice->gst_rate, 2); $rateLabel = ($r == floor($r)) ? (int)$r : $r; @endphp
    <tr><td>GST ({{ $rateLabel }}%)</td><td class="right">&#8377;{{ number_format($invoice->gst_amount, 2) }}</td></tr>

    {{-- Show CGST/SGST breakdown when bifurcation is used --}}
    @php
      $cgstTotal = $invoice->order->items->sum('cgst_amount');
      $sgstTotal = $invoice->order->items->sum('sgst_amount');
    @endphp
    @if($cgstTotal > 0 || $sgstTotal > 0)
    <tr><td style="font-size:9px;color:#555;">  CGST</td><td class="right" style="font-size:9px;color:#555;">&#8377;{{ number_format($cgstTotal, 2) }}</td></tr>
    <tr><td style="font-size:9px;color:#555;">  SGST</td><td class="right" style="font-size:9px;color:#555;">&#8377;{{ number_format($sgstTotal, 2) }}</td></tr>
    @endif
    @endif

    @if($invoice->discount_amount > 0)
    <tr><td>Discount</td><td class="right">-&#8377;{{ number_format($invoice->discount_amount, 2) }}</td></tr>
    @endif
    <tr class="total-row"><td>TOTAL</td><td class="right">&#8377;{{ number_format($invoice->total, 2) }}</td></tr>
    <tr><td>Paid ({{ strtoupper($invoice->payment_method) }})</td><td class="right">&#8377;{{ number_format($invoice->amount_paid, 2) }}</td></tr>
    @if($invoice->amount_due > 0)
    <tr><td class="bold">Balance Due</td><td class="right bold">&#8377;{{ number_format($invoice->amount_due, 2) }}</td></tr>
    @endif
  </table>

  @if(!empty($upiQrBase64))
  <div class="line"></div>
  <div class="upi">
    @if($invoice->amount_due > 0)
    <div style="font-size:10px;margin-bottom:3px;">Scan to pay balance &#8377;{{ number_format($invoice->amount_due, 2) }}</div>
    @else
    <div style="font-size:10px;margin-bottom:3px;">Scan to pay &#8377;{{ number_format($invoice->total, 2) }} via UPI</div>
    @endif
    <img src="{{ $upiQrBase64 }}" width="96" height="96" style="display:block;margin:0 auto;" />
  </div>
  @endif

  <div class="line"></div>
  <div class="center" style="font-size:10px;">Thank you for visiting!</div>
  <div class="center" style="font-size:9px;margin-top:2px;">{{ $invoice->tenant->name }}</div>
  <div class="center" style="font-size:8px;color:#000;margin-top:2px;">Software powered by www.magicmanagement.in</div>
</body>
</html>
