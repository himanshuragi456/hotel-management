<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class Order extends Model
{
    protected $fillable = [
        'tenant_id', 'restaurant_table_id', 'room_id', 'booking_id', 'waiter_id',
        'order_number', 'type', 'source', 'platform', 'external_order_id', 'aggregator_status',
        'rejection_code', 'rejection_note', 'rejected_item_ids', 'cancelled_at',
        'payment_status', 'razorpay_order_id', 'razorpay_payment_id',
        'status', 'preparing_at', 'notes', 'no_cutlery',
        'subtotal', 'tax', 'discount', 'packing_charge', 'total',
        'customer_name', 'customer_phone', 'customer_email',
    ];

    protected $casts = [
        'preparing_at'      => 'datetime',
        'cancelled_at'      => 'datetime',
        'rejected_item_ids' => 'array',
        'no_cutlery'        => 'boolean',
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
        $items     = $this->items;
        $subtotal  = $items->sum('subtotal');
        $tenant    = $this->tenant;
        $inclusive = (bool) ($tenant->gst_inclusive ?? false);

        // Prefer per-line GST (set by OrderService). Fall back to tenant rate for legacy lines.
        $tax = 0.0;
        foreach ($items as $item) {
            $rate    = $item->gst_rate !== null ? (float) $item->gst_rate : (float) ($tenant->gst_rate ?? 5);
            $lineGst = (float) $item->cgst_amount + (float) $item->sgst_amount;
            if ($lineGst <= 0) {
                $s = (float) $item->subtotal;
                $lineGst = $inclusive
                    ? round($s - $s / (1 + $rate / 100), 2)
                    : round($s * ($rate / 100), 2);
            }
            $tax += $lineGst;
        }
        $tax = round($tax, 2);

        // Packing charge is a flat add-on (no GST applied here) — same whether prices are
        // GST-inclusive or not.
        $packing = (float) ($this->packing_charge ?? 0);

        // Inclusive: price already contains tax, so total = subtotal (not subtotal + tax).
        $this->update([
            'subtotal'       => $subtotal,
            'tax'            => $tax,
            'packing_charge' => $packing,
            'total'    => ($inclusive
                ? $subtotal - $this->discount
                : $subtotal + $tax - $this->discount) + $packing,
        ]);
    }
}
