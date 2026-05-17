<?php

namespace App\Http\Controllers\Owner;

use App\Http\Controllers\Controller;
use App\Models\MenuCategory;
use App\Models\MenuItem;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;

class MenuController extends Controller
{
    use ApiResponse;

    // ── Categories ────────────────────────────────────────────────────────────

    public function categories(Request $request): JsonResponse
    {
        $tenantId = auth()->user()->tenant_id;
        $cats = MenuCategory::where('tenant_id', $tenantId)
            ->withCount('items')
            ->orderBy('sort_order')
            ->get();
        return $this->success($cats);
    }

    public function storeCategory(Request $request): JsonResponse
    {
        $v = Validator::make($request->all(), [
            'name'       => 'required|string|max:100',
            'sort_order' => 'integer|min:0',
        ]);
        if ($v->fails()) return $this->validationError($v->errors());

        $cat = MenuCategory::create([
            'tenant_id'  => auth()->user()->tenant_id,
            'name'       => $request->name,
            'sort_order' => $request->sort_order ?? 0,
        ]);
        return $this->created($cat);
    }

    public function updateCategory(Request $request, MenuCategory $menuCategory): JsonResponse
    {
        $this->authorizesTenant($menuCategory);
        $v = Validator::make($request->all(), [
            'name'       => 'sometimes|string|max:100',
            'sort_order' => 'integer|min:0',
            'is_active'  => 'boolean',
        ]);
        if ($v->fails()) return $this->validationError($v->errors());
        $menuCategory->update($request->only(['name', 'sort_order', 'is_active']));
        return $this->success($menuCategory);
    }

    public function destroyCategory(MenuCategory $menuCategory): JsonResponse
    {
        $this->authorizesTenant($menuCategory);
        $menuCategory->delete();
        return $this->success(null, 'Category deleted');
    }

    // ── Items ─────────────────────────────────────────────────────────────────

    public function items(Request $request): JsonResponse
    {
        $tenantId = auth()->user()->tenant_id;
        $query = MenuItem::where('tenant_id', $tenantId)->with('category');
        if ($request->category_id) $query->where('menu_category_id', $request->category_id);
        return $this->success($query->orderBy('sort_order')->get());
    }

    public function storeItem(Request $request): JsonResponse
    {
        $v = Validator::make($request->all(), [
            'menu_category_id' => 'required|exists:menu_categories,id',
            'name'             => 'required|string|max:200',
            'price'            => 'required|numeric|min:0',
            'description'      => 'nullable|string',
            'type'             => 'in:veg,non-veg,vegan',
            'is_ready_made'    => 'boolean',
            'image'            => 'nullable|image|max:2048',
            'sort_order'       => 'integer|min:0',
        ]);
        if ($v->fails()) return $this->validationError($v->errors());

        $imagePath = null;
        if ($request->hasFile('image')) {
            $imagePath = $request->file('image')->store('menu', 'public');
        }

        $item = MenuItem::create([
            'tenant_id'        => auth()->user()->tenant_id,
            'menu_category_id' => $request->menu_category_id,
            'name'             => $request->name,
            'price'            => $request->price,
            'description'      => $request->description,
            'type'             => $request->type ?? 'veg',
            'is_ready_made'    => $request->boolean('is_ready_made', false),
            'image'            => $imagePath,
            'sort_order'       => $request->sort_order ?? 0,
        ]);
        return $this->created($item->load('category'));
    }

    public function updateItem(Request $request, MenuItem $menuItem): JsonResponse
    {
        $this->authorizesTenant($menuItem);
        $v = Validator::make($request->all(), [
            'name'             => 'sometimes|string|max:200',
            'price'            => 'sometimes|numeric|min:0',
            'description'      => 'nullable|string',
            'type'             => 'in:veg,non-veg,vegan',
            'is_available'     => 'boolean',
            'is_ready_made'    => 'boolean',
            'image'            => 'nullable|image|max:2048',
            'sort_order'       => 'integer|min:0',
            'menu_category_id' => 'exists:menu_categories,id',
        ]);
        if ($v->fails()) return $this->validationError($v->errors());

        if ($request->hasFile('image')) {
            if ($menuItem->image) Storage::disk('public')->delete($menuItem->image);
            $menuItem->image = $request->file('image')->store('menu', 'public');
        }

        $menuItem->update($request->only([
            'name', 'price', 'description', 'type',
            'is_available', 'is_ready_made', 'sort_order', 'menu_category_id',
        ]));
        return $this->success($menuItem->load('category'));
    }

    public function destroyItem(MenuItem $menuItem): JsonResponse
    {
        $this->authorizesTenant($menuItem);
        if ($menuItem->image) Storage::disk('public')->delete($menuItem->image);
        $menuItem->delete();
        return $this->success(null, 'Item deleted');
    }

    public function bulkToggle(Request $request): JsonResponse
    {
        $v = Validator::make($request->all(), [
            'ids'          => 'required|array',
            'ids.*'        => 'integer',
            'is_available' => 'required|boolean',
        ]);
        if ($v->fails()) return $this->validationError($v->errors());

        MenuItem::where('tenant_id', auth()->user()->tenant_id)
            ->whereIn('id', $request->ids)
            ->update(['is_available' => $request->is_available]);

        return $this->success(null, 'Items updated');
    }

    private function authorizesTenant($model): void
    {
        if ($model->tenant_id !== auth()->user()->tenant_id) abort(403);
    }
}
