<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Subscription extends Model
{
    protected $fillable = [
        'tenant_id', 'subscription_plan_id', 'billing_cycle', 'status',
        'payment_gateway', 'gateway_subscription_id', 'gateway_customer_id',
        'amount', 'trial_ends_at', 'current_period_start', 'current_period_end', 'cancelled_at',
    ];

    protected function casts(): array
    {
        return [
            'trial_ends_at'        => 'datetime',
            'current_period_start' => 'datetime',
            'current_period_end'   => 'datetime',
            'cancelled_at'         => 'datetime',
        ];
    }

    public function tenant()
    {
        return $this->belongsTo(Tenant::class);
    }

    public function plan()
    {
        return $this->belongsTo(SubscriptionPlan::class, 'subscription_plan_id');
    }

    public function isActive(): bool
    {
        return in_array($this->status, ['active', 'trial']);
    }
}
