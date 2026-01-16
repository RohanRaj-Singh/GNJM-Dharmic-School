<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use App\Models\Student;
use App\Models\Fee;
use App\Models\FeePayment;
use App\Models\Payment;

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
        if ($fee->payments()->exists()) {
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
