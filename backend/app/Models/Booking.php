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
        'adults', 'children', 'price_per_night', 'advance_paid',
        'advance_payment_method', 'status', 'payment_status', 'notes',
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
        return (float) $this->orders()->sum('total');
    }

    public function getTotalAmountAttribute(): float
    {
        return $this->room_charges + $this->service_charges;
    }

    public function getBalanceDueAttribute(): float
    {
        return max(0, $this->total_amount - $this->advance_paid);
    }
}
