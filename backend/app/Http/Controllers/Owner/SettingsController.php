<?php

namespace App\Http\Controllers\Owner;

use App\Http\Controllers\Controller;
use App\Models\Tenant;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

class SettingsController extends Controller
{
    use ApiResponse;

    public function show(): JsonResponse
    {
        $tenant = Tenant::findOrFail(auth()->user()->tenant_id);
        return $this->success([
            'is_open'                       => $tenant->is_open ?? true,
            'qr_ordering_enabled'           => $tenant->qr_ordering_enabled,
            'customer_bill_request_enabled' => $tenant->customer_bill_request_enabled,
            'kot_enabled'                   => $tenant->kot_enabled,
            'kot_auto_print'                => $tenant->kot_auto_print,
            'kot_printer'                   => $tenant->kot_printer ?? 'kitchen',
            'bill_auto_print'               => $tenant->bill_auto_print ?? false,
            'feedback_on_bill'              => $tenant->feedback_on_bill ?? false,
            'upi_id'                        => $tenant->upi_id,
        ]);
    }

    public function update(Request $request): JsonResponse
    {
        $tenant = Tenant::findOrFail(auth()->user()->tenant_id);
        $request->validate([
            'is_open'                       => 'sometimes|boolean',
            'qr_ordering_enabled'           => 'sometimes|boolean',
            'customer_bill_request_enabled' => 'sometimes|boolean',
            'kot_enabled'                   => 'sometimes|boolean',
            'kot_auto_print'                => 'sometimes|boolean',
            'kot_printer'                   => 'sometimes|in:kitchen,billing',
            'bill_auto_print'               => 'sometimes|boolean',
            'feedback_on_bill'              => 'sometimes|boolean',
            'upi_id'                        => 'sometimes|nullable|string|max:100',
        ]);
        $tenant->update($request->only([
            'is_open',
            'qr_ordering_enabled',
            'customer_bill_request_enabled',
            'kot_enabled',
            'kot_auto_print',
            'kot_printer',
            'bill_auto_print',
            'feedback_on_bill',
            'upi_id',
        ]));
        return $this->success([
            'is_open'                       => $tenant->is_open ?? true,
            'qr_ordering_enabled'           => $tenant->qr_ordering_enabled,
            'customer_bill_request_enabled' => $tenant->customer_bill_request_enabled,
            'kot_enabled'                   => $tenant->kot_enabled,
            'kot_auto_print'                => $tenant->kot_auto_print,
            'kot_printer'                   => $tenant->kot_printer ?? 'kitchen',
            'bill_auto_print'               => $tenant->bill_auto_print ?? false,
            'feedback_on_bill'              => $tenant->feedback_on_bill ?? false,
            'upi_id'                        => $tenant->upi_id,
        ], 'Settings updated');
    }

    public function changePassword(Request $request): JsonResponse
    {
        $user = auth()->user();
        $request->validate([
            'current_password' => 'required|string',
            'password'         => ['required', 'string', 'min:8', 'confirmed',
                'regex:/[A-Z]/',      // at least one uppercase
                'regex:/[0-9]/',      // at least one number
                'regex:/[@$!%*#?&]/', // at least one special char
            ],
        ], [
            'password.regex' => 'Password must contain at least one uppercase letter, one number, and one special character (@$!%*#?&).',
        ]);

        if (!Hash::check($request->current_password, $user->password)) {
            return $this->error('Current password is incorrect', 422);
        }

        $user->update(['password' => $request->password]);
        return $this->success(null, 'Password changed successfully');
    }
}
