<?php

namespace Database\Seeders;

use App\Models\OrderRejectionReason;
use Illuminate\Database\Seeder;

class OrderRejectionReasonsSeeder extends Seeder
{
    /**
     * Zomato-aligned rejection reasons. zomato_message_id is filled in once the
     * official API/glossary mapping is available (post-approval); until then these
     * drive the manual-rejection UI and internal reporting.
     */
    public function run(): void
    {
        $reasons = [
            ['code' => 'item_out_of_stock',     'label' => 'Item(s) out of stock',          'requires_item' => true,  'sort_order' => 1],
            ['code' => 'kitchen_full',          'label' => 'Kitchen full / too busy',       'requires_item' => false, 'sort_order' => 2],
            ['code' => 'outlet_closed',         'label' => 'Outlet closed',                  'requires_item' => false, 'sort_order' => 3],
            ['code' => 'rider_unavailable',     'label' => 'No delivery rider available',    'requires_item' => false, 'sort_order' => 4],
            ['code' => 'price_mismatch',        'label' => 'Price mismatch',                 'requires_item' => false, 'sort_order' => 5],
            ['code' => 'address_unserviceable', 'label' => 'Address not serviceable',        'requires_item' => false, 'sort_order' => 6],
            ['code' => 'duplicate_order',       'label' => 'Duplicate order',                'requires_item' => false, 'sort_order' => 7],
            ['code' => 'customer_request',      'label' => 'Customer requested cancellation','requires_item' => false, 'sort_order' => 8],
            ['code' => 'other',                 'label' => 'Other',                          'requires_item' => false, 'sort_order' => 99],
        ];

        foreach ($reasons as $r) {
            OrderRejectionReason::updateOrCreate(['code' => $r['code']], $r);
        }
    }
}
