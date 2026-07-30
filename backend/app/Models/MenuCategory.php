<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Cache;

class MenuCategory extends Model
{
    protected $fillable = ['tenant_id', 'parent_id', 'name', 'sort_order', 'is_active', 'is_oos', 'category_tag'];

    protected function casts(): array
    {
        return ['is_active' => 'boolean', 'is_oos' => 'boolean'];
    }

    public function tenant()        { return $this->belongsTo(Tenant::class); }
    public function items()         { return $this->hasMany(MenuItem::class)->orderBy('sort_order'); }
    public function parent()        { return $this->belongsTo(MenuCategory::class, 'parent_id'); }
    public function children()      { return $this->hasMany(MenuCategory::class, 'parent_id')->orderBy('sort_order'); }
    public function schedules()     { return $this->hasMany(CategorySchedule::class); }

    /**
     * Availability-aware nested menu tree for ordering surfaces (customer / waiter / billing).
     *
     * Returns TOP-LEVEL categories only, each with:
     *   - items[]        — directly-assigned items (available, orderable now)
     *   - subcategories[] — child categories (available, orderable now) each with their items[]
     *
     * Every item carries variants[] and addon_groups[].addons[].
     * Subcategories rendered separately let ordering UIs show a two-level tab hierarchy.
     */
    public static function orderableMenu(int $tenantId): \Illuminate\Support\Collection
    {
        // Called on every customer QR scan, every waiter-dashboard menu open
        // and every billing new-order screen — but the underlying categories/
        // items/variants/addons only change when the owner edits the menu
        // (invalidated via MenuCacheObserver, see AppServiceProvider::boot()).
        // TTL is kept short (not rememberForever) because isAvailableNow()
        // below is also time-of-day/day-of-week sensitive (category
        // schedules) — a short TTL bounds how stale a schedule boundary can
        // be without needing a cache entry per minute.
        return Cache::remember("menu.orderable.{$tenantId}", now()->addMinutes(2), fn () => self::buildOrderableMenu($tenantId));
    }

    private static function buildOrderableMenu(int $tenantId): \Illuminate\Support\Collection
    {
        $itemEager = [
            'variants'           => fn ($q) => $q->where('is_available', true)->orderBy('sort_order'),
            'addonGroups.addons' => fn ($q) => $q->where('is_available', true)->orderBy('sort_order'),
        ];

        $all = static::where('tenant_id', $tenantId)
            ->where('is_active', true)
            ->where('is_oos', false)
            ->with(array_merge([
                'schedules',
                'children' => function ($q) use ($itemEager) {
                    $q->where('is_active', true)->where('is_oos', false)
                      ->orderBy('sort_order')
                      ->with(array_merge(['schedules'], [
                          'items' => fn ($iq) => $iq->where('is_available', true)->orderBy('sort_order')->with($itemEager),
                      ]));
                },
                'items' => fn ($q) => $q->where('is_available', true)->orderBy('sort_order')->with($itemEager),
            ]))
            ->orderBy('sort_order')
            ->get();

        // Only top-level categories go into the result.
        return $all->filter(fn ($cat) => is_null($cat->parent_id) && $cat->isAvailableNow())
            ->map(function ($cat) {
                $subs = $cat->children
                    ->filter(fn ($c) => $c->isAvailableNow())
                    ->values()
                    ->map(fn ($c) => array_merge($c->toArray(), [
                        'items' => $c->items->values()->map(fn ($i) => $i->toArray()),
                    ]));

                return array_merge($cat->toArray(), [
                    'items'          => $cat->items->values()->map(fn ($i) => $i->toArray()),
                    'subcategories'  => $subs,
                ]);
            })
            ->values();
    }

    /**
     * Whether the category is orderable right now: active, not OOS, parent not OOS,
     * and (if it has schedules) inside an active day/time window.
     */
    public function isAvailableNow(?\Carbon\Carbon $now = null): bool
    {
        if (! $this->is_active || $this->is_oos) return false;
        if ($this->parent && $this->parent->is_oos) return false;

        $schedules = $this->relationLoaded('schedules') ? $this->schedules : $this->schedules()->get();
        if ($schedules->isEmpty()) return true; // no schedule = always available

        $now = $now ?? now();
        $dow = (int) $now->dayOfWeek; // 0=Sun..6=Sat
        $time = $now->format('H:i:s');

        return $schedules->contains(function ($s) use ($dow, $time) {
            return (int) $s->day_of_week === $dow
                && $time >= $s->start_time
                && $time <= $s->end_time;
        });
    }
}
