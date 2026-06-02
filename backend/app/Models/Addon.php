<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Addon extends Model
{
    protected $fillable = [
        'tenant_id', 'addon_group_id', 'name', 'price', 'type', 'is_available', 'sort_order',
    ];

    protected function casts(): array
    {
        return ['price' => 'float', 'is_available' => 'boolean'];
    }

    public function group() { return $this->belongsTo(AddonGroup::class, 'addon_group_id'); }
}
