<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Fee;
use App\Models\SchoolClass;
use App\Models\Section;
use App\Models\StudentSection;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Carbon\Carbon;

class PendingFeesController extends Controller
{
    public function index(Request $request)
    {
        $filters = $request->only(['class_id', 'section_id', 'search']);
        $classId = $filters['class_id'] ?? null;

        $rows = collect();

        if ($classId) {
            $rows = StudentSection::query()
                ->join('students', 'student_sections.student_id', '=', 'students.id')
                ->join('classes', 'student_sections.class_id', '=', 'classes.id')
                ->leftJoin('sections', 'student_sections.section_id', '=', 'sections.id')
                ->when($filters['section_id'] ?? null, function ($q, $sectionId) {
                    $q->where('student_sections.section_id', $sectionId);
                })
                ->when($filters['search'] ?? null, function ($q, $search) {
                    $q->where(function ($qq) use ($search) {
                        $qq->where('students.name', 'like', '%' . $search . '%');
                        if (ctype_digit((string) $search)) {
                            $qq->orWhere('students.id', (int) $search);
                        }
                    });
                })
                ->where('student_sections.class_id', $classId)
                ->select([
                    'student_sections.id',
                    'student_sections.student_id',
                    'student_sections.class_id',
                    'student_sections.section_id',
                    'student_sections.monthly_fee',
                    'student_sections.assumed_pending_months',
                    'student_sections.student_type',
                    'students.name as student_name',
                    'students.father_name as father_name',
                    'classes.name as class_name',
                    'sections.name as section_name',
                ])
                ->addSelect(DB::raw(
                    "CASE
                        WHEN student_sections.student_type = 'free' THEN 0
                        ELSE COALESCE(
                            NULLIF(student_sections.monthly_fee, 0),
                            NULLIF(sections.monthly_fee, 0),
                            classes.default_monthly_fee,
                            0
                        )
                    END as effective_monthly_fee"
                ))
                ->selectSub(
                    function ($q) {
                        $q->from('fees')
                            ->join('payments', function ($join) {
                                $join->on('payments.fee_id', '=', 'fees.id')
                                    ->whereNull('payments.deleted_at');
                            })
                            ->whereColumn('fees.student_section_id', 'student_sections.id')
                            ->selectRaw('COUNT(*) > 0');
                    },
                    'has_payments'
                )
                ->orderBy('students.name')
                ->get()
                ->map(function ($row) {
                    $row->has_payments = (bool) $row->has_payments;
                    return $row;
                });
        }

        return Inertia::render('Admin/Utilities/PendingFeesSetup', [
            'rows' => $rows,
            'filters' => $filters,
            'classes' => SchoolClass::select('id', 'name')->orderBy('name')->get(),
            'sections' => Section::select('id', 'name', 'class_id')
                ->when($classId, fn ($q) => $q->where('class_id', $classId))
                ->orderBy('name')
                ->get(),
        ]);
    }

    public function update(Request $request, StudentSection $studentSection)
    {
        $data = $request->validate([
            'assumed_pending_months' => ['nullable', 'integer', 'min:0', 'max:255'],
        ]);
        $data['assumed_pending_months'] = (int) ($data['assumed_pending_months'] ?? 0);

        $hasPayments = Fee::where('student_section_id', $studentSection->id)
            ->whereHas('payments', fn ($q) => $q->whereNull('deleted_at'))
            ->exists();

        if ($hasPayments) {
            return back()->withErrors([
                'assumed_pending_months' =>
                    'Pending months are locked after fee collection.',
            ]);
        }

        // assumed_pending_months is an onboarding assumption, not a timeline.
        $studentSection->loadMissing(['section:id,monthly_fee', 'schoolClass:id,default_monthly_fee']);
        $studentSection->update([
            'assumed_pending_months' => $data['assumed_pending_months'],
        ]);

        $this->generatePendingMonthlyFees($studentSection, (int) $data['assumed_pending_months']);

        return back()->with('success', 'Pending months updated.');
    }

    public function bulkUpdate(Request $request)
    {
        $data = $request->validate([
            'updates' => ['required', 'array', 'min:1'],
            'updates.*.id' => ['required', 'integer', 'exists:student_sections,id'],
            'updates.*.value' => ['nullable', 'integer', 'min:0', 'max:255'],
        ]);

        $updates = collect($data['updates'])->map(function ($row) {
            $row['value'] = (int) ($row['value'] ?? 0);
            return $row;
        })->keyBy('id');
        $ids = $updates->keys()->all();

        $lockedIds = Fee::whereIn('student_section_id', $ids)
            ->whereHas('payments', fn ($q) => $q->whereNull('deleted_at'))
            ->pluck('student_section_id')
            ->unique();

        if ($lockedIds->isNotEmpty()) {
            return back()->withErrors([
                'assumed_pending_months' =>
                    'Pending months are locked after fee collection.',
            ]);
        }

        // assumed_pending_months is an onboarding assumption, not a timeline.
        DB::transaction(function () use ($updates, $ids) {
            $rows = StudentSection::whereIn('id', $ids)
                ->with(['section:id,monthly_fee', 'schoolClass:id,default_monthly_fee'])
                ->get();
            foreach ($rows as $row) {
                $months = (int) $updates[$row->id]['value'];
                $row->update([
                    'assumed_pending_months' => $months,
                ]);

                $this->generatePendingMonthlyFees($row, $months);
            }
        });

        return back()->with('success', 'Pending months updated.');
    }

    private function generatePendingMonthlyFees(StudentSection $studentSection, int $months): void
    {
        if ($months < 0) {
            return;
        }

        $effectiveFee = $this->resolveEffectiveMonthlyFee($studentSection);
        if ($effectiveFee <= 0) {
            return;
        }

        $desiredMonths = [];
        for ($i = 0; $i < $months; $i++) {
            $desiredMonths[] = Carbon::now()->subMonths($i)->format('Y-m');
        }
        $desiredSet = array_flip($desiredMonths);

        $existingMonthly = Fee::where('student_section_id', $studentSection->id)
            ->where('type', 'monthly')
            ->get();

        $existingSet = $existingMonthly
            ->pluck('month')
            ->filter()
            ->flip()
            ->all();

        // Create missing desired months
        foreach ($desiredMonths as $month) {
            if (isset($existingSet[$month])) {
                continue;
            }

            Fee::create([
                'student_section_id' => $studentSection->id,
                'type' => 'monthly',
                'month' => $month,
                'amount' => $effectiveFee,
                'source' => 'monthly',
            ]);
        }

        // Remove extra unpaid monthly fees not in desired set
        if ($months === 0) {
            Fee::where('student_section_id', $studentSection->id)
                ->where('type', 'monthly')
                ->whereDoesntHave('payments', fn ($q) => $q->whereNull('deleted_at'))
                ->delete();
            return;
        }

        $extra = $existingMonthly->filter(function ($fee) use ($desiredSet) {
            $month = $fee->month ?? '';
            return !isset($desiredSet[$month]);
        });

        foreach ($extra as $fee) {
            if ($fee->payments()->whereNull('deleted_at')->exists()) {
                continue;
            }
            $fee->delete();
        }
    }

    private function resolveEffectiveMonthlyFee(StudentSection $studentSection): int
    {
        if ($studentSection->student_type === 'free') {
            return 0;
        }

        $own = (int) $studentSection->monthly_fee;
        if ($own > 0) {
            return $own;
        }

        $sectionFee = (int) optional($studentSection->section)->monthly_fee;
        if ($sectionFee > 0) {
            return $sectionFee;
        }

        $classFee = (int) optional($studentSection->schoolClass)->default_monthly_fee;
        return $classFee > 0 ? $classFee : 0;
    }
}
