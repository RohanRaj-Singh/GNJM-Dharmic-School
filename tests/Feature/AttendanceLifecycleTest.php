<?php

namespace Tests\Feature;

use App\Models\Attendance;
use App\Models\Section;
use App\Models\Student;
use App\Models\StudentSection;
use App\Models\SchoolClass;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class AttendanceLifecycleTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;
    private User $teacher;
    private SchoolClass $class;
    private Section $section;
    private SchoolClass $targetClass;
    private Section $targetSection;

    protected function setUp(): void
    {
        parent::setUp();

        // ── Admin user ──
        $this->admin = User::factory()->create([
            'role'     => 'admin',
            'username' => 'admin_test',
        ]);

        // ── Teacher user ──
        $this->teacher = User::factory()->create([
            'role'     => 'teacher',
            'username' => 'teacher_test',
        ]);

        // ── Source class + section ──
        $this->class = SchoolClass::create([
            'name'               => 'Gurmukhi',
            'type'               => 'gurmukhi',
            'default_monthly_fee' => 600,
        ]);
        $this->section = Section::create([
            'class_id'    => $this->class->id,
            'name'        => 'Section A',
            'monthly_fee' => 600,
        ]);

        // ── Target class + section ──
        $this->targetClass = SchoolClass::create([
            'name'               => 'Gurmukhi Advanced',
            'type'               => 'gurmukhi',
            'default_monthly_fee' => 800,
        ]);
        $this->targetSection = Section::create([
            'class_id'    => $this->targetClass->id,
            'name'        => 'Section B',
            'monthly_fee' => 800,
        ]);
    }

    // ═══════════════════════════════════════════════
    //  Helpers
    // ═══════════════════════════════════════════════

    private function createStudent(string $status = 'active'): Student
    {
        return Student::create([
            'name'       => 'Test Student',
            'father_name' => 'Test Father',
            'status'     => $status,
        ]);
    }

    private function createEnrollment(
        Student $student,
        ?SchoolClass $class = null,
        ?Section $section = null,
        string $studentType = 'paid',
        string $status = StudentSection::STATUS_ACTIVE,
    ): StudentSection {
        return StudentSection::create([
            'student_id'   => $student->id,
            'class_id'     => ($class ?? $this->class)->id,
            'section_id'   => ($section ?? $this->section)->id,
            'student_type' => $studentType,
            'status'       => $status,
            'started_at'   => now(),
        ]);
    }

    private function createAttendance(StudentSection $enrollment, string $date, string $status = 'present'): Attendance
    {
        return Attendance::create([
            'student_section_id' => $enrollment->id,
            'date'   => $date,
            'status' => $status,
        ]);
    }

    /**
     * Return the student IDs that would appear on the attendance-mark page
     * for a given section, using the identical query from routes/attendance.php.
     */
    private function getSectionStudentIds(Section $section): array
    {
        return StudentSection::where('section_id', $section->id)
            ->where('status', StudentSection::STATUS_ACTIVE)
            ->whereNull('transferred_at')
            ->pluck('student_id')
            ->toArray();
    }

    // ═══════════════════════════════════════════════
    //  Test 1: Promoted student not in old section
    // ═══════════════════════════════════════════════

    public function test_promoted_student_not_in_old_section_attendance(): void
    {
        $student = $this->createStudent();
        $enrollment = $this->createEnrollment($student);

        // Mark attendance for Section A (verify it saves)
        $att = $this->createAttendance($enrollment, now()->toDateString(), 'present');
        $this->assertDatabaseHas('attendance', [
            'id'                 => $att->id,
            'student_section_id' => $enrollment->id,
            'status'             => 'present',
        ]);

        // Promote the student
        $this->actingAs($this->admin)
            ->from('/students')
            ->post(route('students.lifecycle.promote', ['student' => $student->id]), [
                'section_id' => $this->targetSection->id,
            ]);

        // Query Section A's student list (the same query used in attendance.mark)
        $sectionAStudentIds = $this->getSectionStudentIds($this->section);
        $this->assertNotContains(
            $student->id,
            $sectionAStudentIds,
            'Promoted student should NOT appear in the old section student list'
        );

        // Query Section B's student list
        $sectionBStudentIds = $this->getSectionStudentIds($this->targetSection);
        $this->assertContains(
            $student->id,
            $sectionBStudentIds,
            'Promoted student SHOULD appear in the new section student list'
        );
    }

    // ═══════════════════════════════════════════════
    //  Test 2: Old attendance records preserved
    // ═══════════════════════════════════════════════

    public function test_promoted_student_old_attendance_records_preserved(): void
    {
        $student = $this->createStudent();
        $enrollment = $this->createEnrollment($student);

        // Multiple attendance records on old enrollment
        $att1 = $this->createAttendance($enrollment, '2026-07-01', 'present');
        $att2 = $this->createAttendance($enrollment, '2026-07-02', 'absent');
        $att3 = $this->createAttendance($enrollment, '2026-07-03', 'leave');

        $oldEnrollmentId = $enrollment->id;

        // Promote
        $this->actingAs($this->admin)
            ->from('/students')
            ->post(route('students.lifecycle.promote', ['student' => $student->id]), [
                'section_id' => $this->targetSection->id,
            ]);

        // Query attendance by OLD student_section_id
        $oldAttendance = Attendance::where('student_section_id', $oldEnrollmentId)->get();

        $this->assertCount(3, $oldAttendance, 'All old attendance records should still exist');

        $this->assertDatabaseHas('attendance', [
            'id'                 => $att1->id,
            'student_section_id' => $oldEnrollmentId,
            'status'             => 'present',
        ]);
        $this->assertDatabaseHas('attendance', [
            'id'                 => $att2->id,
            'student_section_id' => $oldEnrollmentId,
            'status'             => 'absent',
        ]);
        $this->assertDatabaseHas('attendance', [
            'id'                 => $att3->id,
            'student_section_id' => $oldEnrollmentId,
            'status'             => 'leave',
        ]);
    }

    // ═══════════════════════════════════════════════
    //  Test 3: Cannot mark attendance for promoted
    // ═══════════════════════════════════════════════

    public function test_cannot_mark_attendance_for_promoted_enrollment(): void
    {
        $student = $this->createStudent();
        $enrollment = $this->createEnrollment($student);

        // Promote the student
        $this->actingAs($this->admin)
            ->from('/students')
            ->post(route('students.lifecycle.promote', ['student' => $student->id]), [
                'section_id' => $this->targetSection->id,
            ]);

        // Attempt to save attendance using the OLD section + student
        // AttendanceController@store uses firstOrFail() looking for
        // student_sections where status = 'active' AND transferred_at IS NULL.
        // Since the enrollment is now 'promoted', firstOrFail() → 404.
        $response = $this->actingAs($this->teacher)
            ->from(route('attendance.sections'))
            ->post(route('attendance.store'), [
                'section_id' => $this->section->id,
                'attendance' => [
                    ['student_id' => $student->id, 'status' => 'present'],
                ],
            ]);

        $response->assertStatus(404);
    }

    // ═══════════════════════════════════════════════
    //  Test 4: Inactive excludes, reactivate restores
    // ═══════════════════════════════════════════════

    public function test_make_inactive_excludes_from_attendance(): void
    {
        $student = $this->createStudent();
        $enrollment = $this->createEnrollment($student);

        // Before: student is in section list
        $this->assertContains(
            $student->id,
            $this->getSectionStudentIds($this->section),
            'Student should be in section list when active'
        );

        // Make inactive → enrollment.status = 'inactive'
        $this->actingAs($this->admin)
            ->from('/students')
            ->post(route('students.lifecycle.make-inactive', ['student' => $student->id]));

        // Verify enrollment is now inactive (transferred_at stays null)
        $enrollment->refresh();
        $this->assertSame(StudentSection::STATUS_INACTIVE, $enrollment->status);
        $this->assertNull($enrollment->transferred_at);

        // After: student must NOT appear in section list
        $this->assertNotContains(
            $student->id,
            $this->getSectionStudentIds($this->section),
            'Inactive student should NOT appear in section list'
        );

        // Reactivate → enrollment.status = 'active'
        $this->actingAs($this->admin)
            ->from('/students')
            ->post(route('students.lifecycle.reactivate', ['student' => $student->id]));

        // Confirm reactivation
        $enrollment->refresh();
        $this->assertSame(StudentSection::STATUS_ACTIVE, $enrollment->status);

        // After reactivation: student IS back in section list
        $this->assertContains(
            $student->id,
            $this->getSectionStudentIds($this->section),
            'Reactivated student SHOULD appear in section list'
        );
    }

    // ═══════════════════════════════════════════════
    //  Test 5: Admin grid excludes promoted
    // ═══════════════════════════════════════════════

    public function test_admin_attendance_grid_does_not_show_promoted_students(): void
    {
        $student = $this->createStudent();
        $enrollment = $this->createEnrollment($student);

        // Promote the student
        $this->actingAs($this->admin)
            ->from('/students')
            ->post(route('students.lifecycle.promote', ['student' => $student->id]), [
                'section_id' => $this->targetSection->id,
            ]);

        // Use the same eager-load query as AdminAttendanceController@grid
        $section = Section::with([
            'schoolClass',
            'studentSections' => fn ($q) => $q->where('status', 'active')->whereNull('transferred_at'),
            'studentSections.student',
        ])->findOrFail($this->section->id);

        $enrollmentIdsInGrid = $section->studentSections->pluck('id');

        // The promoted enrollment (old one) should not appear in the grid
        $this->assertNotContains(
            $enrollment->id,
            $enrollmentIdsInGrid,
            'Promoted enrollment must NOT appear in admin attendance grid'
        );

        // The new active enrollment should appear in the target section's grid
        $targetSection = Section::with([
            'schoolClass',
            'studentSections' => fn ($q) => $q->where('status', 'active')->whereNull('transferred_at'),
        ])->findOrFail($this->targetSection->id);

        $newEnrollmentIds = $targetSection->studentSections->pluck('id');
        $this->assertCount(1, $newEnrollmentIds, 'Target section should have exactly one enrollment');
    }

    // ═══════════════════════════════════════════════
    //  Test 6: Absentees excludes promoted
    // ═══════════════════════════════════════════════

    public function test_absentees_page_does_not_include_promoted_students(): void
    {
        $student = $this->createStudent();
        $enrollment = $this->createEnrollment($student);

        // Create absent attendance records
        $this->createAttendance($enrollment, '2026-07-01', 'absent');
        $this->createAttendance($enrollment, '2026-07-02', 'absent');

        // Promote the student
        $this->actingAs($this->admin)
            ->from('/students')
            ->post(route('students.lifecycle.promote', ['student' => $student->id]), [
                'section_id' => $this->targetSection->id,
            ]);

        // Use the same query as the /attendance/absentees route
        $enrollments = StudentSection::with(['student'])
            ->where('status', 'active')
            ->whereNull('transferred_at')
            ->where('section_id', $this->section->id)
            ->get();

        $promotedEnrollment = $enrollments->firstWhere('student_id', $student->id);
        $this->assertNull(
            $promotedEnrollment,
            'Promoted student should NOT appear in absentees query'
        );
    }

    // ═══════════════════════════════════════════════
    //  Test 7: Report excludes promoted enrollment
    // ═══════════════════════════════════════════════

    public function test_attendance_report_excludes_promoted_enrollment_data(): void
    {
        $student = $this->createStudent();
        $enrollment = $this->createEnrollment($student);

        // Attendance records on the old enrollment
        $this->createAttendance($enrollment, '2026-07-01', 'present');
        $this->createAttendance($enrollment, '2026-07-02', 'absent');

        // Promote
        $this->actingAs($this->admin)
            ->from('/students')
            ->post(route('students.lifecycle.promote', ['student' => $student->id]), [
                'section_id' => $this->targetSection->id,
            ]);

        // Same query structure as ReportController::buildAttendanceReport
        $reportQuery = DB::table('attendance')
            ->join('student_sections', 'attendance.student_section_id', '=', 'student_sections.id')
            ->join('students', 'student_sections.student_id', '=', 'students.id')
            ->join('classes', 'student_sections.class_id', '=', 'classes.id')
            ->leftJoin('sections', 'student_sections.section_id', '=', 'sections.id')
            ->where('student_sections.status', 'active')
            ->whereNull('student_sections.transferred_at')
            ->where('student_sections.class_id', $this->class->id);

        $reportData = $reportQuery->get();

        $this->assertCount(
            0,
            $reportData,
            'Promoted enrollment attendance data must NOT appear in the attendance report'
        );
    }

    // ═══════════════════════════════════════════════
    //  Test 8: Report includes active enrollment
    // ═══════════════════════════════════════════════

    public function test_attendance_report_includes_active_enrollment_data(): void
    {
        $student = $this->createStudent();
        $enrollment = $this->createEnrollment($student);

        // Promote
        $this->actingAs($this->admin)
            ->from('/students')
            ->post(route('students.lifecycle.promote', ['student' => $student->id]), [
                'section_id' => $this->targetSection->id,
            ]);

        // Get the new active enrollment
        $newEnrollment = StudentSection::where('student_id', $student->id)
            ->where('status', StudentSection::STATUS_ACTIVE)
            ->whereNull('transferred_at')
            ->firstOrFail();

        // Mark attendance for the NEW enrollment
        $this->createAttendance($newEnrollment, '2026-07-05', 'present');
        $this->createAttendance($newEnrollment, '2026-07-06', 'present');

        // Report query filtering by the target class
        $reportData = DB::table('attendance')
            ->join('student_sections', 'attendance.student_section_id', '=', 'student_sections.id')
            ->join('students', 'student_sections.student_id', '=', 'students.id')
            ->join('classes', 'student_sections.class_id', '=', 'classes.id')
            ->leftJoin('sections', 'student_sections.section_id', '=', 'sections.id')
            ->where('student_sections.status', 'active')
            ->whereNull('student_sections.transferred_at')
            ->where('student_sections.class_id', $this->targetClass->id)
            ->select('attendance.*', 'student_sections.id as ss_id')
            ->get();

        $this->assertCount(
            2,
            $reportData,
            'New active enrollment attendance SHOULD appear in the attendance report'
        );

        // Both records should reference the new enrollment
        foreach ($reportData as $row) {
            $this->assertEquals(
                $newEnrollment->id,
                $row->ss_id,
                'Each report row should reference the new (active) student_section_id'
            );
        }
    }

    // ═══════════════════════════════════════════════
    //  Test 9: Multi-enrollment — one promoted,
    //          one still active
    // ═══════════════════════════════════════════════

    public function test_student_with_multiple_enrollments_one_promoted_one_active(): void
    {
        $student = $this->createStudent();

        // Second class/section (Kirtan)
        $kirtanClass = SchoolClass::create([
            'name'               => 'Kirtan',
            'type'               => 'kirtan',
            'default_monthly_fee' => 500,
        ]);
        $kirtanSection = Section::create([
            'class_id'    => $kirtanClass->id,
            'name'        => 'Kirtan Section',
            'monthly_fee' => 500,
        ]);

        // Two active enrollments
        $gurmukhiEnrollment = $this->createEnrollment($student, $this->class, $this->section);
        $kirtanEnrollment   = $this->createEnrollment($student, $kirtanClass, $kirtanSection);

        // Promote ONLY the Gurmukhi enrollment (manually, since the controller
        // promotes ALL active enrollments — this tests the data query path)
        $gurmukhiEnrollment->update([
            'status'         => StudentSection::STATUS_PROMOTED,
            'transferred_at' => now(),
            'outcome'        => 'promoted',
        ]);

        // ── Assert Kirtan enrollment remains active ──
        $kirtanEnrollment->refresh();
        $this->assertSame(
            StudentSection::STATUS_ACTIVE,
            $kirtanEnrollment->status,
            'Kirtan enrollment should still be active'
        );
        $this->assertNull(
            $kirtanEnrollment->transferred_at,
            'Kirtan enrollment transferred_at should remain null'
        );

        // ── Student appears in Kirtan section ──
        $kirtanStudents = $this->getSectionStudentIds($kirtanSection);
        $this->assertContains(
            $student->id,
            $kirtanStudents,
            'Student SHOULD appear in the Kirtan section attendance list'
        );

        // ── Student does NOT appear in Gurmukhi section ──
        $gurmukhiStudents = $this->getSectionStudentIds($this->section);
        $this->assertNotContains(
            $student->id,
            $gurmukhiStudents,
            'Student should NOT appear in the promoted Gurmukhi section attendance list'
        );
    }
}
