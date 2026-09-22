<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Fee;
use App\Models\StudentSection;
use App\Services\PendingMonthsGenerator;
use App\Support\DivisionTypeResolver;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

/**
 * Multi-class fee correction (Gurmukhi + Kirtan students only).
 *
 * Business condition: for a student in both Gurmukhi and Kirtan, the Kirtan
 * enrollment is the affected stream; Gurmukhi is reference-only. All mutations
 * are keyed by the Kirtan student_section_id — never student_id — so the
 * sibling fee stream cannot be modified. The Admin reviews and explicitly
 * confirms the Kirtan pending months; nothing is auto-repaired.
 */
class MultiClassFeeCorrectionController extends Controller
{
    public function __construct(
        private readonly PendingMonthsGenerator $generator,
    ) {
    }

    public function index()
    {
        return Inertia::render('Admin/Utilities/MultiClassFeeCorrection', []);
    }

    public function candidates(Request $request)
    {
        $search = trim((string) $request->query('search', ''));

        $pairs = $this->loadCandidatePairs($search);

        return response()->json([
            'students' => $pairs,
        ]);
    }

    public function preview(Request $request)
    {
        $data = $request->validate([
            'student_section_id' => ['required', 'integer', 'exists:student_sections,id'],
            'pending_months' => ['required', 'integer', 'min:0', 'max:255'],
        ]);

        $enrollment = $this->loadTarget((int) $data['student_section_id']);
        $months = (int) $data['pending_months'];

        $error = $this->validateCorrection($enrollment, $months);
        if ($error !== null) {
            return response()->json(['message' => $error], 422);
        }

        $existing = $this->monthlyFeeMonths($enrollment);
        $desired = $this->generator->desiredMonths($months, $this->startFloor($enrollment));
        $existingSet = array_flip($existing);

        $willCreate = array_values(array_filter($desired, fn ($m) => !isset($existingSet[$m])));
        $existingDesired = array_flip($desired);
        $willDelete = array_values(array_filter($existing, fn ($m) => !isset($existingDesired[$m])));

        return response()->json([
            'target' => $this->enrollmentPayload($enrollment),
            'reference' => $this->referencePayload($enrollment),
            'existing_months' => $existing,
            'desired_months' => $desired,
            'will_create' => $willCreate,
            'will_delete_unpaid' => $willDelete,
            'pending_months' => $months,
        ]);
    }

    public function apply(Request $request)
    {
        $data = $request->validate([
            'student_section_id' => ['required', 'integer', 'exists:student_sections,id'],
            'pending_months' => ['required', 'integer', 'min:0', 'max:255'],
        ]);

        // Mutation key is ONLY the Kirtan enrollment id — student_id is never accepted.
        $enrollment = $this->loadTarget((int) $data['student_section_id']);
        $months = (int) $data['pending_months'];

        $error = $this->validateCorrection($enrollment, $months);
        if ($error !== null) {
            return response()->json(['message' => $error], 422);
        }

        $before = $this->monthlyFeeMonths($enrollment);
        $siblingBefore = $this->siblingSnapshot($enrollment);

        DB::transaction(function () use ($enrollment, $months, $before) {
            $enrollment->update(['assumed_pending_months' => $months]);
            $this->generator->generate($enrollment, $months, $this->startFloor($enrollment));

            AuditLog::record(
                AuditLog::ACTION_FEE_PENDING_MONTHS_CORRECTED,
                $enrollment,
                [
                    'student_section_id' => $enrollment->id,
                    'student_id' => $enrollment->student_id,
                    'pending_months' => $months,
                    'before_months' => $before,
                    'after_months' => $this->monthlyFeeMonths($enrollment),
                ],
            );
        });

        $after = $this->monthlyFeeMonths($enrollment);
        $siblingAfter = $this->siblingSnapshot($enrollment);

        return response()->json([
            'message' => 'Kirtan pending months corrected.',
            'target' => $this->enrollmentPayload($enrollment->refresh()),
            'reference' => $this->referencePayload($enrollment),
            'existing_months' => $after,
            'before_months' => $before,
            'reference_unchanged' => $siblingBefore === $siblingAfter,
        ]);
    }

    /** @return list<array<string, mixed>> */
    private function loadCandidatePairs(string $search): array
    {
        $enrollments = StudentSection::query()
            ->with([
                'student:id,name,father_name,status',
                'schoolClass:id,name,type,division,default_monthly_fee,charges_monthly_fee',
                'section:id,name,monthly_fee',
            ])
            ->current()
            ->get()
            ->filter(function (StudentSection $enrollment) {
                $class = $enrollment->schoolClass;
                if ($class === null || $enrollment->student === null) {
                    return false;
                }
                return DivisionTypeResolver::isKirtan($class->type, $class->name, $class->division)
                    || DivisionTypeResolver::isGurmukhi($class->type, $class->name, $class->division);
            });

        $byStudent = [];
        foreach ($enrollments as $enrollment) {
            $byStudent[(int) $enrollment->student_id][] = $enrollment;
        }

        $pairs = [];
        foreach ($byStudent as $studentId => $rows) {
            $kirtan = null;
            $gurmukhi = null;
            foreach ($rows as $row) {
                $class = $row->schoolClass;
                $isKirtan = DivisionTypeResolver::isKirtan($class->type, $class->name, $class->division);
                if ($isKirtan && $kirtan === null) {
                    $kirtan = $row;
                } elseif (!$isKirtan && $gurmukhi === null) {
                    $gurmukhi = $row;
                }
            }

            if ($kirtan === null || $gurmukhi === null) {
                continue;
            }

            $student = $kirtan->student;
            if ($search !== ''
                && !str_contains(strtolower($student->name), strtolower($search))
                && !(ctype_digit($search) && (int) $student->id === (int) $search)
            ) {
                continue;
            }

            $pairs[] = [
                'student_id' => $studentId,
                'student_name' => $student->name,
                'father_name' => $student->father_name,
                'reference' => $this->enrollmentPayload($gurmukhi) + ['role' => 'reference'],
                'target' => $this->enrollmentPayload($kirtan) + [
                    'role' => 'target',
                    'charges_monthly_fee' => $kirtan->schoolClass->chargesMonthlyFee(),
                ],
            ];
        }

        usort($pairs, fn ($a, $b) => strcasecmp($a['student_name'], $b['student_name']));

        return $pairs;
    }

    private function loadTarget(int $studentSectionId): StudentSection
    {
        return StudentSection::with([
            'student:id,name,father_name,status',
            'schoolClass:id,name,type,division,default_monthly_fee,charges_monthly_fee',
            'section:id,name,monthly_fee',
        ])->findOrFail($studentSectionId);
    }

    /**
     * Server-side business condition: target must be Kirtan, student must also
     * have an active Gurmukhi reference enrollment, and correction rules hold.
     */
    private function validateCorrection(StudentSection $target, int $months): ?string
    {
        $class = $target->schoolClass;
        if ($class === null) {
            return 'Enrollment class not found.';
        }

        if (!DivisionTypeResolver::isKirtan($class->type, $class->name, $class->division)) {
            return 'Correction target must be the Kirtan enrollment.';
        }

        $hasGurmukhiSibling = StudentSection::query()
            ->current()
            ->where('student_id', $target->student_id)
            ->where('id', '!=', $target->id)
            ->with('schoolClass:id,name,type,division')
            ->get()
            ->contains(function (StudentSection $sibling) {
                $c = $sibling->schoolClass;
                return $c !== null
                    && DivisionTypeResolver::isGurmukhi($c->type, $c->name, $c->division);
            });

        if (!$hasGurmukhiSibling) {
            return 'Student must have an active Gurmukhi reference enrollment.';
        }

        $hasPayments = Fee::where('student_section_id', $target->id)
            ->whereHas('payments', fn ($q) => $q->whereNull('deleted_at'))
            ->exists();

        if ($hasPayments) {
            return 'Pending months are locked after fee collection.';
        }

        if ($months > 0) {
            if ($target->student_type === 'free') {
                return 'Free enrollments cannot have pending monthly fees.';
            }
            if (!$class->chargesMonthlyFee()) {
                return 'This Kirtan class does not charge a monthly fee; pending months must be 0.';
            }
        }

        return null;
    }

    /** @return list<string> */
    private function monthlyFeeMonths(StudentSection $enrollment): array
    {
        return Fee::where('student_section_id', $enrollment->id)
            ->where('type', 'monthly')
            ->whereNotNull('month')
            ->orderByDesc('month')
            ->pluck('month')
            ->values()
            ->all();
    }

    private function startFloor(StudentSection $enrollment): ?Carbon
    {
        return $enrollment->started_at
            ? Carbon::parse($enrollment->started_at, config('app.timezone'))
            : null;
    }

    /** @return array<int, array<string, mixed>> fee-row fingerprint for sibling isolation checks */
    private function siblingSnapshot(StudentSection $target): array
    {
        $reference = $this->findGurmukhiReference($target);
        if ($reference === null) {
            return [];
        }

        return Fee::where('student_section_id', $reference->id)
            ->where('type', 'monthly')
            ->orderBy('id')
            ->get(['id', 'month', 'amount', 'type', 'student_section_id'])
            ->map(fn (Fee $fee) => [
                'id' => $fee->id,
                'month' => $fee->month,
                'amount' => $fee->amount,
                'type' => $fee->type,
                'student_section_id' => $fee->student_section_id,
            ])
            ->all();
    }

    private function findGurmukhiReference(StudentSection $target): ?StudentSection
    {
        return StudentSection::query()
            ->current()
            ->where('student_id', $target->student_id)
            ->where('id', '!=', $target->id)
            ->with('schoolClass:id,name,type,division')
            ->get()
            ->first(function (StudentSection $sibling) {
                $c = $sibling->schoolClass;
                return $c !== null
                    && DivisionTypeResolver::isGurmukhi($c->type, $c->name, $c->division);
            });
    }

    private function enrollmentPayload(StudentSection $enrollment): array
    {
        $class = $enrollment->schoolClass;
        $hasPayments = Fee::where('student_section_id', $enrollment->id)
            ->whereHas('payments', fn ($q) => $q->whereNull('deleted_at'))
            ->exists();

        return [
            'id' => $enrollment->id,
            'student_id' => $enrollment->student_id,
            'class_name' => $class?->name,
            'class_type' => $class?->type,
            'class_division' => $class?->division,
            'section_name' => $enrollment->section?->name,
            'student_type' => $enrollment->student_type,
            'status' => $enrollment->status,
            'started_at' => $enrollment->started_at?->toDateString(),
            'assumed_pending_months' => (int) ($enrollment->assumed_pending_months ?? 0),
            'fee_months_count' => count($this->monthlyFeeMonths($enrollment)),
            'fee_months' => $this->monthlyFeeMonths($enrollment),
            'has_payments' => $hasPayments,
            'charges_monthly_fee' => $class?->chargesMonthlyFee(),
            'effective_monthly_fee' => $enrollment->section?->monthly_fee
                ?? $class?->default_monthly_fee
                ?? 0,
        ];
    }

    private function referencePayload(StudentSection $target): ?array
    {
        $reference = $this->findGurmukhiReference($target);
        if ($reference === null) {
            return null;
        }

        return $this->enrollmentPayload($reference) + ['role' => 'reference'];
    }
}
