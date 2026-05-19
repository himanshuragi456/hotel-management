<?php

namespace App\Http\Controllers\Owner;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\User;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;

class StaffController extends Controller
{
    use ApiResponse;

    private const STAFF_ROLES = ['waiter', 'chef', 'billing'];

    public function index(): JsonResponse
    {
        $staff = User::where('tenant_id', auth()->user()->tenant_id)
            ->whereIn('role', self::STAFF_ROLES)
            ->orderBy('role')
            ->orderBy('name')
            ->get(['id', 'name', 'email', 'phone', 'role', 'is_active', 'created_at']);

        return $this->success($staff);
    }

    public function store(Request $request): JsonResponse
    {
        $v = Validator::make($request->all(), [
            'name'  => 'required|string|max:100',
            'email' => 'required|email|unique:users,email',
            'phone' => 'nullable|string|max:20',
            'role'  => ['required', Rule::in(self::STAFF_ROLES)],
            'password' => ['required', 'string', 'min:8', 'regex:/[A-Z]/', 'regex:/[0-9]/', 'regex:/[@$!%*#?&]/'],
        ]);
        if ($v->fails()) return $this->validationError($v->errors());

        $user = User::create([
            'name'      => $request->name,
            'email'     => $request->email,
            'phone'     => $request->phone,
            'role'      => $request->role,
            'password'  => $request->password,
            'tenant_id' => auth()->user()->tenant_id,
            'is_active' => true,
        ]);

        $user->assignRole($request->role);
        AuditLog::record('staff.created', $user, [], ['name' => $user->name, 'email' => $user->email, 'role' => $user->role]);

        return $this->created($user->only(['id', 'name', 'email', 'phone', 'role', 'is_active', 'created_at']), 'Staff member created');
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $user = User::where('id', $id)
            ->where('tenant_id', auth()->user()->tenant_id)
            ->whereIn('role', self::STAFF_ROLES)
            ->firstOrFail();

        $v = Validator::make($request->all(), [
            'name'     => 'sometimes|string|max:100',
            'email'    => ['sometimes', 'email', Rule::unique('users', 'email')->ignore($user->id)],
            'phone'    => 'nullable|string|max:20',
            'role'     => ['sometimes', Rule::in(self::STAFF_ROLES)],
            'password' => ['nullable', 'string', 'min:8', 'regex:/[A-Z]/', 'regex:/[0-9]/', 'regex:/[@$!%*#?&]/'],
            'is_active'=> 'sometimes|boolean',
        ]);
        if ($v->fails()) return $this->validationError($v->errors());

        $data = $request->only(['name', 'email', 'phone', 'role', 'is_active']);
        if ($request->filled('password')) {
            $data['password'] = $request->password;
        }
        $user->update($data);

        if ($request->filled('role') && $request->role !== $user->getOriginal('role')) {
            $user->syncRoles([$request->role]);
        }
        AuditLog::record('staff.updated', $user, [], array_filter($data));

        return $this->success($user->fresh()->only(['id', 'name', 'email', 'phone', 'role', 'is_active', 'created_at']), 'Staff member updated');
    }

    public function destroy(int $id): JsonResponse
    {
        $user = User::where('id', $id)
            ->where('tenant_id', auth()->user()->tenant_id)
            ->whereIn('role', self::STAFF_ROLES)
            ->firstOrFail();

        AuditLog::record('staff.deleted', $user, ['name' => $user->name, 'email' => $user->email, 'role' => $user->role], []);
        $user->delete();

        return $this->success(null, 'Staff member removed');
    }

    public function toggleActive(int $id): JsonResponse
    {
        $user = User::where('id', $id)
            ->where('tenant_id', auth()->user()->tenant_id)
            ->whereIn('role', self::STAFF_ROLES)
            ->firstOrFail();

        $user->update(['is_active' => ! $user->is_active]);
        AuditLog::record($user->is_active ? 'staff.activated' : 'staff.deactivated', $user, [], ['name' => $user->name, 'role' => $user->role]);

        return $this->success(['is_active' => $user->is_active], $user->is_active ? 'Staff member activated' : 'Staff member deactivated');
    }
}
