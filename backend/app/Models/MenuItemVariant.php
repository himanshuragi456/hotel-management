<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class MenuItemVariant extends Model
{
    protected $fillable = [
        'tenant_id', 'menu_item_id', 'name', 'price', 'is_available', 'sort_order',
    ];

    protected function casts(): array
    {
        return ['price' => 'float', 'is_available' => 'boolean'];
    }

    public function menuItem() { return $this->belongsTo(MenuItem::class); }
}
