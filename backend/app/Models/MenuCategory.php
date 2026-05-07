<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class MenuCategory extends Model
{
    protected $fillable = ['tenant_id', 'name', 'sort_order', 'is_active'];

    protected function casts(): array
    {
        return ['is_active' => 'boolean'];
    }

    public function tenant()    { return $this->belongsTo(Tenant::class); }
    public function items()     { return $this->hasMany(MenuItem::class)->orderBy('sort_order'); }
}
