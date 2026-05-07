<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class TenantModule extends Model
{
    protected $fillable = ['tenant_id', 'restaurant', 'hotel', 'feedback'];

    protected function casts(): array
    {
        return [
            'restaurant' => 'boolean',
            'hotel'      => 'boolean',
            'feedback'   => 'boolean',
        ];
    }

    public function tenant()
    {
        return $this->belongsTo(Tenant::class);
    }
}
