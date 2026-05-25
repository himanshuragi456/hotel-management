<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Schedule::command('subscriptions:expire')->dailyAt('00:05');
Schedule::command('gmb:generate-weekly-posts')->weeklyOn(1, '09:00'); // Every Monday 9am
