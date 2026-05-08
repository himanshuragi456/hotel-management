<?php

namespace App\Http\Controllers\Owner\Feedback;

use App\Http\Controllers\Controller;
use App\Models\FeedbackQrCode;
use App\Models\FeedbackSubmission;
use App\Models\Tenant;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use SimpleSoftwareIO\QrCode\Facades\QrCode;

class FeedbackController extends Controller
{
    use ApiResponse;

    // ── QR Management ─────────────────────────────────────────────────────────

    public function listQrCodes(Request $request): JsonResponse
    {
        $qrs = FeedbackQrCode::where('tenant_id', $request->_tenant_id)
            ->withCount('submissions')
            ->latest()
            ->get();

        return $this->success($qrs);
    }

    public function createQrCode(Request $request): JsonResponse
    {
        $data = $request->validate([
            'label'     => 'required|string|max:100',
            'placement' => 'required|in:reception,table,room,other',
        ]);

        $qr = FeedbackQrCode::create(array_merge($data, ['tenant_id' => $request->_tenant_id]));
        return $this->created($qr);
    }

    public function updateQrCode(Request $request, FeedbackQrCode $qrCode): JsonResponse
    {
        if ($qrCode->tenant_id !== $request->_tenant_id) return $this->notFound();

        $data = $request->validate([
            'label'     => 'sometimes|string|max:100',
            'placement' => 'sometimes|in:reception,table,room,other',
            'is_active' => 'sometimes|boolean',
        ]);

        $qrCode->update($data);
        return $this->success($qrCode->fresh());
    }

    public function deleteQrCode(Request $request, FeedbackQrCode $qrCode): JsonResponse
    {
        if ($qrCode->tenant_id !== $request->_tenant_id) return $this->notFound();
        $qrCode->delete();
        return $this->success(null, 'Deleted');
    }

    public function downloadQrPng(Request $request, FeedbackQrCode $qrCode)
    {
        if ($qrCode->tenant_id !== $request->_tenant_id) abort(404);

        $url = config('app.url') . '/feedback/' . $qrCode->qr_token;
        $png = QrCode::format('png')->size(400)->margin(2)->generate($url);

        return response($png, 200, [
            'Content-Type'        => 'image/png',
            'Content-Disposition' => 'attachment; filename="feedback-qr-' . $qrCode->label . '.png"',
        ]);
    }

    // ── Google Review Config ───────────────────────────────────────────────────

    public function getReviewConfig(Request $request): JsonResponse
    {
        $tenant = Tenant::find($request->_tenant_id);
        return $this->success([
            'google_place_id'   => $tenant->google_place_id,
            'google_review_url' => $tenant->google_review_url,
        ]);
    }

    public function updateReviewConfig(Request $request): JsonResponse
    {
        $data = $request->validate([
            'google_place_id'   => 'nullable|string|max:200',
            'google_review_url' => 'nullable|url|max:500',
        ]);

        Tenant::where('id', $request->_tenant_id)->update($data);
        return $this->success($data, 'Google review config updated');
    }

    // ── Dashboard ─────────────────────────────────────────────────────────────

    public function dashboard(Request $request): JsonResponse
    {
        $tid  = $request->_tenant_id;
        $from = $request->query('from');
        $to   = $request->query('to');
        $ratingFilter = $request->query('rating');
        $view = $request->query('view'); // 'public' | 'internal' | null = all

        $query = FeedbackSubmission::where('tenant_id', $tid)->latest();

        if ($from)         $query->whereDate('created_at', '>=', $from);
        if ($to)           $query->whereDate('created_at', '<=', $to);
        if ($ratingFilter) $query->where('rating', $ratingFilter);
        if ($view === 'public')   $query->where('is_internal', false);
        if ($view === 'internal') $query->where('is_internal', true);

        $submissions = $query->with('qrCode:id,label,placement')->paginate(30);

        // Aggregates (always unfiltered by rating/view for stats)
        $baseQuery = FeedbackSubmission::where('tenant_id', $tid);
        if ($from) $baseQuery->whereDate('created_at', '>=', $from);
        if ($to)   $baseQuery->whereDate('created_at', '<=', $to);

        $total   = (clone $baseQuery)->count();
        $average = $total > 0 ? round((clone $baseQuery)->avg('rating'), 1) : 0;

        $breakdown = (clone $baseQuery)
            ->selectRaw('rating, count(*) as count')
            ->groupBy('rating')
            ->pluck('count', 'rating')
            ->toArray();

        $ratingBreakdown = [];
        for ($i = 1; $i <= 5; $i++) {
            $ratingBreakdown[$i] = $breakdown[$i] ?? 0;
        }

        return $this->success([
            'submissions' => $submissions,
            'stats' => [
                'total'    => $total,
                'average'  => $average,
                'breakdown'=> $ratingBreakdown,
                'public'   => (clone $baseQuery)->where('is_internal', false)->count(),
                'internal' => (clone $baseQuery)->where('is_internal', true)->count(),
            ],
        ]);
    }
}
