<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Tymon\JWTAuth\Facades\JWTAuth;

class AuthController extends Controller
{
    use ApiResponse;

    public function login(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'email'    => 'required|email',
            'password' => 'required|string',
        ]);

        if ($validator->fails()) {
            return $this->validationError($validator->errors());
        }

        $credentials = $request->only('email', 'password');

        if (! $token = auth()->attempt($credentials)) {
            return $this->unauthorized('Invalid credentials');
        }

        $user = auth()->user();

        if (! $user->is_active) {
            auth()->logout();
            return $this->forbidden('Your account has been deactivated');
        }

        return $this->respondWithToken($token, $user);
    }

    public function me(): JsonResponse
    {
        $user = auth()->user()->load('tenant');
        return $this->success($user);
    }

    public function logout(): JsonResponse
    {
        auth()->logout();
        return $this->success(null, 'Logged out successfully');
    }

    public function refresh(): JsonResponse
    {
        try {
            $token = JWTAuth::parseToken()->refresh();
            return $this->respondWithToken($token, auth()->user());
        } catch (\Exception $e) {
            return $this->unauthorized('Token cannot be refreshed');
        }
    }

    private function respondWithToken(string $token, User $user): JsonResponse
    {
        return $this->success([
            'access_token' => $token,
            'token_type'   => 'bearer',
            'expires_in'   => auth()->factory()->getTTL() * 60,
            'user'         => [
                'id'        => $user->id,
                'name'      => $user->name,
                'email'     => $user->email,
                'role'      => $user->role,
                'tenant_id' => $user->tenant_id,
                'phone'     => $user->phone,
            ],
        ]);
    }
}
