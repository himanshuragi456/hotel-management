<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  body { font-family: 'DejaVu Sans', sans-serif; font-size: 12px; color: #333; }
  h1 { font-size: 18px; margin-bottom: 4px; }
  .meta { color: #666; font-size: 11px; margin-bottom: 16px; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; }
  th { background: #f3f4f6; text-align: left; padding: 6px 8px; font-size: 11px; }
  td { padding: 5px 8px; border-bottom: 1px solid #e5e7eb; font-size: 11px; }
  .total { font-weight: bold; }
  .summary { margin-top: 16px; padding: 12px; background: #f9fafb; border-radius: 4px; }
</style>
</head>
<body>
  <h1>{{ $tenant->name }} — Orders Report</h1>
  <div class="meta">Period: {{ $from }} to {{ $to }} &nbsp;|&nbsp; Generated: {{ now()->format('d M Y H:i') }}</div>

  <table>
    <thead>
      <tr>
        <th>Order #</th>
        <th>Table</th>
        <th>Items</th>
        <th>Subtotal</th>
        <th>GST</th>
        <th>Total</th>
        <th>Payment</th>
        <th>Status</th>
        <th>Time</th>
      </tr>
    </thead>
    <tbody>
      @foreach($orders as $order)
      <tr>
        <td>{{ $order->order_number }}</td>
        <td>
          @if($order->table)
            Table {{ $order->table->number }}
          @elseif($order->type === 'room-service')
            Room {{ $order->room?->number ?? 'Service' }}
          @elseif($order->type === 'takeaway' && $order->source === 'aggregator')
            {{ ucfirst($order->platform ?? 'Aggregator') }}
          @elseif($order->type === 'takeaway')
            Takeaway
          @else
            —
          @endif
        </td>
        <td>{{ $order->items->sum('quantity') }} items</td>
        <td>₹{{ number_format($order->subtotal, 2) }}</td>
        <td>₹{{ number_format($order->tax, 2) }}</td>
        <td class="total">₹{{ number_format($order->total, 2) }}</td>
        <td>{{ $order->invoice->payment_method ?? '—' }}</td>
        <td>{{ $order->status }}</td>
        <td>{{ $order->created_at->setTimezone('Asia/Kolkata')->format('d M H:i') }}</td>
      </tr>
      @endforeach
    </tbody>
  </table>

  <div class="summary">
    <strong>Summary</strong><br>
    Total Orders: {{ $orders->count() }} &nbsp;|&nbsp;
    Total Revenue: ₹{{ number_format($orders->sum('total'), 2) }} &nbsp;|&nbsp;
    Total Items Sold: {{ $orders->sum(fn($o) => $o->items->sum('quantity')) }}
  </div>
</body>
</html>
