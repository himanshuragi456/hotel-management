<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class Booking extends Model
{
    protected $fillable = [
        'tenant_id', 'guest_id', 'room_id', 'created_by',
        'booking_number', 'check_in_date', 'check_out_date',
        'actual_check_in', 'actual_check_out',
        'adults', 'children', 'price_per_night', 'gst_rate', 'gst_inclusive', 'decided_amount',
        'advance_paid', 'advance_payment_method', 'status', 'payment_status', 'notes',
    ];

    protected function casts(): array
    {
        return [
            'check_in_date'    => 'date',
            'check_out_date'   => 'date',
            'actual_check_in'  => 'datetime',
            'actual_check_out' => 'datetime',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (self $booking) {
            $booking->booking_number = 'BKG-' . strtoupper(Str::random(8));
        });
    }

    public function tenant()    { return $this->belongsTo(Tenant::class); }
    public function guest()     { return $this->belongsTo(Guest::class); }
    public function room()      { return $this->belongsTo(Room::class); }
    public function createdBy() { return $this->belongsTo(User::class, 'created_by'); }
    public function orders()    { return $this->hasMany(Order::class); }

    public function getNightsAttribute(): int
    {
        return $this->check_in_date->diffInDays($this->check_out_date);
    }

    public function getRoomChargesAttribute(): float
    {
        return $this->nights * $this->price_per_night;
    }

    public function getServiceChargesAttribute(): float
    {
        return (float) $this->orders()->whereNotIn('status', ['cancelled'])->whereDoesntHave('invoice')->sum('total');
    }

    public function getRoomGstAmountAttribute(): float
    {
        $rate = (float) ($this->gst_rate ?? 0);
        if ($rate <= 0) return 0.0;
        $base = $this->room_charges;
        if ($this->gst_inclusive) {
            // GST is extracted from the price: GST = base * rate / (100 + rate)
            return round($base * $rate / (100 + $rate), 2);
        }
        return round($base * $rate / 100, 2);
    }

    public function getComputedRoomTotalAttribute(): float
    {
        $gst = $this->gst_inclusive ? 0.0 : $this->room_gst_amount;
        return $this->room_charges + $gst;
    }

    public function getDecidedGstAmountAttribute(): float
    {
        if ($this->decided_amount === null) return 0.0;
        $rate = (float) ($this->gst_rate ?? 0);
        if ($rate <= 0) return 0.0;
        $base = (float) $this->decided_amount;
        return $this->gst_inclusive
            ? round($base * $rate / (100 + $rate), 2)
            : round($base * $rate / 100, 2);
    }

    public function getTotalAmountAttribute(): float
    {
        if ($this->decided_amount !== null) {
            $base = (float) $this->decided_amount;
            $gst  = $this->gst_inclusive ? 0.0 : $this->decided_gst_amount;
            return $base + $gst + $this->service_charges;
        }
        return $this->computed_room_total + $this->service_charges;
    }

    public function getBalanceDueAttribute(): float
    {
        return max(0, $this->total_amount - $this->advance_paid);
    }
}
