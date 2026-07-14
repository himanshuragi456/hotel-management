<?php

namespace App\Http\Controllers\Superadmin;

use App\Http\Controllers\Controller;
use App\Models\SystemSetting;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class BrandingController extends Controller
{
    use ApiResponse;

    private array $keys = ['brand_name', 'brand_logo', 'contact_phone', 'contact_whatsapp', 'contact_email', 'sales_tagline'];

    public function show(): JsonResponse
    {
        $settings = SystemSetting::allAsMap();
        $branding = [];
        foreach ($this->keys as $key) {
            $branding[$key] = $settings[$key] ?? null;
        }
        if ($branding['brand_logo']) {
            $branding['brand_logo_url'] = '/storage/' . $branding['brand_logo'];
        }
        return $this->success($branding);
    }

    public function update(Request $request): JsonResponse
    {
        $request->validate([
            'brand_name'       => 'nullable|string|max:100',
            'contact_phone'    => 'nullable|regex:/^[6-9]\d{9}$/',
            'contact_whatsapp' => 'nullable|regex:/^[6-9]\d{9}$/',
            'contact_email'    => 'nullable|email|max:100',
            'sales_tagline'    => 'nullable|string|max:255',
            'brand_logo'       => 'nullable|image|max:2048',
        ]);

        $fields = ['brand_name', 'contact_phone', 'contact_whatsapp', 'contact_email', 'sales_tagline'];
        foreach ($fields as $field) {
            if ($request->has($field)) {
                SystemSetting::set($field, $request->input($field));
            }
        }

        if ($request->hasFile('brand_logo')) {
            $old = SystemSetting::get('brand_logo');
            if ($old && Storage::disk('public')->exists($old)) {
                Storage::disk('public')->delete($old);
            }
            $path = $request->file('brand_logo')->store('branding', 'public');
            SystemSetting::set('brand_logo', $path);
        }

        $branding = [];
        foreach ($this->keys as $key) {
            $branding[$key] = SystemSetting::get($key);
        }
        if ($branding['brand_logo']) {
            $branding['brand_logo_url'] = '/storage/' . $branding['brand_logo'];
        }

        return $this->success($branding, 'Branding updated');
    }
}
