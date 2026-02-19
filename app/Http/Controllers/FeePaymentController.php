<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\Fee;

class FeePaymentController extends Controller
{
    public function store(Request $request)
{
    $request->validate([
        'fee_ids' => ['required', 'array', 'min:1'],
        'fee_ids.*' => ['exists:fees,id'],
    ]);

    foreach ($request->fee_ids as $feeId) {

        $fee = Fee::findOrFail($feeId);

        // Skip if already paid
        if ($fee->payments()->whereNull('deleted_at')->exists()) {
            continue;
        }

        $fee->payments()->create([
            'amount_paid' => $fee->amount,
            'paid_at' => now(),
        ]);
    }

    return redirect()
        ->back()
        ->with('success', 'Fee collected successfully');
}

}
