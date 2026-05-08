<?php

namespace App\Http\Controllers\Superadmin;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Subscription;
use App\Models\Tenant;
use App\Models\TenantModule;
use App\Models\User;
use App\Traits\ApiResponse;
use Database\Seeders\TenantDataSeeder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;

class TenantController extends Controller
{
    use ApiResponse;

    public function index(Request $request): JsonResponse
    {
        $query = Tenant::with(['modules', 'subscription.plan'])
            ->withCount('users');

        if ($request->search) {
            $query->where(function ($q) use ($request) {
                $q->where('name', 'like', "%{$request->search}%")
                  ->orWhere('email', 'like', "%{$request->search}%");
            });
        }

        if ($request->status) {
            $query->where('status', $request->status);
        }

        $tenants = $query->latest()->paginate(15);

        return $this->success($tenants);
    }

    public function store(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'name'     => 'required|string|max:255',
            'email'    => 'required|email|unique:tenants,email',
            'phone'    => 'nullable|string|max:20',
            'address'  => 'nullable|string',
            'city'     => 'nullable|string|max:100',
            'state'    => 'nullable|string|max:100',
            'gstin'    => 'nullable|string|max:20',
            'gst_rate' => 'nullable|numeric|min:0|max:100',
            'modules'  => 'nullable|array',
            'modules.restaurant' => 'boolean',
            'modules.hotel'      => 'boolean',
            'modules.feedback'   => 'boolean',
        ]);

        if ($validator->fails()) {
            return $this->validationError($validator->errors());
        }

        DB::beginTransaction();
        try {
            $tenant = Tenant::create([
                'name'     => $request->name,
                'slug'     => Str::slug($request->name) . '-' . Str::random(4),
                'email'    => $request->email,
                'phone'    => $request->phone,
                'address'  => $request->address,
                'city'     => $request->city,
                'state'    => $request->state,
                'gstin'    => $request->gstin,
                'gst_rate' => $request->gst_rate ?? 5.00,
                'status'   => 'trial',
            ]);

            TenantModule::create([
                'tenant_id'  => $tenant->id,
                'restaurant' => $request->input('modules.restaurant', false),
                'hotel'      => $request->input('modules.hotel', false),
                'feedback'   => $request->input('modules.feedback', false),
            ]);

            AuditLog::record('tenant.created', $tenant, [], $tenant->toArray());

            // Seed default tables, menu, rooms & feedback QR for new tenant
            (new TenantDataSeeder())->seedForTenant($tenant);

            DB::commit();

            return $this->created($tenant->load('modules'), 'Tenant created successfully');
        } catch (\Exception $e) {
            DB::rollBack();
            return $this->error('Failed to create tenant: ' . $e->getMessage(), 500);
        }
    }

    public function show(Tenant $tenant): JsonResponse
    {
        $tenant->load(['modules', 'subscription.plan', 'users' => fn($q) => $q->select('id', 'name', 'email', 'role', 'is_active', 'tenant_id')]);
        $tenant->loadCount('users');

        $stats = [
            'total_users'    => $tenant->users_count,
            'active_users'   => $tenant->users->where('is_active', true)->count(),
        ];

        return $this->success(['tenant' => $tenant, 'stats' => $stats]);
    }

    public function update(Request $request, Tenant $tenant): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'name'     => 'sometimes|string|max:255',
            'email'    => "sometimes|email|unique:tenants,email,{$tenant->id}",
            'phone'    => 'nullable|string|max:20',
            'address'  => 'nullable|string',
            'city'     => 'nullable|string|max:100',
            'state'    => 'nullable|string|max:100',
            'gstin'    => 'nullable|string|max:20',
            'gst_rate' => 'nullable|numeric|min:0|max:100',
            'status'   => 'sometimes|in:active,suspended,trial',
            'google_place_id'   => 'nullable|string',
            'google_review_url' => 'nullable|url',
        ]);

        if ($validator->fails()) {
            return $this->validationError($validator->errors());
        }

        $old = $tenant->toArray();
        $tenant->update($request->only([
            'name', 'email', 'phone', 'address', 'city', 'state',
            'gstin', 'gst_rate', 'status', 'google_place_id', 'google_review_url',
        ]));

        AuditLog::record('tenant.updated', $tenant, $old, $tenant->fresh()->toArray());

        return $this->success($tenant->load('modules'));
    }

    public function destroy(Tenant $tenant): JsonResponse
    {
        AuditLog::record('tenant.deleted', $tenant, $tenant->toArray(), []);
        $tenant->delete();
        return $this->success(null, 'Tenant deleted successfully');
    }

    public function updateModules(Request $request, Tenant $tenant): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'restaurant' => 'required|boolean',
            'hotel'      => 'required|boolean',
            'feedback'   => 'required|boolean',
        ]);

        if ($validator->fails()) {
            return $this->validationError($validator->errors());
        }

        $modules = TenantModule::updateOrCreate(
            ['tenant_id' => $tenant->id],
            $request->only(['restaurant', 'hotel', 'feedback'])
        );

        AuditLog::record('tenant.modules_updated', $tenant, [], $modules->toArray());

        return $this->success($modules, 'Modules updated successfully');
    }

    public function stats(Tenant $tenant): JsonResponse
    {
        $stats = [
            'users'    => User::where('tenant_id', $tenant->id)->count(),
            'modules'  => $tenant->modules,
            'subscription' => $tenant->subscription?->load('plan'),
        ];

        return $this->success($stats);
    }
}
