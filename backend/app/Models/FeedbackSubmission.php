<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class FeedbackSubmission extends Model
{
    protected $fillable = [
        'tenant_id', 'feedback_qr_code_id', 'rating', 'comment',
        'is_internal', 'submitter_name', 'submitter_phone', 'ip_address',
    ];

    protected function casts(): array
    {
        return ['is_internal' => 'boolean'];
    }

    public function tenant()  { return $this->belongsTo(Tenant::class); }
    public function qrCode()  { return $this->belongsTo(FeedbackQrCode::class, 'feedback_qr_code_id'); }
}
