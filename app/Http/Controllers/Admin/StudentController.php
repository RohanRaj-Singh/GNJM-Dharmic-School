<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Fee;
use App\Models\Section;
use App\Models\Student;
use App\Models\StudentSection;
use App\Services\MonthlyFeeResolver;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class StudentController extends Controller
{
    /**
     * Bulk upsert students and their enrollments from the admin roster editor.
     *
     * Extracted verbatim from the former routes/admin.php closure (P2: routes
     * define paths, not logic). Behavior is unchanged; protected by
     * tests/Feature/StudentBulkStatusSyncTest.
     */
    public function bulkUpdate(Request $request)
    {
        DB::transaction(function () use ($request) {

            // Preload all sections into a memory map (class_id by section_id).
            // This replaces N individual Section::find() calls (one per enrollment)
            // with a single bulk query. In PHP-FPM the static cache is per-request,
            // so it never goes stale across requests.
            static $sectionMap = [];

            if (empty($sectionMap)) {
                $sectionMap = Section::pluck('class_id', 'id')->all();
            }

            $formatName = function (?string $value): ?string {
                if ($value === null) return null;
                $normalized = Str::of($value)->squish()->lower()->title()->toString();
                return $normalized === '' ? null : $normalized;
            };

            $today = now(config('app.timezone'))->format('Y-m');
            $resolver = app(MonthlyFeeResolver::class);

            foreach ($request->students as $row) {

                // ---- 1. Upsert student (name, father, phone, status) ----
                $student = empty($row['id'])
                    ? Student::create([
                        'name' => $formatName($row['name']) ?? $row['name'],
                        'father_name' => $formatName($row['father_name'] ?? null),
                        'father_phone' => $row['father_phone'] ?? null,
                        'mother_phone' => $row['mother_phone'] ?? null,
                        'status' => $row['status'] ?? 'active',
                    ])
                    : tap(Student::findOrFail($row['id']))->update([
                        'name' => $formatName($row['name']) ?? $row['name'],
                        'father_name' => $formatName($row['father_name'] ?? null),
                        'father_phone' => $row['father_phone'] ?? null,
                        'mother_phone' => $row['mother_phone'] ?? null,
                        'status' => $row['status'] ?? 'active',
                    ]);

                // ---- 2. Compute desired enrollments ----
                $incoming = collect($row['enrollments'] ?? [])
                    ->filter(fn($e) => !empty($e['section_id']))
                    ->unique('section_id')
                    ->keyBy('section_id');

                // ---- 3. Archive orphaned active enrollments (NOT delete — preserves fees + attendance) ----
                StudentSection::where('student_id', $student->id)
                    ->where('status', 'active')
                    ->whereNull('transferred_at')
                    ->whereNotIn('section_id', $incoming->keys())
                    ->update([
                        'status'         => StudentSection::STATUS_INACTIVE,
                        'transferred_at' => now(),
                    ]);

                // ---- 4. Upsert each incoming enrollment ----
                foreach ($incoming as $e) {
                    $sectionId = (int) $e['section_id'];
                    $classId   = $sectionMap[$sectionId] ?? null;
                    if (!$classId) continue;

                    $studentType = $e['student_type'] === 'free' ? 'free' : 'paid';
                    $enrollmentStatus = $e['status'] ?? 'active';

                    $enrollment = StudentSection::firstOrCreate(
                        [
                            'student_id' => $student->id,
                            'class_id'   => $classId,
                            'section_id' => $sectionId,
                        ],
                        ['student_type' => $studentType, 'status' => $enrollmentStatus]
                    );

                    if ($enrollment->status !== $enrollmentStatus) {
                        $enrollment->update(['status' => $enrollmentStatus]);
                    }

                    if ($enrollment->student_type !== $studentType) {
                        $enrollment->update(['student_type' => $studentType]);
                    }

                    // If this was an archived enrollment being re-activated, restore it
                    if ($enrollment->status === 'active' && $enrollment->transferred_at !== null) {
                        $enrollment->update(['transferred_at' => null, 'started_at' => now()]);
                    }

                    if ($enrollmentStatus !== 'active') continue;

                    if ($studentType === 'free') {
                        // Delete unpaid monthly fees for this student (may be on any enrollment)
                        DB::table('fees as f')
                            ->join('student_sections', 'f.student_section_id', '=', 'student_sections.id')
                            ->where('student_sections.student_id', $student->id)
                            ->where('f.type', 'monthly')
                            ->whereNotExists(function ($q) {
                                $q->selectRaw('1')
                                    ->from('payments')
                                    ->whereColumn('payments.fee_id', '=', 'f.id')
                                    ->whereNull('payments.deleted_at');
                            })
                            ->delete();
                        continue;
                    }

                    // ---- 5. Resolve and upsert monthly fee ----
                    $fee = $resolver->resolveForMonth($enrollment, $today);
                    if ($fee <= 0) continue;

                    // Key by (student_id, type, month) so changing section/class
                    // doesn't create a duplicate fee for the same month.
                    Fee::firstOrCreate(
                        [
                            'student_id' => $student->id,
                            'type' => 'monthly',
                            'month' => $today,
                        ],
                        [
                            'student_section_id' => $enrollment->id,
                            'source' => 'monthly',
                            'amount' => $fee,
                        ]
                    );
                }

                // ---- 6. Keep students.status in sync with enrollment reality (R3) ----
                // Archiving the last active enrollment above orphans the student:
                // they'd appear "active" everywhere while having no active
                // enrollment. Demote to inactive unless explicitly overridden.
                if ($student->status === Student::STATUS_ACTIVE && !$student->hasActiveEnrollment()) {
                    $student->update(['status' => Student::STATUS_INACTIVE]);
                }
            }
        });

        return back()->with('success', 'Students updated');
    }
}
