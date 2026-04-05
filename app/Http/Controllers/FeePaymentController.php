<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\Fee;
use Carbon\Carbon;

class FeePaymentController extends Controller
{
    public function store(Request $request)
{
    $request->validate([
        'fee_ids' => ['required', 'array', 'min:1'],
        'fee_ids.*' => ['exists:fees,id'],
        'collection_date' => ['required', 'date'],
    ]);

    $collectionDate = Carbon::parse($request->collection_date, config('app.timezone'))
        ->startOfDay();

    foreach ($request->fee_ids as $feeId) {

        $fee = Fee::findOrFail($feeId);

        // Skip if already paid
        if ($fee->payments()->whereNull('deleted_at')->exists()) {
            continue;
        }

        $fee->payments()->create([
            'amount_paid' => $fee->amount,
            'paid_at' => $collectionDate,
        ]);
    }

    return redirect()
        ->back()
        ->with('success', 'Fee collected successfully');
}

}
