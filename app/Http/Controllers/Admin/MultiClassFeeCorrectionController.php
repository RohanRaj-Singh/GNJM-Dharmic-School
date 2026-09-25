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

        // Clamp to the unpaid tail (months strictly after the last paid month)
        // so the preview reflects the value that will actually be applied.
        $months = $this->capMonths($enrollment, $months);

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

        $result = $this->applyOne($enrollment, $months);

        return response()->json([
            'message' => 'Kirtan pending months corrected.',
            'target' => $this->enrollmentPayload($enrollment->refresh()),
            'reference' => $this->referencePayload($enrollment),
            'existing_months' => $result['after'],
            'before_months' => $result['before'],
            'reference_unchanged' => $result['reference_unchanged'],
        ]);
    }

    /**
     * Apply pending-months corrections for many Kirtan enrollments in a single
     * transaction. Each row is re-validated server-side before mutation; if any
     * correction is invalid the whole batch is rejected (422) so the admin can
     * review and fix, then retry. Gurmukhi reference enrollments are never
     * touched — only the supplied Kirtan student_section_id values are mutated.
     */
    public function bulkApply(Request $request)
    {
        $data = $request->validate([
            'corrections' => ['required', 'array', 'min:1'],
            'corrections.*.student_section_id' => ['required', 'integer', 'exists:student_sections,id'],
            'corrections.*.pending_months' => ['required', 'integer', 'min:0', 'max:255'],
        ]);

        $corrections = [];
        $errors = [];

        foreach ($data['corrections'] as $row) {
            $enrollment = $this->loadTarget((int) $row['student_section_id']);
            $months = (int) $row['pending_months'];

            // Skip silently if the edit was reverted to the original value.
            if ($months === (int) ($enrollment->assumed_pending_months ?? 0)) {
                continue;
            }

            $error = $this->validateCorrection($enrollment, $months);
            if ($error !== null) {
                $errors[] = [
                    'student_section_id' => $enrollment->id,
                    'student_name' => $enrollment->student?->name,
                    'error' => $error,
                ];
                continue;
            }

            $corrections[] = [$enrollment, $months];
        }

        if (!empty($errors)) {
            return response()->json([
                'message' => sprintf(
                    '%d correction(s) failed validation — none were applied.',
                    count($errors)
                ),
                'errors' => $errors,
            ], 422);
        }

        // Nothing left to do after skipping unchanged rows.
        if (empty($corrections)) {
            return response()->json([
                'message' => 'No pending changes to apply.',
                'applied' => [],
                'reference_unchanged' => true,
            ]);
        }

        $results = [];

        DB::transaction(function () use ($corrections, &$results) {
            foreach ($corrections as [$enrollment, $months]) {
                $results[] = $this->applyOne($enrollment, $months, true);
            }
        });

        $referenceUnchanged = collect($results)->every(fn ($r) => $r['reference_unchanged']);

        return response()->json([
            'message' => sprintf('%d student(s) corrected.', count($results)),
            'applied' => $results,
            'reference_unchanged' => $referenceUnchanged,
        ]);
    }

     /**
      * Shared mutation helper. Performs the update + audit log and returns
      * before/after months plus a sibling-isolation check, so the caller can
      * decide how to report. The caller MUST wrap this in a DB::transaction
      * when atomicity across multiple corrections is required. When $isBulk
      * is true the audit payload is tagged `bulk => true` to distinguish a
      * batch correction from a single-student apply (preserving the original
      * single-apply audit shape exactly).
      */
    private function applyOne(StudentSection $enrollment, int $months, bool $isBulk = false): array
    {
        $months = $this->capMonths($enrollment, $months);

        $before = $this->monthlyFeeMonths($enrollment);
        $siblingBefore = $this->siblingSnapshot($enrollment);

        $enrollment->update(['assumed_pending_months' => $months]);
        $this->generator->generate($enrollment, $months, $this->startFloor($enrollment));

        $after = $this->monthlyFeeMonths($enrollment);
        $siblingAfter = $this->siblingSnapshot($enrollment);

        $payload = [
            'student_section_id' => $enrollment->id,
            'student_id' => $enrollment->student_id,
            'pending_months' => $months,
            'before_months' => $before,
            'after_months' => $after,
        ];

        if ($isBulk) {
            $payload['bulk'] = true;
        }

        AuditLog::record(
            AuditLog::ACTION_FEE_PENDING_MONTHS_CORRECTED,
            $enrollment,
            $payload
        );

        return [
            'target' => $this->enrollmentPayload($enrollment->refresh()),
            'reference' => $this->referencePayload($enrollment),
            'before' => $before,
            'after' => $after,
            'pending_months' => $months,
            'reference_unchanged' => $siblingBefore === $siblingAfter,
        ];
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

        // NOTE: the previous "locked after fee collection" guard is intentionally
        // removed. Admins may now correct Kirtan pending months even when a
        // student has a paid history; capMonths() clamps the value in
        // preview()/applyOne() so the trailing window never re-manages months
        // that are already paid. (Gurmukhi is still never a valid target.)
        if (!$hasGurmukhiSibling) {
            return 'Student must have an active Gurmukhi reference enrollment.';
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

    /**
     * Clamp a requested pending-months count so it can never reach into months
     * that are already paid. When a Kirtan enrollment has a paid history, the
     * trailing "pending" window may only cover months strictly AFTER the last
     * paid month — otherwise we'd be re-managing settled months (paid fees are
     * never deleted by the generator, but claiming pending status for
     * already-paid or pre-payment months is ambiguous). With no paid history the
     * requested value is returned unchanged.
     */
    private function capMonths(StudentSection $enrollment, int $months): int
    {
        if ($months <= 0) {
            return $months;
        }

        $lastPaidMonth = Fee::where('student_section_id', $enrollment->id)
            ->where('type', 'monthly')
            ->whereNotNull('month')
            ->whereHas('payments', fn ($q) => $q->whereNull('deleted_at'))
            ->max('month');

        if ($lastPaidMonth === null) {
            return $months;
        }

        $lastPaid = Carbon::parse($lastPaidMonth . '-01', config('app.timezone'))
            ->startOfMonth();
        $now = Carbon::now(config('app.timezone'))->startOfMonth();
        // diffInMonths(other) is negative when $other lies in the past, so measure
        // elapsed months from the last paid month toward now and clamp at 0.
        $monthsSinceLastPaid = max(0, $lastPaid->diffInMonths($now));

        return min($months, $monthsSinceLastPaid);
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
