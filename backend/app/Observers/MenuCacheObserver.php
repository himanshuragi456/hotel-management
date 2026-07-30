<?php

namespace App\Observers;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Cache;

/**
 * Invalidates MenuCategory::orderableMenu()'s per-tenant cache whenever any
 * model that feeds that tree changes. Registered (in AppServiceProvider) on
 * MenuCategory, MenuItem, MenuItemVariant, AddonGroup, Addon and
 * CategorySchedule — every model Owner\MenuController writes to (categories,
 * items, variants, addon groups/addons, OOS toggles, day/time schedules).
 * One observer covers all 15+ write endpoints instead of hand-adding
 * Cache::forget() to each controller method (and risking missing one).
 */
class MenuCacheObserver
{
    public function saved(Model $model): void
    {
        $this->forget($model);
    }

    public function deleted(Model $model): void
    {
        $this->forget($model);
    }

    private function forget(Model $model): void
    {
        if ($model->tenant_id) {
            Cache::forget("menu.orderable.{$model->tenant_id}");
        }
    }
}
