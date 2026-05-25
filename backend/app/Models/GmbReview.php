<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class GmbReview extends Model
{
    protected $fillable = [
        'tenant_id', 'google_review_id', 'reviewer_name', 'reviewer_photo',
        'star_rating', 'comment', 'review_time',
        'reply_text', 'reply_time', 'reply_status', 'ai_reply_draft', 'replied_at',
    ];

    protected $casts = [
        'review_time' => 'datetime',
        'reply_time'  => 'datetime',
        'replied_at'  => 'datetime',
        'star_rating' => 'integer',
    ];

    public function tenant() { return $this->belongsTo(Tenant::class); }
}
