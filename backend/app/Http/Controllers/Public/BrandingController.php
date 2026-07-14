<?php

namespace App\Http\Controllers\Public;

use App\Http\Controllers\Controller;
use App\Models\SystemSetting;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;

class BrandingController extends Controller
{
    use ApiResponse;

    public function show(): JsonResponse
    {
        $keys = ['brand_name', 'brand_logo', 'contact_phone', 'contact_whatsapp', 'contact_email', 'sales_tagline'];
        $settings = SystemSetting::allAsMap();
        $branding = [];
        foreach ($keys as $key) {
            $branding[$key] = $settings[$key] ?? null;
        }
        if ($branding['brand_logo']) {
            $branding['brand_logo_url'] = '/storage/' . $branding['brand_logo'];
        }
        return $this->success($branding);
    }
}
