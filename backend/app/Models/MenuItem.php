<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Storage;

class MenuItem extends Model
{
    protected $fillable = [
        'tenant_id', 'menu_category_id', 'name', 'description',
        'price', 'image', 'type', 'is_available', 'is_ready_made', 'sort_order',
    ];

    protected $appends = ['image_url'];

    protected function casts(): array
    {
        return ['is_available' => 'boolean', 'is_ready_made' => 'boolean', 'price' => 'float'];
    }

    public function getImageUrlAttribute(): ?string
    {
        return $this->image ? Storage::disk('public')->url($this->image) : null;
    }

    public function tenant()   { return $this->belongsTo(Tenant::class); }
    public function category() { return $this->belongsTo(MenuCategory::class, 'menu_category_id'); }
}
