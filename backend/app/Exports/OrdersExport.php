<?php

namespace App\Exports;

use Illuminate\Support\Collection;
use Maatwebsite\Excel\Concerns\FromCollection;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithMapping;

/**
 * Orders report → XLSX. Columns mirror the on-screen Orders Report table so the
 * download matches what the owner sees. Built from an already-loaded, already
 * tenant-scoped collection (the controller does the query + auth).
 */
class OrdersExport implements FromCollection, WithHeadings, WithMapping
{
    public function __construct(private Collection $orders) {}

    public function collection(): Collection
    {
        return $this->orders;
    }

    public function headings(): array
    {
        return ['Order #', 'Table', 'Items', 'Subtotal', 'GST', 'Total', 'Payment', 'Status', 'Time'];
    }

    /** @param \App\Models\Order $order */
    public function map($order): array
    {
        if ($order->table) {
            $where = 'Table ' . $order->table->number;
        } elseif ($order->type === 'room-service') {
            $where = 'Room ' . ($order->room?->number ?? 'Service');
        } elseif ($order->type === 'takeaway' && $order->source === 'aggregator') {
            $where = ucfirst($order->platform ?? 'Aggregator');
        } elseif ($order->type === 'takeaway') {
            $where = 'Takeaway';
        } else {
            $where = '—';
        }

        return [
            $order->order_number,
            $where,
            $order->items_count ?? $order->items->count(),
            (float) ($order->subtotal ?? 0),
            (float) ($order->tax ?? 0),
            (float) ($order->total ?? 0),
            $order->invoice->payment_method ?? '—',
            $order->status,
            optional($order->created_at)->setTimezone('Asia/Kolkata')->format('d M H:i'),
        ];
    }
}
