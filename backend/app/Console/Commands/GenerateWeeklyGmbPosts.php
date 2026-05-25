<?php

namespace App\Console\Commands;

use App\Models\GmbPost;
use App\Models\Tenant;
use App\Services\GmbAiService;
use Illuminate\Console\Command;

class GenerateWeeklyGmbPosts extends Command
{
    protected $signature   = 'gmb:generate-weekly-posts {--tenant=}';
    protected $description = 'Generate weekly GMB post suggestions for all connected tenants';

    public function handle(GmbAiService $ai): int
    {
        $query = Tenant::whereNotNull('gmb_location_id')
            ->whereNotNull('gmb_access_token')
            ->where('status', 'active');

        if ($tenantId = $this->option('tenant')) {
            $query->where('id', $tenantId);
        }

        $tenants = $query->get();

        if ($tenants->isEmpty()) {
            $this->info('No connected tenants found.');
            return 0;
        }

        foreach ($tenants as $tenant) {
            // Skip if suggestions were already generated this week
            $hasRecent = GmbPost::where('tenant_id', $tenant->id)
                ->where('status', 'suggested')
                ->where('suggested_at', '>=', now()->startOfWeek())
                ->exists();

            if ($hasRecent) {
                $this->line("Skipping tenant {$tenant->name} — already has suggestions this week.");
                continue;
            }

            $this->line("Generating posts for: {$tenant->name}");
            $posts = $ai->generateWeeklyPostSuggestions($tenant);
            $this->info("  → Generated " . count($posts) . " suggestions.");
        }

        return 0;
    }
}
