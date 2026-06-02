<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class OutletHour extends Model
{
    protected $fillable = [
        'tenant_id', 'channel', 'day_of_week', 'open_time', 'close_time',
    ];

    protected function casts(): array
    {
        return ['day_of_week' => 'integer'];
    }

    public function tenant() { return $this->belongsTo(Tenant::class); }
}
