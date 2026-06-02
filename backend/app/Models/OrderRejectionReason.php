<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class OrderRejectionReason extends Model
{
    protected $fillable = [
        'code', 'label', 'zomato_message_id', 'requires_item', 'is_active', 'sort_order',
    ];

    protected function casts(): array
    {
        return ['requires_item' => 'boolean', 'is_active' => 'boolean'];
    }
}
