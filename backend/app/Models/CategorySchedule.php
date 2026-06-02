<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class CategorySchedule extends Model
{
    protected $fillable = [
        'tenant_id', 'menu_category_id', 'day_of_week', 'start_time', 'end_time',
    ];

    protected function casts(): array
    {
        return ['day_of_week' => 'integer'];
    }

    public function category() { return $this->belongsTo(MenuCategory::class, 'menu_category_id'); }
}
