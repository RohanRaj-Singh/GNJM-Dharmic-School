<?php

namespace App\Http\Controllers\Admin;

use App\Models\Fee;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use App\Models\Payment;
use App\Http\Controllers\Controller;
use App\Models\StudentSection;
use App\Models\Section;
class FeesController extends Controller
{
    public function index(Request $request)
{


    $fees = Fee::query()
        ->join('student_sections', 'fees.student_section_id', '=', 'student_sections.id')
        ->join('students', 'student_sections.student_id', '=', 'students.id')
        ->join('classes', 'student_sections.class_id', '=', 'classes.id')
        ->leftJoin('sections', 'student_sections.section_id', '=', 'sections.id')

        ->leftJoin('payments', function ($join) {
            $join->on('payments.fee_id', '=', 'fees.id')
                 ->whereNull('payments.deleted_at');
        })

        ->select([
            'fees.id',
            'fees.type',
            'fees.source',
            'fees.month',
            'fees.title',
            'fees.amount',
            'fees.batch_id',
            'student_sections.class_id',
            'student_sections.section_id',
            'students.id as student_id',
            'students.name as student_name',
            'classes.name as class_name',
            'sections.name as section_name',
            DB::raw('payments.id IS NOT NULL as is_paid'),
        ])

        // YEAR FILTER (FIXED)
        ->when($request->year, function ($q, $year) {
            $q->where(function ($qq) use ($year) {
                $qq->where('fees.type', 'monthly')
                   ->where('fees.month', 'like', $year . '-%')
                   ->orWhere('fees.type', 'custom');
            });
        })

        ->when($request->class_id, fn ($q, $classId) =>
            $q->where('student_sections.class_id', $classId)
        )

        ->when($request->section_id, fn ($q, $sectionId) =>
            $q->where('student_sections.section_id', $sectionId)
        )

        ->when($request->search, fn ($q, $search) =>
            $q->where('students.name', 'like', "%{$search}%")
        )
        ->when($request->status === 'paid', function ($q) {
    $q->whereNotNull('payments.id');
})

->when($request->status === 'unpaid', function ($q) {
    $q->whereNull('payments.id');
})

        ->orderBy('fees.created_at', 'desc')
        ->get()
        ->map(function ($fee) {
            // Normalize to real boolean for JS (avoid "0" string truthiness)
            $fee->is_paid = (bool) $fee->is_paid;
            return $fee;
        });

    $grouped = $fees->groupBy(function ($f) {
        return implode('|', [
            $f->student_id,
            $f->class_id ?? '',
            $f->section_id ?? '',
        ]);
    })->map(function ($items) {
        $first = $items->first();
        $paid = $items->where('is_paid', true);
        $unpaid = $items->where('is_paid', false);

        return [
            'student_id' => $first->student_id,
            'student_name' => $first->student_name,
            'class_name' => $first->class_name,
            'section_name' => $first->section_name,
            'paid_count' => $paid->count(),
            'paid_amount' => $paid->sum('amount'),
            'unpaid_count' => $unpaid->count(),
            'unpaid_amount' => $unpaid->sum('amount'),
            'total_amount' => $items->sum('amount'),
            'fees' => $items->map(function ($f) {
                return [
                    'id' => $f->id,
                    'type' => $f->type,
                    'source' => $f->source,
                    'month' => $f->month,
                    'title' => $f->title,
                    'amount' => $f->amount,
                    'is_paid' => (bool) $f->is_paid,
                ];
            })->values(),
        ];
    })->values();
       // dd($fees->count(), $fees->take(5));

    return inertia('Admin/Fees/Index', [
        'fees' => $grouped,
        'filters' => $request->only([
            'year',
            'class_id',
            'section_id',
            'search',
            'status',
        ]),
    ]);
}

    public function collect(Fee $fee)
{
    // Prevent double payment
    $alreadyPaid = $fee->payments()
        ->whereNull('deleted_at')
        ->exists();

    if ($alreadyPaid) {
        return back()->withErrors([
            'collect' => 'This fee has already been collected.',
        ]);
    }

    Payment::create([
        'fee_id'      => $fee->id,
        'amount_paid' => $fee->amount,
        'paid_at'     => now(),
    ]);

    // Lock custom fee after payment
    if ($fee->source === 'custom') {
        $fee->update(['is_locked' => true]);
    }

    return back()->with('success', 'Fee collected successfully.');
}
public function deCollect(Fee $fee)
{
    $payment = $fee->payments()
        ->whereNull('deleted_at')
        ->first();

    if (!$payment) {
        return back()->withErrors([
            'deCollect' => 'This fee is not collected yet.',
        ]);
    }

    $payment->delete(); // soft delete

    return back()->with('success', 'Fee un-collected successfully.');
}

public function customIndex()
{
    $rows = Fee::query()
        ->where('fees.type', 'custom')
        ->join('student_sections', 'fees.student_section_id', '=', 'student_sections.id')
        ->join('sections', 'student_sections.section_id', '=', 'sections.id')
        ->join('classes', 'student_sections.class_id', '=', 'classes.id')
        ->leftJoin('payments', 'payments.fee_id', '=', 'fees.id')

        ->select([
            'sections.id as section_id',
            'sections.name as section_name',
            'classes.name as class_name',
            'fees.title',
            'fees.amount',
            DB::raw('COUNT(DISTINCT fees.id) as total_students'),
            DB::raw('COUNT(DISTINCT payments.id) as paid_count'),
        ])
        ->groupBy(
            'sections.id',
            'sections.name',
            'classes.name',
            'fees.title',
            'fees.amount'
        )
        ->orderBy('classes.name')
        ->orderBy('sections.name')
        ->get();

    return inertia('Admin/Fees/CustomFee', [
        'rows' => $rows,
        'sections' => Section::with('schoolClass:id,name')
            ->select('id', 'name', 'class_id')
            ->get()
            ->map(fn ($s) => [
                'id' => $s->id,
                'name' => $s->name,
                'class_name' => $s->schoolClass->name,
            ]),
    ]);
}


    /* =========================================================
     | CREATE CUSTOM FEE (SECTION-BASED)
     ========================================================= */
    public function storeCustomFee(Request $request)
    {
        $data = $request->validate([
            'section_id' => 'required|exists:sections,id',
            'title'      => 'required|string|max:255',
            'amount'     => 'required|integer|min:1',
        ]);

        $enrollments = StudentSection::where('section_id', $data['section_id'])->get();

        if ($enrollments->isEmpty()) {
            return back()->withErrors([
                'assign' => 'No students found in selected section.',
            ]);
        }

        DB::transaction(function () use ($enrollments, $data) {
            foreach ($enrollments as $enrollment) {
                Fee::firstOrCreate(
                    [
                        'student_section_id' => $enrollment->id,
                        'type'  => 'custom',
                        'title' => $data['title'],
                    ],
                    [
                        'amount' => $data['amount'],
                        'source' => 'custom',
                    ]
                );
            }
        });

        return back()->with('success', 'Custom fee assigned to section.');
    }

    /* =========================================================
     | UPDATE CUSTOM FEE (INLINE EDIT)
     | ❌ BLOCKED IF ANY STUDENT PAID
     ========================================================= */
    public function updateCustomFee(Request $request)
    {
        $data = $request->validate([
            'section_id' => 'required|exists:sections,id',
            'old_title'  => 'required|string',
            'old_amount' => 'required|integer',
            'title'      => 'required|string|max:255',
            'amount'     => 'required|integer|min:1',
        ]);

        $hasPaid = Fee::where('type', 'custom')
            ->where('title', $data['old_title'])
            ->where('amount', $data['old_amount'])
            ->whereHas('studentSection', fn ($q) =>
                $q->where('section_id', $data['section_id'])
            )
            ->whereHas('payments', fn ($q) =>
                $q->whereNull('deleted_at')
            )
            ->exists();

        if ($hasPaid) {
            return back()->withErrors([
                'update' => 'Cannot update custom fee. One or more students have already paid.',
            ]);
        }

        Fee::where('type', 'custom')
            ->where('title', $data['old_title'])
            ->where('amount', $data['old_amount'])
            ->whereHas('studentSection', fn ($q) =>
                $q->where('section_id', $data['section_id'])
            )
            ->update([
                'title'  => $data['title'],
                'amount' => $data['amount'],
            ]);

        return back()->with('success', 'Custom fee updated.');
    }

    /* =========================================================
     | DELETE CUSTOM FEE — SINGLE STUDENT
     | ✔ Allowed ONLY if unpaid
     ========================================================= */
    public function destroyCustomFeeForStudent(Fee $fee)
    {
        if ($fee->payments()->exists()) {
            return back()->withErrors([
                'delete' =>
                    "Cannot delete. Student has already paid this fee.",
            ]);
        }

        $fee->delete();

        return back()->with('success', 'Custom fee removed for student.');
    }

    /* =========================================================
     | DELETE CUSTOM FEE — ENTIRE SECTION
     | ❌ BLOCKED IF ANY STUDENT PAID
     ========================================================= */
    public function destroyCustomFeeForSection(Request $request)
    {
        $data = $request->validate([
            'section_id' => 'required|exists:sections,id',
            'title'      => 'required|string',
            'amount'     => 'required|integer',
        ]);

        $hasPaid = Fee::where('type', 'custom')
            ->where('title', $data['title'])
            ->where('amount', $data['amount'])
            ->whereHas('studentSection', fn ($q) =>
                $q->where('section_id', $data['section_id'])
            )
            ->whereHas('payments')
            ->exists();

        if ($hasPaid) {
            return back()->withErrors([
                'delete' =>
                    'Cannot delete. One or more students have paid this fee.',
            ]);
        }

        Fee::where('type', 'custom')
            ->where('title', $data['title'])
            ->where('amount', $data['amount'])
            ->whereHas('studentSection', fn ($q) =>
                $q->where('section_id', $data['section_id'])
            )
            ->delete();

        return back()->with('success', 'Custom fee deleted for section.');
    }
}
