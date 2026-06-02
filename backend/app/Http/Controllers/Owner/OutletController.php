<?php

namespace App\Http\Controllers\Owner;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\OutletHour;
use App\Models\Tenant;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

/**
 * Outlet management: operational hours, per-channel on/off, offline reason.
 * Pre-API these drive the POS itself; the Zomato adapter (post-approval) will push the
 * same on/off + hours to Zomato's outlet APIs.
 */
class OutletController extends Controller
{
    use ApiResponse;

    /** Zomato-aligned offline reasons (static glossary; mapped to Zomato ids post-approval). */
    public const OFFLINE_REASONS = [
        'too_busy'        => 'Too busy / high order volume',
        'kitchen_closed'  => 'Kitchen closed',
        'staff_shortage'  => 'Staff shortage',
        'item_unavailable'=> 'Key items unavailable',
        'technical_issue' => 'Technical / POS issue',
        'holiday'         => 'Holiday / planned closure',
        'other'           => 'Other',
    ];

    public function show(): JsonResponse
    {
        $tenant = Tenant::with('outletHours')->findOrFail(auth()->user()->tenant_id);
        return $this->success([
            'is_open'        => $tenant->is_open ?? true,
            'zomato_online'  => $tenant->zomato_online ?? true,
            'swiggy_online'  => $tenant->swiggy_online ?? true,
            'offline_reason' => $tenant->offline_reason,
            'offline_until'  => $tenant->offline_until,
            'hours'          => $tenant->outletHours,
            'offline_reasons'=> collect(self::OFFLINE_REASONS)->map(fn($l, $k) => ['code' => $k, 'label' => $l])->values(),
        ]);
    }

    /** Turn a channel on/off. channel: dine_in (is_open) | zomato | swiggy. */
    public function toggleChannel(Request $request): JsonResponse
    {
        $v = Validator::make($request->all(), [
            'channel'        => 'required|in:dine_in,zomato,swiggy',
            'online'         => 'required|boolean',
            'offline_reason' => 'nullable|in:' . implode(',', array_keys(self::OFFLINE_REASONS)),
            'offline_until'  => 'nullable|date',
        ]);
        if ($v->fails()) return $this->validationError($v->errors());

        $tenant = Tenant::findOrFail(auth()->user()->tenant_id);
        $online = $request->boolean('online');

        $column = match ($request->channel) {
            'dine_in' => 'is_open',
            'zomato'  => 'zomato_online',
            'swiggy'  => 'swiggy_online',
        };

        $data = [$column => $online];
        // Track offline reason only when going offline; clear it when coming back online.
        if (! $online) {
            $data['offline_reason'] = $request->offline_reason;
            $data['offline_until']  = $request->offline_until;
        } else {
            $data['offline_reason'] = null;
            $data['offline_until']  = null;
        }
        $tenant->update($data);

        AuditLog::record('outlet.channel_toggled', $tenant, [], [
            'channel' => $request->channel,
            'online'  => $online,
            'reason'  => $request->offline_reason,
        ]);

        return $this->success($this->show()->getData()->data, $online ? 'Channel turned on' : 'Channel turned off');
    }

    /** Replace operational hours for a channel. */
    public function setHours(Request $request): JsonResponse
    {
        $v = Validator::make($request->all(), [
            'channel'              => 'required|in:all,zomato,swiggy,dine_in',
            'hours'                => 'present|array',
            'hours.*.day_of_week'  => 'required|integer|min:0|max:6',
            'hours.*.open_time'    => 'required|date_format:H:i',
            'hours.*.close_time'   => 'required|date_format:H:i|after:hours.*.open_time',
        ]);
        if ($v->fails()) return $this->validationError($v->errors());

        $tenantId = auth()->user()->tenant_id;
        OutletHour::where('tenant_id', $tenantId)->where('channel', $request->channel)->delete();
        foreach ($request->hours as $row) {
            OutletHour::create([
                'tenant_id'   => $tenantId,
                'channel'     => $request->channel,
                'day_of_week' => $row['day_of_week'],
                'open_time'   => $row['open_time'],
                'close_time'  => $row['close_time'],
            ]);
        }
        return $this->success($this->show()->getData()->data, 'Operational hours updated');
    }
}
