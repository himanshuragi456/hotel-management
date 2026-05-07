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
        'status', 'google_place_id', 'google_review_url', 'payment_gateway',
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
