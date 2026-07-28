<?php

namespace App\Http\Controllers\Owner;

use App\Http\Controllers\Controller;
use App\Models\Addon;
use App\Models\AddonGroup;
use App\Models\CategorySchedule;
use App\Models\MenuCategory;
use App\Models\MenuItem;
use App\Models\MenuItemVariant;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
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
            ->with('schedules')
            ->orderBy('sort_order')
            ->get();
        return $this->success($cats);
    }

    public function storeCategory(Request $request): JsonResponse
    {
        $tenantId = auth()->user()->tenant_id;
        $v = Validator::make($request->all(), [
            'name'         => 'required|string|max:100',
            'sort_order'   => 'integer|min:0',
            'parent_id'    => 'nullable|exists:menu_categories,id',
            'category_tag' => 'nullable|string|max:50',
        ]);
        if ($v->fails()) return $this->validationError($v->errors());

        // A sub-category's parent must belong to this tenant and not itself be a sub-category.
        if ($request->parent_id) {
            $parent = MenuCategory::where('id', $request->parent_id)->where('tenant_id', $tenantId)->first();
            if (! $parent) return $this->error('Invalid parent category', 422);
            if ($parent->parent_id) return $this->error('Cannot nest sub-categories more than one level', 422);
        }

        $cat = MenuCategory::create([
            'tenant_id'    => $tenantId,
            'parent_id'    => $request->parent_id,
            'name'         => $request->name,
            'sort_order'   => $request->sort_order ?? 0,
            'category_tag' => $request->category_tag,
        ]);
        return $this->created($cat);
    }

    public function updateCategory(Request $request, MenuCategory $menuCategory): JsonResponse
    {
        $this->authorizesTenant($menuCategory);
        $v = Validator::make($request->all(), [
            'name'         => 'sometimes|string|max:100',
            'sort_order'   => 'integer|min:0',
            'is_active'    => 'boolean',
            'is_oos'       => 'boolean',
            'category_tag' => 'nullable|string|max:50',
            'parent_id'    => 'nullable|exists:menu_categories,id',
        ]);
        if ($v->fails()) return $this->validationError($v->errors());

        // Prevent a category becoming its own parent / deepening nesting.
        if ($request->filled('parent_id')) {
            if ((int) $request->parent_id === $menuCategory->id) {
                return $this->error('A category cannot be its own parent', 422);
            }
            $parent = MenuCategory::where('id', $request->parent_id)
                ->where('tenant_id', auth()->user()->tenant_id)->first();
            if (! $parent) return $this->error('Invalid parent category', 422);
            if ($parent->parent_id) return $this->error('Cannot nest sub-categories more than one level', 422);
            if ($menuCategory->children()->exists()) {
                return $this->error('Cannot turn a parent category into a sub-category', 422);
            }
        }

        $menuCategory->update($request->only(['name', 'sort_order', 'is_active', 'is_oos', 'category_tag', 'parent_id']));
        return $this->success($menuCategory);
    }

    public function destroyCategory(MenuCategory $menuCategory): JsonResponse
    {
        $this->authorizesTenant($menuCategory);
        $menuCategory->delete();
        return $this->success(null, 'Category deleted');
    }

    public function reorderCategories(Request $request): JsonResponse
    {
        $tenantId = auth()->user()->tenant_id;
        $v = Validator::make($request->all(), [
            'ids'   => 'required|array',
            'ids.*' => 'integer',
        ]);
        if ($v->fails()) return $this->validationError($v->errors());

        DB::transaction(function () use ($request, $tenantId) {
            foreach ($request->ids as $order => $id) {
                MenuCategory::where('id', $id)
                    ->where('tenant_id', $tenantId)
                    ->update(['sort_order' => $order]);
            }
        });
        // Mass update() above is query-builder, not Eloquent saves, so
        // MenuCacheObserver never fires — forget explicitly.
        Cache::forget("menu.orderable.{$tenantId}");

        return $this->success(null, 'Categories reordered');
    }

    // ── Items ─────────────────────────────────────────────────────────────────

    public function items(Request $request): JsonResponse
    {
        $tenantId = auth()->user()->tenant_id;
        $query = MenuItem::where('tenant_id', $tenantId)
            ->with('category', 'variants', 'addonGroups.addons');
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
            'is_ready_made'       => 'boolean',
            'is_best_seller'      => 'boolean',
            'prep_time_minutes'   => 'nullable|integer|min:1|max:300',
            'image'               => 'nullable|max:5120|mimes:jpg,jpeg,png,gif,webp',
            'video'               => 'nullable|max:20480|mimes:mp4,webm',
            'sort_order'          => 'integer|min:0',
            // Zomato menu fields
            'gst_slab'            => 'nullable|numeric|min:0|max:100',
            'gst_cgst_sgst'       => 'boolean',
            'packaging_charge'    => 'nullable|numeric|min:0',
            'is_beverage'         => 'boolean',
            'meat_type'           => 'nullable|string|max:50',
            'nutritional_info'    => 'nullable|array',
            'serving_info'        => 'nullable|string|max:100',
        ]);
        if ($v->fails()) return $this->validationError($v->errors());

        $imagePath = null;
        if ($request->hasFile('image')) {
            $imagePath = $request->file('image')->store('menu', 'public');
        }
        $videoPath = null;
        if ($request->hasFile('video')) {
            $videoPath = $request->file('video')->store('menu', 'public');
        }

        $isReadyMade = $request->boolean('is_ready_made', false);
        $item = MenuItem::create([
            'tenant_id'           => auth()->user()->tenant_id,
            'menu_category_id'    => $request->menu_category_id,
            'name'                => $request->name,
            'price'               => $request->price,
            'description'         => $request->description,
            'type'                => $request->type ?? 'veg',
            'is_ready_made'       => $isReadyMade,
            'is_best_seller'      => $request->boolean('is_best_seller', false),
            'prep_time_minutes'   => $isReadyMade ? null : $request->prep_time_minutes,
            'image'               => $imagePath,
            'video'               => $videoPath,
            'sort_order'          => $request->sort_order ?? 0,
            'gst_slab'            => $request->gst_slab,
            'gst_cgst_sgst'       => $request->boolean('gst_cgst_sgst', false),
            'packaging_charge'    => $request->packaging_charge ?? 0,
            'is_beverage'         => $request->boolean('is_beverage', false),
            'meat_type'           => $request->meat_type,
            'nutritional_info'    => $request->nutritional_info,
            'serving_info'        => $request->serving_info,
        ]);
        return $this->created($item->load('category', 'variants', 'addonGroups.addons'));
    }

    public function updateItem(Request $request, MenuItem $menuItem): JsonResponse
    {
        $this->authorizesTenant($menuItem);
        $v = Validator::make($request->all(), [
            'name'             => 'sometimes|string|max:200',
            'price'            => 'sometimes|numeric|min:0',
            'description'      => 'nullable|string',
            'type'             => 'in:veg,non-veg,vegan',
            'is_available'        => 'boolean',
            'is_ready_made'       => 'boolean',
            'is_best_seller'      => 'boolean',
            'prep_time_minutes'   => 'nullable|integer|min:1|max:300',
            'image'               => 'nullable|max:5120|mimes:jpg,jpeg,png,gif,webp',
            'video'               => 'nullable|max:20480|mimes:mp4,webm',
            'sort_order'          => 'integer|min:0',
            'menu_category_id'    => 'exists:menu_categories,id',
            // Zomato menu fields
            'gst_slab'            => 'nullable|numeric|min:0|max:100',
            'gst_cgst_sgst'       => 'boolean',
            'packaging_charge'    => 'nullable|numeric|min:0',
            'is_beverage'         => 'boolean',
            'meat_type'           => 'nullable|string|max:50',
            'nutritional_info'    => 'nullable|array',
            'serving_info'        => 'nullable|string|max:100',
        ]);
        if ($v->fails()) return $this->validationError($v->errors());

        if ($request->hasFile('image')) {
            if ($menuItem->image) Storage::disk('public')->delete($menuItem->image);
            $menuItem->image = $request->file('image')->store('menu', 'public');
        }
        if ($request->hasFile('video')) {
            if ($menuItem->video) Storage::disk('public')->delete($menuItem->video);
            $menuItem->video = $request->file('video')->store('menu', 'public');
        } elseif ($request->boolean('remove_video')) {
            if ($menuItem->video) Storage::disk('public')->delete($menuItem->video);
            $menuItem->video = null;
        }

        $updateData = $request->only([
            'name', 'price', 'description', 'type',
            'is_available', 'is_ready_made', 'is_best_seller', 'sort_order', 'menu_category_id',
            'gst_slab', 'gst_cgst_sgst', 'packaging_charge',
            'is_beverage', 'meat_type', 'nutritional_info', 'serving_info',
        ]);
        // Clear prep time when switching to ready-made
        if ($request->has('is_ready_made')) {
            $updateData['prep_time_minutes'] = $request->boolean('is_ready_made')
                ? null
                : ($request->has('prep_time_minutes') ? $request->prep_time_minutes : $menuItem->prep_time_minutes);
        } elseif ($request->has('prep_time_minutes')) {
            $updateData['prep_time_minutes'] = $request->prep_time_minutes;
        }
        $menuItem->update($updateData);
        return $this->success($menuItem->load('category', 'variants', 'addonGroups.addons'));
    }

    public function destroyItem(MenuItem $menuItem): JsonResponse
    {
        $this->authorizesTenant($menuItem);
        if ($menuItem->image) Storage::disk('public')->delete($menuItem->image);
        if ($menuItem->video) Storage::disk('public')->delete($menuItem->video);
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

        $tenantId = auth()->user()->tenant_id;
        MenuItem::where('tenant_id', $tenantId)
            ->whereIn('id', $request->ids)
            ->update(['is_available' => $request->is_available]);
        // is_available directly controls whether these items appear in the
        // cached orderable menu — mass update() bypasses MenuCacheObserver,
        // so forget explicitly here too.
        Cache::forget("menu.orderable.{$tenantId}");

        return $this->success(null, 'Items updated');
    }

    public function toggleBestSeller(MenuItem $menuItem): JsonResponse
    {
        $this->authorizesTenant($menuItem);
        $menuItem->update(['is_best_seller' => ! $menuItem->is_best_seller]);
        return $this->success(['is_best_seller' => $menuItem->is_best_seller]);
    }

    // ── Variants ────────────────────────────────────────────────────────────

    public function storeVariant(Request $request, MenuItem $menuItem): JsonResponse
    {
        $this->authorizesTenant($menuItem);
        $v = Validator::make($request->all(), [
            'name'         => 'required|string|max:100',
            'price'        => 'required|numeric|min:0',
            'is_available' => 'boolean',
            'sort_order'   => 'integer|min:0',
        ]);
        if ($v->fails()) return $this->validationError($v->errors());

        $variant = MenuItemVariant::create([
            'tenant_id'    => $menuItem->tenant_id,
            'menu_item_id' => $menuItem->id,
            'name'         => $request->name,
            'price'        => $request->price,
            'is_available' => $request->boolean('is_available', true),
            'sort_order'   => $request->sort_order ?? 0,
        ]);
        return $this->created($variant);
    }

    public function updateVariant(Request $request, MenuItemVariant $variant): JsonResponse
    {
        $this->authorizesTenant($variant);
        $v = Validator::make($request->all(), [
            'name'         => 'sometimes|string|max:100',
            'price'        => 'sometimes|numeric|min:0',
            'is_available' => 'boolean',
            'sort_order'   => 'integer|min:0',
        ]);
        if ($v->fails()) return $this->validationError($v->errors());
        $variant->update($request->only(['name', 'price', 'is_available', 'sort_order']));
        return $this->success($variant);
    }

    public function destroyVariant(MenuItemVariant $variant): JsonResponse
    {
        $this->authorizesTenant($variant);
        $variant->delete();
        return $this->success(null, 'Variant deleted');
    }

    // ── Add-on groups & add-ons ─────────────────────────────────────────────

    public function storeAddonGroup(Request $request, MenuItem $menuItem): JsonResponse
    {
        $this->authorizesTenant($menuItem);
        $v = Validator::make($request->all(), [
            'name'       => 'required|string|max:100',
            'min_select' => 'integer|min:0',
            'max_select' => 'integer|min:1',
            'sort_order' => 'integer|min:0',
        ]);
        if ($v->fails()) return $this->validationError($v->errors());

        $group = AddonGroup::create([
            'tenant_id'    => $menuItem->tenant_id,
            'menu_item_id' => $menuItem->id,
            'name'         => $request->name,
            'min_select'   => $request->min_select ?? 0,
            'max_select'   => max($request->max_select ?? 1, $request->min_select ?? 0),
            'sort_order'   => $request->sort_order ?? 0,
        ]);
        return $this->created($group->load('addons'));
    }

    public function updateAddonGroup(Request $request, AddonGroup $addonGroup): JsonResponse
    {
        $this->authorizesTenant($addonGroup);
        $v = Validator::make($request->all(), [
            'name'       => 'sometimes|string|max:100',
            'min_select' => 'integer|min:0',
            'max_select' => 'integer|min:1',
            'sort_order' => 'integer|min:0',
        ]);
        if ($v->fails()) return $this->validationError($v->errors());
        $addonGroup->update($request->only(['name', 'min_select', 'max_select', 'sort_order']));
        return $this->success($addonGroup->load('addons'));
    }

    public function destroyAddonGroup(AddonGroup $addonGroup): JsonResponse
    {
        $this->authorizesTenant($addonGroup);
        $addonGroup->delete();
        return $this->success(null, 'Add-on group deleted');
    }

    public function storeAddon(Request $request, AddonGroup $addonGroup): JsonResponse
    {
        $this->authorizesTenant($addonGroup);
        $v = Validator::make($request->all(), [
            'name'         => 'required|string|max:100',
            'price'        => 'numeric|min:0',
            'type'         => 'in:veg,non-veg,vegan',
            'is_available' => 'boolean',
            'sort_order'   => 'integer|min:0',
        ]);
        if ($v->fails()) return $this->validationError($v->errors());

        $addon = Addon::create([
            'tenant_id'      => $addonGroup->tenant_id,
            'addon_group_id' => $addonGroup->id,
            'name'           => $request->name,
            'price'          => $request->price ?? 0,
            'type'           => $request->type ?? 'veg',
            'is_available'   => $request->boolean('is_available', true),
            'sort_order'     => $request->sort_order ?? 0,
        ]);
        return $this->created($addon);
    }

    public function updateAddon(Request $request, Addon $addon): JsonResponse
    {
        $this->authorizesTenant($addon);
        $v = Validator::make($request->all(), [
            'name'         => 'sometimes|string|max:100',
            'price'        => 'numeric|min:0',
            'type'         => 'in:veg,non-veg,vegan',
            'is_available' => 'boolean',
            'sort_order'   => 'integer|min:0',
        ]);
        if ($v->fails()) return $this->validationError($v->errors());
        $addon->update($request->only(['name', 'price', 'type', 'is_available', 'sort_order']));
        return $this->success($addon);
    }

    public function destroyAddon(Addon $addon): JsonResponse
    {
        $this->authorizesTenant($addon);
        $addon->delete();
        return $this->success(null, 'Add-on deleted');
    }

    // ── Category schedules (day/time availability) ───────────────────────────

    public function setCategorySchedules(Request $request, MenuCategory $menuCategory): JsonResponse
    {
        $this->authorizesTenant($menuCategory);
        $v = Validator::make($request->all(), [
            'schedules'                => 'present|array',
            'schedules.*.day_of_week'  => 'required|integer|min:0|max:6',
            'schedules.*.start_time'   => 'required|date_format:H:i',
            'schedules.*.end_time'     => 'required|date_format:H:i|after:schedules.*.start_time',
        ]);
        if ($v->fails()) return $this->validationError($v->errors());

        // Replace the whole schedule set in one shot (simplest mental model for the owner UI).
        // Relation ->delete() is a query-builder mass delete (bypasses Eloquent
        // events), so if $request->schedules is empty the create() loop below
        // never runs either — forget the cache explicitly so clearing all
        // schedules (category becomes "always available") isn't missed.
        $menuCategory->schedules()->delete();
        foreach ($request->schedules as $row) {
            CategorySchedule::create([
                'tenant_id'        => $menuCategory->tenant_id,
                'menu_category_id' => $menuCategory->id,
                'day_of_week'      => $row['day_of_week'],
                'start_time'       => $row['start_time'],
                'end_time'         => $row['end_time'],
            ]);
        }
        Cache::forget("menu.orderable.{$menuCategory->tenant_id}");
        return $this->success($menuCategory->load('schedules'), 'Schedule updated');
    }

    private function authorizesTenant($model): void
    {
        if ($model->tenant_id !== auth()->user()->tenant_id) abort(403);
    }
}
