<?php

namespace App\Http\Controllers\Admin;

use App\Models\Fee;
use App\Services\StudentReport\StudentReportCache;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use App\Models\Payment;
use App\Http\Controllers\Controller;
use App\Models\StudentSection;
use App\Models\Section;
use App\Support\DivisionTypeResolver;
class FeesController extends Controller
{
    public function __construct(
        private readonly StudentReportCache $reportCache,
    ) {}

    /**
     * Resolve the student_id owning this fee (via the enrollment).
     * Centralised so the seven write paths below stay consistent.
     */
    private function studentIdFor(Fee $fee): int
    {
        $sid = DB::table('student_sections')->where('id', $fee->student_section_id)->value('student_id');
        return (int) $sid;
    }
    public function index(Request $request)
{
    $month = $request->string('month')->toString();
    $monthFrom = $request->string('month_from')->toString();
    $monthTo = $request->string('month_to')->toString();

    $fees = Fee::query()
        ->join('students', 'fees.student_id', '=', 'students.id')
        // Join the fee's original enrollment to know what class type/section it
        // was originally created for — this ensures Kirtan fees stay Kirtan and
        // Gurmukhi fees stay Gurmukhi, even if the student has both.
        ->join('student_sections as orig_enrollment', 'fees.student_section_id', '=', 'orig_enrollment.id')
        ->join('classes as orig_class', 'orig_enrollment.class_id', '=', 'orig_class.id')
        ->leftJoin('payments', function ($join) {
            $join->on('payments.fee_id', '=', 'fees.id')
                 ->whereNull('payments.deleted_at');
        })

        ->select([
            'fees.*',
            'students.id as student_id',
            'students.name as student_name',
            'students.father_name as father_name',
            // class_type from the ORIGINAL enrollment — correctly resolves
            // Kirtan vs Gurmukhi per fee, even for students with both.
            'orig_class.type as class_type',
            // Current section/class: use the student's active enrollment in
            // the SAME class (handles within-class section changes). If none
            // exists (student was promoted to a different class), fall back
            // to the original enrollment's data via COALESCE.
            DB::raw('COALESCE(
                (SELECT s.name FROM student_sections ss
                 JOIN sections s ON s.id = ss.section_id
                 WHERE ss.student_id = fees.student_id
                   AND ss.status = "active"
                   AND ss.transferred_at IS NULL
                   AND ss.class_id = orig_enrollment.class_id
                 LIMIT 1),
                (SELECT s2.name FROM sections s2 WHERE s2.id = orig_enrollment.section_id)
            ) as section_name'),
            DB::raw('COALESCE(
                (SELECT c.name FROM student_sections ss
                 JOIN classes c ON c.id = ss.class_id
                 WHERE ss.student_id = fees.student_id
                   AND ss.status = "active"
                   AND ss.transferred_at IS NULL
                   AND ss.class_id = orig_enrollment.class_id
                 LIMIT 1),
                orig_class.name
            ) as class_name'),
            DB::raw('COALESCE(
                (SELECT ss.class_id FROM student_sections ss
                 WHERE ss.student_id = fees.student_id
                   AND ss.status = "active"
                   AND ss.transferred_at IS NULL
                   AND ss.class_id = orig_enrollment.class_id
                 LIMIT 1),
                orig_enrollment.class_id
            ) as class_id'),
            DB::raw('COALESCE(
                (SELECT ss.section_id FROM student_sections ss
                 WHERE ss.student_id = fees.student_id
                   AND ss.status = "active"
                   AND ss.transferred_at IS NULL
                   AND ss.class_id = orig_enrollment.class_id
                 LIMIT 1),
                orig_enrollment.section_id
            ) as section_id'),
            'payments.paid_at',
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
            $q->whereExists(function ($qq) use ($classId) {
                $qq->selectRaw('1')
                   ->from('student_sections')
                   ->whereColumn('student_sections.student_id', 'fees.student_id')
                   ->where('status', 'active')
                   ->whereNull('transferred_at')
                   ->where('class_id', $classId);
            })
        )

        ->when($request->section_id, fn ($q, $sectionId) =>
            $q->whereExists(function ($qq) use ($sectionId) {
                $qq->selectRaw('1')
                   ->from('student_sections')
                   ->whereColumn('student_sections.student_id', 'fees.student_id')
                   ->where('status', 'active')
                   ->whereNull('transferred_at')
                   ->where('section_id', $sectionId);
            })
        )

        ->when($month !== '', fn ($q) =>
            $q->where('fees.month', $month)
        )
        ->when($month === '' && ($monthFrom !== '' || $monthTo !== ''), function ($q) use ($monthFrom, $monthTo) {
            $q->where('fees.type', 'monthly');

            if ($monthFrom !== '' && $monthTo !== '') {
                $startMonth = $monthFrom <= $monthTo ? $monthFrom : $monthTo;
                $endMonth = $monthFrom <= $monthTo ? $monthTo : $monthFrom;
                $q->whereBetween('fees.month', [$startMonth, $endMonth]);
                return;
            }

            if ($monthFrom !== '') {
                $q->where('fees.month', '>=', $monthFrom);
            }

            if ($monthTo !== '') {
                $q->where('fees.month', '<=', $monthTo);
            }
        })

        ->when($request->search, function ($q, $search) {
            $q->where(function ($qq) use ($search) {
                $qq->where('students.name', 'like', "%{$search}%")
                   ->orWhere('students.father_name', 'like', "%{$search}%");
            });
        })
        ->when($request->status === 'paid', function ($q) {
    $q->whereNotNull('payments.id');
})

->when($request->status === 'unpaid', function ($q) {
    $q->whereNull('payments.id');
})
        ->when($request->paid_from, function ($q, $paidFrom) {
            $q->whereDate('payments.paid_at', '>=', $paidFrom);
        })
        ->when($request->paid_to, function ($q, $paidTo) {
            $q->whereDate('payments.paid_at', '<=', $paidTo);
        })

        ->orderBy('fees.created_at', 'desc')
        ->get()
        ->map(function ($fee) {
            // Normalize to real boolean for JS (avoid "0" string truthiness)
            $fee->is_paid = (bool) $fee->is_paid;
            return $fee;
        });

    $grouped = $fees->groupBy(function ($f) {
        return $f->student_id;
    })->map(function ($items) {
        $first = $items->first();
        $paid = $items->where('is_paid', true);
        $unpaid = $items->where('is_paid', false);

        // Collect unique class/section names across all of this student's fees
        $classNames = $items->pluck('class_name')->filter()->unique()->values()->toArray();
        $sectionNames = $items->pluck('section_name')->filter()->unique()->values()->toArray();
        $classTypes = $items
            ->map(fn ($f) => DivisionTypeResolver::division(
                $f->class_type ?? null,
                $f->class_name ?? null
            ))
            ->filter()
            ->unique()
            ->values()
            ->toArray();

        $combinedClass = implode(', ', $classNames);
        $hasKirtan = in_array('kirtan', $classTypes);

        return [
            'student_id'   => $first->student_id,
            'student_name' => $first->student_name,
            'father_name'  => $first->father_name ?? '',
            'class_name'   => $combinedClass,
            'class_type'   => $hasKirtan
                ? 'kirtan'
                : DivisionTypeResolver::division(
                    $first->class_type ?? null,
                    $first->class_name ?? null
                ),
            'section_name' => implode(', ', $sectionNames),
            'paid_count'   => $paid->count(),
            'paid_amount'  => $paid->sum('amount'),
            'unpaid_count' => $unpaid->count(),
            'unpaid_amount' => $unpaid->sum('amount'),
            'total_amount' => $items->sum('amount'),
            'fees' => $items->map(function ($f) {
                return [
                    'id'         => $f->id,
                    'type'       => $f->type,
                    'month'      => $f->month,
                    'title'      => $f->title,
                    'amount'     => $f->amount,
                    'paid_at'    => $f->paid_at,
                    'class_type' => DivisionTypeResolver::division(
                        $f->class_type ?? null,
                        $f->class_name ?? null
                    ),
                    'is_paid'    => (bool) $f->is_paid,
                ];
            })->values(),
        ];
    })->values();

    return inertia('Admin/Fees/Index', [
        'fees' => $grouped,
        'filters' => $request->only([
            'year',
            'class_id',
            'section_id',
            'search',
            'status',
            'month',
            'month_from',
            'month_to',
            'paid_from',
            'paid_to',
        ]),
    ]);
}

    public function generateMonthlyFees()
    {
        Artisan::call('fees:generate-monthly', [
            '--no-interaction' => true,
        ]);

        return back()->with('success', 'Monthly fees generated successfully.');
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

    $data = request()->validate([
        'collection_date' => ['required', 'date'],
    ]);

    $collectionDate = Carbon::parse($data['collection_date'], config('app.timezone'))
        ->startOfDay();

    Payment::create([
        'fee_id'      => $fee->id,
        'amount_paid' => $fee->amount,
        'paid_at'     => $collectionDate,
    ]);

    // Lock custom fee after payment
    if ($fee->type === 'custom') {
        $fee->update(['is_locked' => true]);
    }

    $this->reportCache->forget($this->studentIdFor($fee));

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

    // Releasing a payment unlocks the fee again so it can be edited or
    // re-collected (mirrors the lock applied in collect()).
    $fee->update(['is_locked' => false]);

    $this->reportCache->forget($this->studentIdFor($fee));

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
        ->where('student_sections.status', 'active')
        ->whereNull('student_sections.transferred_at')

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

        $enrollments = StudentSection::where('section_id', $data['section_id'])->where('status', 'active')->get();

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
                    ]
                );
            }
        });

        foreach ($enrollments as $enrollment) {
            $this->reportCache->forget((int) $enrollment->student_id);
        }

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

        $studentIds = DB::table('student_sections')
            ->where('section_id', $data['section_id'])
            ->pluck('student_id')
            ->unique();
        foreach ($studentIds as $sid) {
            $this->reportCache->forget((int) $sid);
        }

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

        $studentId = $this->studentIdFor($fee);
        $fee->delete();
        $this->reportCache->forget($studentId);

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

        $studentIds = DB::table('student_sections')
            ->where('section_id', $data['section_id'])
            ->pluck('student_id')
            ->unique();
        foreach ($studentIds as $sid) {
            $this->reportCache->forget((int) $sid);
        }

        return back()->with('success', 'Custom fee deleted for section.');
    }
}
