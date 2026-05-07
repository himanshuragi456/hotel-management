<?php

namespace App\Http\Controllers\Customer;

use App\Events\OrderStatusUpdated;
use App\Http\Controllers\Controller;
use App\Models\MenuCategory;
use App\Models\MenuItem;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\RestaurantTable;
use App\Models\Tenant;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

class MenuController extends Controller
{
    use ApiResponse;

    public function menu(string $tenantSlug, string $qrToken): JsonResponse
    {
        $tenant = Tenant::where('slug', $tenantSlug)->where('status', 'active')->firstOrFail();
        $table  = RestaurantTable::where('qr_token', $qrToken)->where('tenant_id', $tenant->id)->firstOrFail();

        $categories = MenuCategory::where('tenant_id', $tenant->id)
            ->where('is_active', true)
            ->with(['items' => fn($q) => $q->where('is_available', true)->orderBy('sort_order')])
            ->orderBy('sort_order')
            ->get();

        return $this->success([
            'tenant'     => $tenant->only(['name', 'logo', 'currency', 'gst_rate']),
            'table'      => $table->only(['id', 'number', 'section']),
            'categories' => $categories,
        ]);
    }

    public function placeOrder(Request $request, string $tenantSlug, string $qrToken): JsonResponse
    {
        $tenant = Tenant::where('slug', $tenantSlug)->where('status', 'active')->firstOrFail();
        $table  = RestaurantTable::where('qr_token', $qrToken)->where('tenant_id', $tenant->id)->firstOrFail();

        $v = Validator::make($request->all(), [
            'items'                => 'required|array|min:1',
            'items.*.menu_item_id' => 'required|exists:menu_items,id',
            'items.*.quantity'     => 'required|integer|min:1',
            'items.*.notes'        => 'nullable|string',
            'customer_name'        => 'nullable|string|max:100',
            'customer_phone'       => 'nullable|string|max:20',
            'notes'                => 'nullable|string',
        ]);
        if ($v->fails()) return $this->validationError($v->errors());

        DB::beginTransaction();
        try {
            $order = Order::create([
                'tenant_id'           => $tenant->id,
                'restaurant_table_id' => $table->id,
                'type'                => 'dine-in',
                'status'              => 'pending',
                'notes'               => $request->notes,
                'customer_name'       => $request->customer_name,
                'customer_phone'      => $request->customer_phone,
            ]);

            foreach ($request->items as $row) {
                $item = MenuItem::where('id', $row['menu_item_id'])
                    ->where('tenant_id', $tenant->id)
                    ->where('is_available', true)
                    ->firstOrFail();

                OrderItem::create([
                    'order_id'     => $order->id,
                    'menu_item_id' => $item->id,
                    'item_name'    => $item->name,
                    'item_price'   => $item->price,
                    'quantity'     => $row['quantity'],
                    'subtotal'     => $item->price * $row['quantity'],
                    'notes'        => $row['notes'] ?? null,
                ]);
            }

            $order->load('items');
            $order->recalculate();
            $table->occupy();

            DB::commit();

            broadcast(new OrderStatusUpdated($order->fresh()->load('items', 'table')))->toOthers();

            return $this->created([
                'order_number' => $order->order_number,
                'total'        => $order->total,
                'status'       => $order->status,
            ], 'Order placed successfully');
        } catch (\Exception $e) {
            DB::rollBack();
            return $this->error('Failed to place order: ' . $e->getMessage(), 500);
        }
    }

    public function orderStatus(string $orderNumber): JsonResponse
    {
        $order = Order::where('order_number', $orderNumber)->with('items')->firstOrFail();
        return $this->success([
            'order_number' => $order->order_number,
            'status'       => $order->status,
            'items'        => $order->items,
            'total'        => $order->total,
        ]);
    }
}
