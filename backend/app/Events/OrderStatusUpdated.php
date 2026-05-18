<?php

namespace App\Events;

use App\Models\Order;
use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class OrderStatusUpdated implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(public Order $order) {}

    public function broadcastOn(): array
    {
        $channels = [new Channel("tenant.{$this->order->tenant_id}.kitchen")];

        // Also push to the table's public channel so the customer QR page
        // can update in real-time without polling.
        if ($this->order->restaurant_table_id) {
            $channels[] = new Channel("tenant.{$this->order->tenant_id}.table.{$this->order->restaurant_table_id}");
        }

        return $channels;
    }

    public function broadcastAs(): string
    {
        return 'order.updated';
    }

    public function broadcastWith(): array
    {
        return [
            'id'           => $this->order->id,
            'order_number' => $this->order->order_number,
            'status'       => $this->order->status,
            'type'         => $this->order->type,
            'table'        => $this->order->table?->only(['id', 'number', 'section']),
            'items'        => $this->order->items->map(fn($i) => [
                'name'     => $i->item_name,
                'quantity' => $i->quantity,
                'notes'    => $i->notes,
            ]),
            'notes'        => $this->order->notes,
            'created_at'   => $this->order->created_at,
        ];
    }
}
