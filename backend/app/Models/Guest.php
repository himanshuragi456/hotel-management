<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Guest extends Model
{
    protected $fillable = [
        'tenant_id', 'name', 'phone', 'email',
        'id_proof_type', 'id_proof_number', 'company', 'address', 'notes',
    ];

    public function tenant()   { return $this->belongsTo(Tenant::class); }
    public function bookings() { return $this->hasMany(Booking::class); }

    public function getTotalStaysAttribute(): int
    {
        return $this->bookings()->whereIn('status', ['checked_in', 'checked_out'])->count();
    }
}
