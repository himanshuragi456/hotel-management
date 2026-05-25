<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class GmbPost extends Model
{
    protected $fillable = [
        'tenant_id', 'post_type', 'topic', 'summary',
        'call_to_action_type', 'call_to_action_url',
        'event_title', 'event_start_date', 'event_end_date',
        'offer_coupon_code', 'status', 'google_post_name',
        'suggested_at', 'published_at',
    ];

    protected $casts = [
        'suggested_at'     => 'datetime',
        'published_at'     => 'datetime',
        'event_start_date' => 'date',
        'event_end_date'   => 'date',
    ];

    public function tenant() { return $this->belongsTo(Tenant::class); }
}
