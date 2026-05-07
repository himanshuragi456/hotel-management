<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Expense extends Model
{
    protected $fillable = [
        'tenant_id', 'created_by', 'category', 'description', 'amount', 'expense_date',
    ];

    protected function casts(): array
    {
        return ['expense_date' => 'date', 'amount' => 'float'];
    }

    public function tenant()    { return $this->belongsTo(Tenant::class); }
    public function createdBy() { return $this->belongsTo(User::class, 'created_by'); }
}
