<?php

namespace App\Http\Controllers;

use App\Models\AuditLog;
use App\Models\Fee;
use App\Services\StudentReport\StudentReportCache;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class FeePaymentController extends Controller
{
    public function __construct(
        private readonly StudentReportCache $reportCache,
    ) {}

    public function store(Request $request)
{
    $request->validate([
        'fee_ids' => ['required', 'array', 'min:1'],
        'fee_ids.*' => ['exists:fees,id'],
        'collection_date' => ['required', 'date'],
    ]);

    $collectionDate = Carbon::parse($request->collection_date, config('app.timezone'))
        ->startOfDay();

    // Collect distinct student IDs that this write will affect, so we can
    // invalidate their reports in a single pass.
    $studentIds = DB::table('fees')
        ->whereIn('id', $request->fee_ids)
        ->pluck('student_id')
        ->unique()
        ->all();

    foreach ($request->fee_ids as $feeId) {

        $fee = Fee::findOrFail($feeId);

        // The store loop collects arbitrary fee ids, so authorize the actual
        // instance here (a class-string authorize would strip the instance and
        // call FeePolicy::collect with only the user).
        $this->authorize('collect', $fee);

        // Skip if already paid
        if ($fee->payments()->whereNull('deleted_at')->exists()) {
            continue;
        }

        $fee->payments()->create([
            'amount_paid'  => $fee->amount,
            'paid_at'      => $collectionDate,
            'collected_by' => auth()->id(),
            'created_by'   => auth()->id(),
        ]);

        AuditLog::record(AuditLog::ACTION_FEE_COLLECTED, $fee, [
            'amount' => $fee->amount,
            'paid_at' => $collectionDate->toDateString(),
        ]);
    }

    foreach ($studentIds as $sid) {
        $this->reportCache->forget((int) $sid);
    }

    return redirect()
        ->back()
        ->with('success', 'Fee collected successfully');
}

}
