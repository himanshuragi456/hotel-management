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
  .solid { border-top: 1px solid #000; margin: 4px 0; }
  table { width: 100%; border-collapse: collapse; }
  td { padding: 1px 0; vertical-align: top; word-break: break-word; }
  .right { text-align: right; }
  .total-row td { font-weight: bold; font-size: 13px; }
  .sub { font-size: 9px; color: #555; }
  .day-header { font-weight: bold; font-size: 10px; margin: 3px 0 1px; }
</style>
</head>
<body>

  {{-- Hotel header --}}
  <div class="center bold" style="font-size:14px;">{{ $tenant->name }}</div>
  @if($tenant->address)
  <div class="center" style="font-size:10px;">{{ $tenant->address }}@if($tenant->city), {{ $tenant->city }}@endif</div>
  @endif
  @if($tenant->phone)
  <div class="center" style="font-size:10px;">Ph: {{ $tenant->phone }}</div>
  @endif
  @if($tenant->gstin)
  <div class="center" style="font-size:10px;">GSTIN: {{ $tenant->gstin }}</div>
  @endif

  <div class="line"></div>
  <div class="center bold" style="font-size:12px;">HOTEL BILL</div>
  <div class="line"></div>

  {{-- Booking meta --}}
  <table>
    <tr><td>Booking #</td><td class="right">{{ $booking->booking_number }}</td></tr>
    <tr><td>Guest</td><td class="right">{{ $booking->guest?->name ?? '—' }}</td></tr>
    @if($booking->guest?->phone)
    <tr><td>Phone</td><td class="right">{{ $booking->guest->phone }}</td></tr>
    @endif
    <tr><td>Room</td><td class="right">{{ $booking->room?->number }} ({{ ucfirst($booking->room?->type ?? '') }})</td></tr>
    <tr><td>Check-in</td><td class="right">{{ \Carbon\Carbon::parse($booking->actual_check_in ?? $booking->check_in_date)->format('d/m/Y') }}</td></tr>
    <tr><td>Check-out</td><td class="right">{{ \Carbon\Carbon::parse($booking->actual_check_out ?? $booking->check_out_date)->format('d/m/Y') }}</td></tr>
    <tr><td>Nights</td><td class="right">{{ $nights }}</td></tr>
    <tr><td>Printed</td><td class="right">{{ now()->format('d/m/Y H:i') }}</td></tr>
  </table>

  <div class="line"></div>

  {{-- Room charges --}}
  <div class="bold" style="font-size:10px; margin-bottom:2px;">ROOM CHARGES</div>
  <table>
    <tr>
      @if($decidedAmount !== null)
      <td>Room charges ({{ $nights }} night{{ $nights != 1 ? 's' : '' }})</td>
      @else
      <td>{{ $nights }} night{{ $nights != 1 ? 's' : '' }} × ₹{{ number_format($booking->price_per_night, 2) }}</td>
      @endif
      <td class="right">₹{{ number_format($roomCharges, 2) }}</td>
    </tr>
    @if($gstRate > 0)
      @if($gstInclusive)
      <tr><td colspan="2" class="sub">Prices include {{ $gstRate }}% GST</td></tr>
      @else
      <tr>
        <td>GST ({{ $gstRate }}%)</td>
        <td class="right">₹{{ number_format($roomGst, 2) }}</td>
      </tr>
      @endif
    @endif
  </table>

  {{-- Room service orders --}}
  @if($serviceOrders->count())
  <div class="line"></div>
  <div class="bold" style="font-size:10px; margin-bottom:2px;">ROOM SERVICE</div>
  @foreach($byDate as $date => $orders)
  <div class="day-header">{{ \Carbon\Carbon::parse($date)->format('d M Y') }}</div>
  @foreach($orders as $order)
  @foreach($order->items as $item)
  <table>
    <tr>
      <td style="width:60%">{{ $item->item_name }}@if($item->variant_name) ({{ $item->variant_name }})@endif × {{ $item->quantity }}</td>
      <td class="right">₹{{ number_format($item->subtotal, 2) }}</td>
    </tr>
  </table>
  @endforeach
  @endforeach
  @endforeach
  @endif

  <div class="solid"></div>

  {{-- Totals --}}
  <table>
    <tr><td>Room charges</td><td class="right">₹{{ number_format($roomTotal, 2) }}</td></tr>
    @if($serviceCharges > 0)
    <tr><td>Room service</td><td class="right">₹{{ number_format($serviceCharges, 2) }}</td></tr>
    @endif
  </table>
  <div class="solid"></div>
  <table>
    <tr class="total-row"><td>Total</td><td class="right">₹{{ number_format($totalAmount, 2) }}</td></tr>
  </table>

  @if($advancePaid > 0)
  <div class="line"></div>
  <table>
    <tr><td>Advance paid</td><td class="right">- ₹{{ number_format($advancePaid, 2) }}</td></tr>
  </table>
  <div class="solid"></div>
  <table>
    <tr class="total-row"><td>Amount Due</td><td class="right">₹{{ number_format(max(0, $totalAmount - $advancePaid), 2) }}</td></tr>
  </table>
  @endif

  @if($paymentMethod)
  <div class="line"></div>
  <div class="center" style="font-size:10px;">Paid by {{ strtoupper($paymentMethod) }}</div>
  @endif

  <div class="line"></div>
  <div class="center" style="font-size:9px; color:#555;">Thank you for staying with us!</div>

</body>
</html>
