<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class Invoice extends Model
{
    protected $fillable = [
        'tenant_id', 'order_id', 'invoice_number', 'customer_name', 'customer_phone',
        'subtotal', 'gst_rate', 'gst_amount', 'discount_type', 'discount_value',
        'discount_amount', 'total', 'payment_method', 'amount_paid', 'amount_due',
        'status', 'split_payments', 'created_by',
    ];

    protected function casts(): array
    {
        return ['split_payments' => 'array'];
    }

    protected static function booted(): void
    {
        static::creating(function (self $inv) {
            $inv->invoice_number = 'INV-' . strtoupper(Str::random(8));
        });
    }

    public function order()     { return $this->belongsTo(Order::class); }
    public function tenant()    { return $this->belongsTo(Tenant::class); }
    public function createdBy() { return $this->belongsTo(User::class, 'created_by'); }
}
