<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AuditLog extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'tenant_id', 'user_id', 'action', 'model_type',
        'model_id', 'old_values', 'new_values', 'ip_address', 'user_agent',
    ];

    protected function casts(): array
    {
        return [
            'old_values' => 'array',
            'new_values' => 'array',
            'created_at' => 'datetime',
        ];
    }

    public function user() { return $this->belongsTo(User::class); }

    public static function record(string $action, mixed $model = null, array $oldValues = [], array $newValues = []): void
    {
        $user = auth()->user();
        static::create([
            'tenant_id'  => $user?->tenant_id,
            'user_id'    => $user?->id,
            'action'     => $action,
            'model_type' => $model ? get_class($model) : null,
            'model_id'   => $model?->id,
            'old_values' => $oldValues ?: null,
            'new_values' => $newValues ?: null,
            'ip_address' => request()->ip(),
            'user_agent' => request()->userAgent(),
        ]);
    }
}
