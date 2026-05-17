<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class Order extends Model
{
    protected $fillable = [
        'tenant_id', 'restaurant_table_id', 'room_id', 'booking_id', 'waiter_id',
        'order_number', 'type', 'status', 'preparing_at', 'notes',
        'subtotal', 'tax', 'discount', 'total',
        'customer_name', 'customer_phone',
    ];

    protected $casts = [
        'preparing_at' => 'datetime',
    ];

    protected static function booted(): void
    {
        static::creating(function (self $order) {
            $order->order_number = 'ORD-' . strtoupper(Str::random(8));
        });
    }

    public function tenant()  { return $this->belongsTo(Tenant::class); }
    public function table()   { return $this->belongsTo(RestaurantTable::class, 'restaurant_table_id'); }
    public function waiter()  { return $this->belongsTo(User::class, 'waiter_id'); }
    public function items()   { return $this->hasMany(OrderItem::class); }
    public function invoice() { return $this->hasOne(Invoice::class); }
    public function booking() { return $this->belongsTo(Booking::class); }
    public function room()    { return $this->belongsTo(Room::class, 'room_id'); }

    public function recalculate(): void
    {
        $subtotal = $this->items->sum('subtotal');
        $tenant   = $this->tenant;
        $tax      = round($subtotal * ($tenant->gst_rate / 100), 2);
        $this->update([
            'subtotal' => $subtotal,
            'tax'      => $tax,
            'total'    => $subtotal + $tax - $this->discount,
        ]);
    }
}
