<?php

namespace App\Events;

use App\Models\Order;
use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class OrderStatusUpdated implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(public Order $order) {}

    public function broadcastOn(): array
    {
        return [new Channel("tenant.{$this->order->tenant_id}.kitchen")];
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
