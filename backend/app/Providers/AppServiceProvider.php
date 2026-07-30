<?php

namespace App\Providers;

use Ably\AblyRest;
use App\Broadcasting\LoggingAblyBroadcaster;
use App\Models\Addon;
use App\Models\AddonGroup;
use App\Models\CategorySchedule;
use App\Models\MenuCategory;
use App\Models\MenuItem;
use App\Models\MenuItemVariant;
use App\Models\Tenant;
use App\Observers\MenuCacheObserver;
use App\Observers\TenantObserver;
use Illuminate\Foundation\Console\ServeCommand;
use Illuminate\Support\Facades\Broadcast;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void {}

    public function boot(): void
    {
        Tenant::observe(TenantObserver::class);

        // Keeps MenuCategory::orderableMenu()'s cache fresh across every menu
        // write surface (categories, items, variants, addon groups/addons,
        // day/time schedules) — see MenuCacheObserver docblock.
        MenuCategory::observe(MenuCacheObserver::class);
        MenuItem::observe(MenuCacheObserver::class);
        MenuItemVariant::observe(MenuCacheObserver::class);
        AddonGroup::observe(MenuCacheObserver::class);
        Addon::observe(MenuCacheObserver::class);
        CategorySchedule::observe(MenuCacheObserver::class);

        // Every controller/service broadcasts via the plain `broadcast()`
        // helper — swapping the driver here logs every one of those sends
        // (success or failure) to laravel.log without touching each call site.
        Broadcast::extend('ably', fn ($app, $config) => new LoggingAblyBroadcaster(new AblyRest($config)));

        // Windows: `php artisan serve` strips env vars not in its passthrough
        // allow-list when hot-reload is on. The list only has uppercase
        // SYSTEMROOT, but Windows exposes it as `SystemRoot` (case-sensitive
        // miss), so it gets dropped — which breaks Winsock and makes the dev
        // server fail to listen on every port. Keep the mixed-case key.
        if (! in_array('SystemRoot', ServeCommand::$passthroughVariables, true)) {
            ServeCommand::$passthroughVariables[] = 'SystemRoot';
        }
    }
}
