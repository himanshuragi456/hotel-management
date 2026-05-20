<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Tenant extends Model
{
    protected $fillable = [
        'name', 'slug', 'email', 'phone', 'address', 'city', 'state',
        'country', 'gstin', 'gst_rate', 'logo', 'currency', 'timezone',
        'status', 'qr_ordering_enabled', 'customer_bill_request_enabled',
        'kot_enabled', 'kot_auto_print', 'kot_printer', 'bill_auto_print', 'feedback_on_bill', 'upi_id',
        'google_place_id', 'google_review_url',
        'payment_gateway', 'business_domain', 'review_suggestions',
        'ai_suggestions_enabled', 'ai_monthly_quota', 'ai_usage_this_month', 'ai_usage_reset_at',
    ];

    protected $casts = [
        'review_suggestions'     => 'array',
        'qr_ordering_enabled'               => 'boolean',
        'customer_bill_request_enabled'     => 'boolean',
        'kot_enabled'                       => 'boolean',
        'kot_auto_print'                    => 'boolean',
        'bill_auto_print'                   => 'boolean',
        'feedback_on_bill'                  => 'boolean',
        'ai_suggestions_enabled' => 'boolean',
        'ai_monthly_quota'       => 'integer',
        'ai_usage_this_month'    => 'integer',
        'ai_usage_reset_at'      => 'date',
    ];

    public function users(): HasMany
    {
        return $this->hasMany(User::class);
    }

    public function modules(): HasOne
    {
        return $this->hasOne(TenantModule::class);
    }

    public function subscription(): HasOne
    {
        return $this->hasOne(Subscription::class)->latestOfMany();
    }
}
