<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Cache;

class SystemSetting extends Model
{
    protected $fillable = ['key', 'value'];

    /** Global (not tenant-scoped) — one row per install, edited only from Superadmin > Branding. */
    private const CACHE_KEY = 'system_settings.all';

    public static function get(string $key, mixed $default = null): mixed
    {
        return static::where('key', $key)->value('value') ?? $default;
    }

    public static function set(string $key, mixed $value): void
    {
        static::updateOrCreate(['key' => $key], ['value' => $value]);
        // Every branding field is written through this single setter, so
        // forgetting here covers every write path (Superadmin\BrandingController).
        Cache::forget(self::CACHE_KEY);
    }

    /**
     * allAsMap() is called on nearly every request that touches auth, the
     * public menu/feedback pages, or the CheckSubscription middleware — but
     * the underlying rows only change when a superadmin edits branding.
     * rememberForever() is safe here: set() above is the only write path and
     * always forgets this key immediately after writing.
     */
    public static function allAsMap(): array
    {
        return Cache::rememberForever(self::CACHE_KEY, fn () => static::all()->pluck('value', 'key')->toArray());
    }
}
