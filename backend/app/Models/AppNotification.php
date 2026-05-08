<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AppNotification extends Model
{
    protected $table = 'app_notifications';

    protected $fillable = [
        'tenant_id', 'user_id', 'type', 'title', 'body', 'data', 'read_at',
    ];

    protected function casts(): array
    {
        return [
            'data'    => 'array',
            'read_at' => 'datetime',
        ];
    }

    public function user() { return $this->belongsTo(User::class); }

    public function getIsReadAttribute(): bool
    {
        return $this->read_at !== null;
    }

    public static function send(int $userId, int $tenantId, string $type, string $title, ?string $body = null, array $data = []): self
    {
        return static::create([
            'user_id'   => $userId,
            'tenant_id' => $tenantId,
            'type'      => $type,
            'title'     => $title,
            'body'      => $body,
            'data'      => $data ?: null,
        ]);
    }
}
