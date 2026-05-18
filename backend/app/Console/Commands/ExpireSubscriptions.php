<?php

namespace App\Console\Commands;

use App\Models\Subscription;
use App\Models\Tenant;
use Illuminate\Console\Command;

class ExpireSubscriptions extends Command
{
    protected $signature   = 'subscriptions:expire';
    protected $description = 'Expire overdue trials and subscriptions, suspend affected tenants';

    public function handle(): int
    {
        $now = now();

        // 1. Tenants with no subscription row whose 7-day trial has ended
        $noSubExpired = Tenant::where('status', 'trial')
            ->whereDoesntHave('subscription')
            ->where('created_at', '<', $now->copy()->subDays(7))
            ->get();

        foreach ($noSubExpired as $tenant) {
            $tenant->update(['status' => 'suspended']);
            $this->line("Suspended (no-sub trial expired): {$tenant->name}");
        }

        // 2. Trial subscriptions whose trial_ends_at has passed
        $expiredTrials = Subscription::where('status', 'trial')
            ->where('trial_ends_at', '<', $now)
            ->with('tenant')
            ->get();

        foreach ($expiredTrials as $sub) {
            $sub->update(['status' => 'expired']);
            $sub->tenant?->update(['status' => 'suspended']);
            $this->line("Suspended (trial expired): {$sub->tenant?->name}");
        }

        // 3. Active subscriptions whose period has ended
        $expiredActive = Subscription::where('status', 'active')
            ->where('current_period_end', '<', $now)
            ->with('tenant')
            ->get();

        foreach ($expiredActive as $sub) {
            $sub->update(['status' => 'expired']);
            $sub->tenant?->update(['status' => 'suspended']);
            $this->line("Suspended (subscription expired): {$sub->tenant?->name}");
        }

        $total = $noSubExpired->count() + $expiredTrials->count() + $expiredActive->count();
        $this->info("Done. {$total} tenant(s) suspended.");

        return Command::SUCCESS;
    }
}
