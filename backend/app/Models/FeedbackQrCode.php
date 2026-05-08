<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class FeedbackQrCode extends Model
{
    protected $fillable = [
        'tenant_id', 'qr_token', 'label', 'placement', 'is_active',
    ];

    protected static function booted(): void
    {
        static::creating(function (self $qr) {
            $qr->qr_token = Str::uuid();
        });
    }

    public function tenant()      { return $this->belongsTo(Tenant::class); }
    public function submissions() { return $this->hasMany(FeedbackSubmission::class); }
}
