<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class OrderItem extends Model
{
    protected $fillable = [
        'order_id', 'menu_item_id', 'menu_item_variant_id', 'item_name', 'variant_name',
        'item_price', 'quantity', 'subtotal', 'notes',
        'addons', 'addons_total', 'gst_rate', 'cgst_amount', 'sgst_amount',
    ];

    protected function casts(): array
    {
        return [
            'item_price' => 'float', 'subtotal' => 'float',
            'addons' => 'array', 'addons_total' => 'float',
            'gst_rate' => 'float', 'cgst_amount' => 'float', 'sgst_amount' => 'float',
        ];
    }

    public function order()    { return $this->belongsTo(Order::class); }
    public function menuItem() { return $this->belongsTo(MenuItem::class); }
    public function variant()  { return $this->belongsTo(MenuItemVariant::class, 'menu_item_variant_id'); }
}
