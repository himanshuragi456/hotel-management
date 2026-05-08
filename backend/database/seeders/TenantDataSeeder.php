<?php

namespace Database\Seeders;

use App\Models\FeedbackQrCode;
use App\Models\MenuCategory;
use App\Models\MenuItem;
use App\Models\RestaurantTable;
use App\Models\Room;
use App\Models\Tenant;
use Illuminate\Database\Seeder;

/**
 * Seeds default data for a given tenant — tables, menu, rooms, feedback QR.
 * Called from DemoTenantSeeder and from TenantController when a new tenant is created.
 */
class TenantDataSeeder extends Seeder
{
    public function seedForTenant(Tenant $tenant): void
    {
        $tid = $tenant->id;

        $this->seedTables($tid);
        $this->seedMenu($tid);
        $this->seedRooms($tid);
        $this->seedFeedbackQr($tid, $tenant->name);
    }

    // Called by DatabaseSeeder — seeds the existing demo tenant
    public function run(): void
    {
        $tenant = Tenant::where('slug', 'demo-restaurant')->first();
        if ($tenant) {
            $this->seedForTenant($tenant);
        }
    }

    // -------------------------------------------------------------------------
    // Restaurant Tables
    // -------------------------------------------------------------------------
    private function seedTables(int $tid): void
    {
        // Skip if already has tables
        if (RestaurantTable::where('tenant_id', $tid)->exists()) return;

        $tables = [
            // Ground floor — main hall
            ['number' => 'T1',  'capacity' => 2,  'section' => 'Main Hall'],
            ['number' => 'T2',  'capacity' => 2,  'section' => 'Main Hall'],
            ['number' => 'T3',  'capacity' => 4,  'section' => 'Main Hall'],
            ['number' => 'T4',  'capacity' => 4,  'section' => 'Main Hall'],
            ['number' => 'T5',  'capacity' => 4,  'section' => 'Main Hall'],
            ['number' => 'T6',  'capacity' => 6,  'section' => 'Main Hall'],
            ['number' => 'T7',  'capacity' => 6,  'section' => 'Main Hall'],
            ['number' => 'T8',  'capacity' => 8,  'section' => 'Main Hall'],
            // Outdoor / Garden
            ['number' => 'G1',  'capacity' => 2,  'section' => 'Garden'],
            ['number' => 'G2',  'capacity' => 4,  'section' => 'Garden'],
            ['number' => 'G3',  'capacity' => 4,  'section' => 'Garden'],
            ['number' => 'G4',  'capacity' => 6,  'section' => 'Garden'],
            // Private / VIP
            ['number' => 'VIP1','capacity' => 4,  'section' => 'VIP Room'],
            ['number' => 'VIP2','capacity' => 8,  'section' => 'VIP Room'],
            // Bar Counter
            ['number' => 'B1',  'capacity' => 2,  'section' => 'Bar'],
            ['number' => 'B2',  'capacity' => 2,  'section' => 'Bar'],
        ];

        foreach ($tables as $t) {
            RestaurantTable::create([
                'tenant_id' => $tid,
                'number'    => $t['number'],
                'capacity'  => $t['capacity'],
                'section'   => $t['section'],
                'status'    => 'free',
            ]);
        }
    }

    // -------------------------------------------------------------------------
    // Menu Categories & Items
    // -------------------------------------------------------------------------
    private function seedMenu(int $tid): void
    {
        if (MenuCategory::where('tenant_id', $tid)->exists()) return;

        $menu = [
            [
                'name' => 'Breakfast', 'sort_order' => 1,
                'items' => [
                    ['name' => 'Masala Omelette',      'price' => 80,  'type' => 'non-veg', 'description' => 'Fluffy omelette with onion, tomato & spices'],
                    ['name' => 'Poha',                 'price' => 60,  'type' => 'veg',     'description' => 'Flattened rice with mustard, curry leaves & peanuts'],
                    ['name' => 'Upma',                 'price' => 60,  'type' => 'veg',     'description' => 'Semolina cooked with vegetables and tempering'],
                    ['name' => 'Idli Sambar (3 pcs)',  'price' => 70,  'type' => 'veg',     'description' => 'Steamed rice cakes with sambar and coconut chutney'],
                    ['name' => 'Vada Sambar (2 pcs)',  'price' => 80,  'type' => 'veg',     'description' => 'Crispy lentil fritters served with sambar'],
                    ['name' => 'Bread Butter Toast',   'price' => 50,  'type' => 'veg',     'description' => 'Toasted bread with butter and jam'],
                    ['name' => 'Aloo Paratha',         'price' => 90,  'type' => 'veg',     'description' => 'Whole wheat flatbread stuffed with spiced potatoes'],
                    ['name' => 'English Breakfast',    'price' => 220, 'type' => 'non-veg', 'description' => 'Eggs, bacon, sausage, toast, beans & hashbrown'],
                ],
            ],
            [
                'name' => 'Starters', 'sort_order' => 2,
                'items' => [
                    ['name' => 'Paneer Tikka',          'price' => 220, 'type' => 'veg',     'description' => 'Marinated cottage cheese grilled in tandoor'],
                    ['name' => 'Veg Spring Rolls',      'price' => 160, 'type' => 'veg',     'description' => 'Crispy rolls stuffed with mixed vegetables'],
                    ['name' => 'Chicken Tikka',         'price' => 280, 'type' => 'non-veg', 'description' => 'Tender chicken pieces marinated in yogurt & spices'],
                    ['name' => 'Fish Fry',              'price' => 320, 'type' => 'non-veg', 'description' => 'Crispy fried fish with mint chutney'],
                    ['name' => 'Crispy Corn',           'price' => 150, 'type' => 'veg',     'description' => 'Fried corn kernels tossed with spices'],
                    ['name' => 'Chicken Lollipop (6)', 'price' => 300, 'type' => 'non-veg', 'description' => 'Spicy fried chicken wings in lollipop style'],
                    ['name' => 'Hara Bhara Kebab',      'price' => 180, 'type' => 'veg',     'description' => 'Spinach & pea patties with mint chutney'],
                    ['name' => 'Prawn Koliwada',        'price' => 380, 'type' => 'non-veg', 'description' => 'Spicy Maharashtrian style fried prawns'],
                ],
            ],
            [
                'name' => 'Soups', 'sort_order' => 3,
                'items' => [
                    ['name' => 'Tomato Soup',           'price' => 100, 'type' => 'veg',     'description' => 'Classic creamy tomato soup with croutons'],
                    ['name' => 'Sweet Corn Soup',       'price' => 110, 'type' => 'veg',     'description' => 'Mild corn soup with spring onion topping'],
                    ['name' => 'Chicken Manchow Soup',  'price' => 140, 'type' => 'non-veg', 'description' => 'Spicy Indo-Chinese chicken soup with crispy noodles'],
                    ['name' => 'Hot & Sour Veg Soup',   'price' => 110, 'type' => 'veg',     'description' => 'Tangy spicy vegetable soup'],
                ],
            ],
            [
                'name' => 'Main Course', 'sort_order' => 4,
                'items' => [
                    ['name' => 'Dal Makhani',           'price' => 200, 'type' => 'veg',     'description' => 'Slow-cooked black lentils in buttery tomato gravy'],
                    ['name' => 'Palak Paneer',          'price' => 220, 'type' => 'veg',     'description' => 'Cottage cheese in creamy spinach gravy'],
                    ['name' => 'Shahi Paneer',          'price' => 240, 'type' => 'veg',     'description' => 'Paneer in rich cashew and cream gravy'],
                    ['name' => 'Veg Kadai',             'price' => 180, 'type' => 'veg',     'description' => 'Mixed vegetables in tangy kadai masala'],
                    ['name' => 'Chicken Butter Masala', 'price' => 300, 'type' => 'non-veg', 'description' => 'Tender chicken in rich buttery tomato sauce'],
                    ['name' => 'Mutton Rogan Josh',     'price' => 380, 'type' => 'non-veg', 'description' => 'Aromatic Kashmiri mutton curry'],
                    ['name' => 'Fish Curry',            'price' => 340, 'type' => 'non-veg', 'description' => 'Coastal style fish in coconut & tamarind gravy'],
                    ['name' => 'Egg Bhurji',            'price' => 160, 'type' => 'non-veg', 'description' => 'Scrambled eggs with onion, tomato & spices'],
                    ['name' => 'Chole Masala',          'price' => 180, 'type' => 'veg',     'description' => 'Spiced chickpeas in tangy onion-tomato gravy'],
                    ['name' => 'Mix Veg',               'price' => 170, 'type' => 'veg',     'description' => 'Seasonal vegetables in North Indian gravy'],
                ],
            ],
            [
                'name' => 'Rice & Biryani', 'sort_order' => 5,
                'items' => [
                    ['name' => 'Steamed Rice',          'price' => 80,  'type' => 'veg',     'description' => 'Plain basmati rice'],
                    ['name' => 'Jeera Rice',            'price' => 120, 'type' => 'veg',     'description' => 'Fragrant cumin-tempered basmati rice'],
                    ['name' => 'Veg Biryani',           'price' => 200, 'type' => 'veg',     'description' => 'Aromatic basmati rice with mixed vegetables & whole spices'],
                    ['name' => 'Chicken Biryani',       'price' => 280, 'type' => 'non-veg', 'description' => 'Slow-cooked basmati rice with marinated chicken'],
                    ['name' => 'Mutton Biryani',        'price' => 360, 'type' => 'non-veg', 'description' => 'Dum-cooked basmati with tender mutton pieces'],
                    ['name' => 'Egg Fried Rice',        'price' => 160, 'type' => 'non-veg', 'description' => 'Wok-tossed rice with eggs & vegetables'],
                    ['name' => 'Veg Fried Rice',        'price' => 150, 'type' => 'veg',     'description' => 'Indo-Chinese style fried rice with vegetables'],
                ],
            ],
            [
                'name' => 'Breads', 'sort_order' => 6,
                'items' => [
                    ['name' => 'Roti (2 pcs)',          'price' => 30,  'type' => 'veg', 'description' => 'Whole wheat flatbread'],
                    ['name' => 'Butter Roti (2 pcs)',   'price' => 40,  'type' => 'veg', 'description' => 'Soft whole wheat flatbread with butter'],
                    ['name' => 'Tandoori Roti',         'price' => 40,  'type' => 'veg', 'description' => 'Clay oven baked whole wheat bread'],
                    ['name' => 'Naan',                  'price' => 50,  'type' => 'veg', 'description' => 'Soft leavened bread from the tandoor'],
                    ['name' => 'Butter Naan',           'price' => 60,  'type' => 'veg', 'description' => 'Tandoor naan finished with butter'],
                    ['name' => 'Garlic Naan',           'price' => 70,  'type' => 'veg', 'description' => 'Naan topped with garlic and coriander'],
                    ['name' => 'Laccha Paratha',        'price' => 70,  'type' => 'veg', 'description' => 'Layered whole wheat flatbread'],
                    ['name' => 'Puri (3 pcs)',          'price' => 50,  'type' => 'veg', 'description' => 'Deep-fried puffy wheat bread'],
                ],
            ],
            [
                'name' => 'Chinese', 'sort_order' => 7,
                'items' => [
                    ['name' => 'Veg Noodles',           'price' => 160, 'type' => 'veg',     'description' => 'Stir-fried noodles with vegetables in Indo-Chinese style'],
                    ['name' => 'Chicken Noodles',       'price' => 200, 'type' => 'non-veg', 'description' => 'Wok-tossed noodles with chicken strips'],
                    ['name' => 'Veg Manchurian',        'price' => 160, 'type' => 'veg',     'description' => 'Crispy vegetable balls in Manchurian sauce'],
                    ['name' => 'Chicken Manchurian',    'price' => 220, 'type' => 'non-veg', 'description' => 'Crispy chicken in tangy Manchurian gravy'],
                    ['name' => 'Veg Hakka Noodles',     'price' => 170, 'type' => 'veg',     'description' => 'Classic Hakka style noodles with vegetables'],
                    ['name' => 'Chilli Paneer',         'price' => 200, 'type' => 'veg',     'description' => 'Cottage cheese tossed in chilli sauce'],
                    ['name' => 'Schezwan Fried Rice',   'price' => 180, 'type' => 'veg',     'description' => 'Spicy Schezwan sauce rice with vegetables'],
                ],
            ],
            [
                'name' => 'Desserts', 'sort_order' => 8,
                'items' => [
                    ['name' => 'Gulab Jamun (2 pcs)',   'price' => 80,  'type' => 'veg', 'description' => 'Soft milk-solid dumplings in rose-flavored syrup'],
                    ['name' => 'Ras Malai (2 pcs)',     'price' => 100, 'type' => 'veg', 'description' => 'Soft cheese patties in saffron milk'],
                    ['name' => 'Kulfi',                 'price' => 80,  'type' => 'veg', 'description' => 'Traditional Indian ice cream — kesar pista'],
                    ['name' => 'Brownie with Ice Cream','price' => 140, 'type' => 'veg', 'description' => 'Warm chocolate brownie with vanilla ice cream'],
                    ['name' => 'Ice Cream (2 scoops)',  'price' => 100, 'type' => 'veg', 'description' => 'Choice of vanilla, chocolate or strawberry'],
                    ['name' => 'Phirni',                'price' => 90,  'type' => 'veg', 'description' => 'Ground rice pudding with saffron & cardamom'],
                ],
            ],
            [
                'name' => 'Beverages', 'sort_order' => 9,
                'items' => [
                    ['name' => 'Masala Chai',           'price' => 40,  'type' => 'veg', 'description' => 'Spiced Indian tea with ginger & cardamom'],
                    ['name' => 'Filter Coffee',         'price' => 50,  'type' => 'veg', 'description' => 'Strong South Indian filter coffee with milk'],
                    ['name' => 'Cold Coffee',           'price' => 100, 'type' => 'veg', 'description' => 'Chilled blended coffee with ice cream'],
                    ['name' => 'Fresh Lime Soda',       'price' => 70,  'type' => 'veg', 'description' => 'Sweet or salted lime soda'],
                    ['name' => 'Mango Lassi',           'price' => 100, 'type' => 'veg', 'description' => 'Thick yogurt drink blended with fresh mango'],
                    ['name' => 'Sweet Lassi',           'price' => 80,  'type' => 'veg', 'description' => 'Chilled sweetened yogurt drink'],
                    ['name' => 'Mineral Water (1L)',    'price' => 30,  'type' => 'veg', 'description' => 'Packaged mineral water'],
                    ['name' => 'Soft Drink',            'price' => 50,  'type' => 'veg', 'description' => 'Pepsi / Coke / Sprite (330ml can)'],
                    ['name' => 'Mojito (Virgin)',       'price' => 120, 'type' => 'veg', 'description' => 'Mint, lime & soda mocktail'],
                    ['name' => 'Watermelon Juice',      'price' => 90,  'type' => 'veg', 'description' => 'Fresh seasonal watermelon juice'],
                ],
            ],
        ];

        foreach ($menu as $catData) {
            $cat = MenuCategory::create([
                'tenant_id'  => $tid,
                'name'       => $catData['name'],
                'sort_order' => $catData['sort_order'],
                'is_active'  => true,
            ]);

            foreach ($catData['items'] as $i => $item) {
                MenuItem::create([
                    'tenant_id'        => $tid,
                    'menu_category_id' => $cat->id,
                    'name'             => $item['name'],
                    'description'      => $item['description'],
                    'price'            => $item['price'],
                    'type'             => $item['type'],
                    'is_available'     => true,
                    'sort_order'       => $i + 1,
                ]);
            }
        }
    }

    // -------------------------------------------------------------------------
    // Hotel Rooms
    // -------------------------------------------------------------------------
    private function seedRooms(int $tid): void
    {
        if (Room::where('tenant_id', $tid)->exists()) return;

        $rooms = [
            // Ground floor — Standard Singles
            ['number' => '101', 'type' => 'single',  'floor' => 1, 'capacity' => 1, 'price_per_night' => 1200, 'amenities' => ['AC', 'TV', 'WiFi', 'Hot Water'],               'description' => 'Cozy standard single room'],
            ['number' => '102', 'type' => 'single',  'floor' => 1, 'capacity' => 1, 'price_per_night' => 1200, 'amenities' => ['AC', 'TV', 'WiFi', 'Hot Water'],               'description' => 'Cozy standard single room'],
            ['number' => '103', 'type' => 'single',  'floor' => 1, 'capacity' => 1, 'price_per_night' => 1200, 'amenities' => ['AC', 'TV', 'WiFi', 'Hot Water'],               'description' => 'Cozy standard single room'],
            // Ground floor — Standard Doubles
            ['number' => '104', 'type' => 'double',  'floor' => 1, 'capacity' => 2, 'price_per_night' => 1800, 'amenities' => ['AC', 'TV', 'WiFi', 'Hot Water', 'Mini Fridge'],'description' => 'Comfortable double room with city view'],
            ['number' => '105', 'type' => 'double',  'floor' => 1, 'capacity' => 2, 'price_per_night' => 1800, 'amenities' => ['AC', 'TV', 'WiFi', 'Hot Water', 'Mini Fridge'],'description' => 'Comfortable double room with city view'],
            ['number' => '106', 'type' => 'double',  'floor' => 1, 'capacity' => 2, 'price_per_night' => 1800, 'amenities' => ['AC', 'TV', 'WiFi', 'Hot Water', 'Mini Fridge'],'description' => 'Comfortable double room with city view'],
            // First floor — Triple
            ['number' => '201', 'type' => 'triple',  'floor' => 2, 'capacity' => 3, 'price_per_night' => 2400, 'amenities' => ['AC', 'TV', 'WiFi', 'Hot Water', 'Mini Fridge', 'Sofa'],   'description' => 'Spacious triple room ideal for small families'],
            ['number' => '202', 'type' => 'triple',  'floor' => 2, 'capacity' => 3, 'price_per_night' => 2400, 'amenities' => ['AC', 'TV', 'WiFi', 'Hot Water', 'Mini Fridge', 'Sofa'],   'description' => 'Spacious triple room ideal for small families'],
            // First floor — Deluxe Double
            ['number' => '203', 'type' => 'deluxe',  'floor' => 2, 'capacity' => 2, 'price_per_night' => 2800, 'amenities' => ['AC', 'Smart TV', 'WiFi', 'Hot Water', 'Mini Fridge', 'Bathtub', 'Balcony'], 'description' => 'Deluxe room with balcony and city view'],
            ['number' => '204', 'type' => 'deluxe',  'floor' => 2, 'capacity' => 2, 'price_per_night' => 2800, 'amenities' => ['AC', 'Smart TV', 'WiFi', 'Hot Water', 'Mini Fridge', 'Bathtub', 'Balcony'], 'description' => 'Deluxe room with balcony and city view'],
            ['number' => '205', 'type' => 'deluxe',  'floor' => 2, 'capacity' => 3, 'price_per_night' => 3200, 'amenities' => ['AC', 'Smart TV', 'WiFi', 'Hot Water', 'Mini Fridge', 'Bathtub', 'Balcony', 'Sofa'], 'description' => 'Large deluxe room with extra seating'],
            // Second floor — Suites
            ['number' => '301', 'type' => 'suite',   'floor' => 3, 'capacity' => 2, 'price_per_night' => 4500, 'amenities' => ['AC', 'Smart TV', 'WiFi', 'Hot Water', 'Mini Bar', 'Bathtub', 'Balcony', 'Living Area', 'Room Service'], 'description' => 'Premium suite with separate living area'],
            ['number' => '302', 'type' => 'suite',   'floor' => 3, 'capacity' => 4, 'price_per_night' => 6000, 'amenities' => ['AC', 'Smart TV', 'WiFi', 'Hot Water', 'Mini Bar', 'Bathtub', 'Balcony', 'Living Area', 'Room Service', 'Jacuzzi'], 'description' => 'Executive suite with jacuzzi and panoramic view'],
        ];

        foreach ($rooms as $r) {
            Room::create([
                'tenant_id'      => $tid,
                'number'         => $r['number'],
                'type'           => $r['type'],
                'floor'          => $r['floor'],
                'capacity'       => $r['capacity'],
                'price_per_night'=> $r['price_per_night'],
                'amenities'      => $r['amenities'],
                'status'         => 'available',
                'description'    => $r['description'],
            ]);
        }
    }

    // -------------------------------------------------------------------------
    // Feedback QR Code
    // -------------------------------------------------------------------------
    private function seedFeedbackQr(int $tid, string $tenantName): void
    {
        if (FeedbackQrCode::where('tenant_id', $tid)->exists()) return;

        $placements = [
            ['label' => 'Reception',      'placement' => 'reception'],
            ['label' => 'Dining Table',   'placement' => 'table'],
            ['label' => 'Hotel Room',     'placement' => 'room'],
        ];

        foreach ($placements as $p) {
            FeedbackQrCode::create([
                'tenant_id' => $tid,
                'label'     => $p['label'],
                'placement' => $p['placement'],
                'is_active' => true,
            ]);
        }
    }
}
