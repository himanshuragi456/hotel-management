<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class RestaurantTable extends Model
{
    protected $fillable = [
        'tenant_id', 'number', 'capacity', 'section',
        'status', 'occupied_since', 'bill_requested_at', 'qr_token',
    ];

    protected function casts(): array
    {
        return [
            'occupied_since'     => 'datetime',
            'bill_requested_at'  => 'datetime',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (self $table) {
            $table->qr_token = Str::uuid();
        });
    }

    public function tenant()        { return $this->belongsTo(Tenant::class); }
    public function activeOrder()   { return $this->hasOne(Order::class, 'restaurant_table_id')->whereNotIn('status', ['served', 'cancelled']); }

    public function occupy(): void
    {
        if ($this->status !== 'occupied') {
            $this->update(['status' => 'occupied', 'occupied_since' => now()]);
        }
    }

    public function requestBill(): void
    {
        $this->update(['bill_requested_at' => now()]);
    }

    public function clearBillRequest(): void
    {
        $this->update(['bill_requested_at' => null]);
    }

    public function free(): void
    {
        $this->update(['status' => 'free', 'occupied_since' => null, 'bill_requested_at' => null]);
    }
}
