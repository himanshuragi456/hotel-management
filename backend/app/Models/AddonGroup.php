<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AddonGroup extends Model
{
    protected $fillable = [
        'tenant_id', 'menu_item_id', 'name', 'min_select', 'max_select', 'sort_order',
    ];

    protected function casts(): array
    {
        return ['min_select' => 'integer', 'max_select' => 'integer'];
    }

    public function menuItem() { return $this->belongsTo(MenuItem::class); }
    public function addons()   { return $this->hasMany(Addon::class)->orderBy('sort_order'); }
}
