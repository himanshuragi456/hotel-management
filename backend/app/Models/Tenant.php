<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Tenant extends Model
{
    protected $fillable = [
        'name', 'slug', 'email', 'phone', 'address', 'city', 'state',
        'country', 'gstin', 'gst_rate', 'gst_inclusive', 'logo', 'currency', 'timezone',
        'status', 'is_open', 'zomato_online', 'swiggy_online', 'offline_reason', 'offline_until',
        'qr_ordering_enabled', 'customer_bill_request_enabled',
        'kot_enabled', 'kot_auto_print', 'kot_printer', 'bill_auto_print', 'feedback_on_bill', 'upi_id',
        'contact_phones', 'active_contact_phone',
        'google_place_id', 'google_review_url',
        'gmb_account_id', 'gmb_location_id', 'gmb_access_token', 'gmb_refresh_token',
        'gmb_token_expires_at', 'gmb_location_name', 'gmb_auto_reply_enabled',
        'gmb_auto_reply_tone', 'gmb_reviews_last_fetched_at',
        'payment_gateway', 'business_domain', 'review_suggestions',
        'ai_suggestions_enabled', 'ai_monthly_quota', 'ai_usage_this_month', 'ai_usage_reset_at',
    ];

    protected $casts = [
        'review_suggestions'     => 'array',
        'contact_phones'         => 'array',
        'gst_inclusive'                     => 'boolean',
        'is_open'                           => 'boolean',
        'zomato_online'                     => 'boolean',
        'swiggy_online'                     => 'boolean',
        'offline_until'                     => 'datetime',
        'qr_ordering_enabled'               => 'boolean',
        'customer_bill_request_enabled'     => 'boolean',
        'kot_enabled'                       => 'boolean',
        'kot_auto_print'                    => 'boolean',
        'bill_auto_print'                   => 'boolean',
        'feedback_on_bill'                  => 'boolean',
        'gmb_auto_reply_enabled'      => 'boolean',
        'gmb_token_expires_at'        => 'datetime',
        'gmb_reviews_last_fetched_at' => 'datetime',
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

    public function locations(): BelongsToMany
    {
        return $this->belongsToMany(Location::class, 'tenant_locations');
    }

    public function outletHours(): HasMany
    {
        return $this->hasMany(OutletHour::class);
    }
}
