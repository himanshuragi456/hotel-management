<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class Room extends Model
{
    protected $fillable = [
        'tenant_id', 'number', 'type', 'floor', 'capacity',
        'price_per_night', 'amenities', 'status', 'occupied_since', 'description', 'qr_token',
    ];

    protected static function booted(): void
    {
        static::creating(function (self $room) {
            $room->qr_token ??= (string) Str::uuid();
        });
    }

    protected function casts(): array
    {
        return [
            'amenities'     => 'array',
            'occupied_since' => 'datetime',
        ];
    }

    public function tenant()   { return $this->belongsTo(Tenant::class); }
    public function bookings() { return $this->hasMany(Booking::class); }

    public function activeBooking()
    {
        return $this->hasOne(Booking::class)->where('status', 'checked_in');
    }

    public function occupy(): void
    {
        $this->update(['status' => 'occupied', 'occupied_since' => now()]);
    }

    public function free(): void
    {
        $this->update(['status' => 'available', 'occupied_since' => null]);
    }

    public function getOccupiedMinutesAttribute(): int
    {
        if (!$this->occupied_since) return 0;
        return (int) $this->occupied_since->diffInMinutes(now());
    }

    public function getNightsAttribute(): int
    {
        $booking = $this->activeBooking;
        if (!$booking) return 0;
        return $booking->check_in_date->diffInDays($booking->check_out_date);
    }
}
