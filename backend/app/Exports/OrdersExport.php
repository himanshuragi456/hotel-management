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
        return ['Order #', 'Type', 'Table / Room', 'Date', 'Items', 'Total', 'Tax', 'Payment', 'Status'];
    }

    /** @param \App\Models\Order $order */
    public function map($order): array
    {
        $where = $order->type === 'room-service'
            ? 'Room ' . ($order->room_id ?? '?')
            : 'Table ' . ($order->table->number ?? '—');

        return [
            $order->order_number,
            $order->type,
            $where,
            optional($order->created_at)->format('Y-m-d H:i'),
            $order->items_count ?? $order->items->count(),
            (float) ($order->invoice->total ?? $order->total ?? 0),
            (float) ($order->invoice->tax ?? 0),
            $order->invoice->payment_method ?? '',
            $order->status,
        ];
    }
}
