<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SubscriptionPlan extends Model
{
    protected $fillable = [
        'name', 'slug', 'description', 'price_monthly', 'price_yearly',
        'module_restaurant', 'module_hotel', 'module_feedback',
        'max_users', 'max_tables', 'max_rooms', 'is_active', 'features',
    ];

    protected function casts(): array
    {
        return [
            'module_restaurant' => 'boolean',
            'module_hotel'      => 'boolean',
            'module_feedback'   => 'boolean',
            'is_active'         => 'boolean',
            'features'          => 'array',
        ];
    }
}
