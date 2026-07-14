<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Storage;

class MenuItem extends Model
{
    protected $fillable = [
        'tenant_id', 'menu_category_id', 'name', 'description',
        'price', 'image', 'video', 'type', 'is_available', 'is_ready_made', 'prep_time_minutes', 'sort_order',
        'gst_slab', 'gst_cgst_sgst', 'packaging_charge',
        'is_beverage', 'meat_type', 'nutritional_info', 'serving_info',
        'is_best_seller',
    ];

    protected $appends = ['image_url', 'video_url'];

    protected function casts(): array
    {
        return [
            'is_available' => 'boolean', 'is_ready_made' => 'boolean', 'is_best_seller' => 'boolean', 'price' => 'float',
            'prep_time_minutes' => 'integer',
            'gst_slab' => 'float', 'gst_cgst_sgst' => 'boolean', 'packaging_charge' => 'float',
            'is_beverage' => 'boolean', 'nutritional_info' => 'array',
        ];
    }

    public function getImageUrlAttribute(): ?string
    {
        if (!$this->image) return null;
        // Guard: if a video ended up in the image column somehow, don't serve it as image_url
        if (preg_match('/\.(mp4|webm)$/i', $this->image)) return null;
        return '/storage/' . $this->image;
    }

    public function getVideoUrlAttribute(): ?string
    {
        return $this->video ? '/storage/' . $this->video : null;
    }

    public function tenant()      { return $this->belongsTo(Tenant::class); }
    public function category()    { return $this->belongsTo(MenuCategory::class, 'menu_category_id'); }
    public function variants()    { return $this->hasMany(MenuItemVariant::class)->orderBy('sort_order'); }
    public function addonGroups() { return $this->hasMany(AddonGroup::class)->orderBy('sort_order'); }
}
