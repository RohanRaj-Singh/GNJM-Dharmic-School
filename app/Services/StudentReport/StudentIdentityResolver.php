<?php

namespace App\Services\StudentReport;

use App\Models\Student;
use App\Support\StudentReport\EnrollmentInfo;
use App\Support\StudentReport\Enums\StudentStatus;
use App\Support\StudentReport\Enums\StudentType;
use App\Support\StudentReport\StudentIdentity;
use Illuminate\Support\Facades\DB;

/**
 * Loads the Student Snapshot data: the student row, current enrollments
 * (with class & section), and aggregate stats (last attendance, last
 * payment, outstanding amount and months).
 *
 * V1 only considers current enrollments (transferred_at IS NULL).
 * V2 will expose historical transitions here.
 */
final class StudentIdentityResolver
{
    public function resolve(int $studentId): StudentIdentity
    {
        $student = Student::query()->findOrFail($studentId);

        // Load ALL enrollments (not just current) so that the report
        // captures fees and attendance from every section the student
        // has ever been in. The identity header displays all of them;
        // the service uses them to collect class_ids per division.
        $enrollments = DB::table('student_sections as ss')
            ->join('classes as c', 'c.id', '=', 'ss.class_id')
            ->join('sections as sec', 'sec.id', '=', 'ss.section_id')
            ->where('ss.student_id', $studentId)
            ->orderBy('c.name')
            ->orderBy('sec.name')
            ->get([
                'ss.id as student_section_id',
                'c.id as class_id',
                'c.name as class_name',
                'c.type as class_type',
                'c.division as class_division',
                'sec.id as section_id',
                'sec.name as section_name',
                'ss.student_type',
            ])
            ->map(fn ($row) => new EnrollmentInfo(
                studentSectionId: (int) $row->student_section_id,
                classId: (int) $row->class_id,
                className: (string) $row->class_name,
                sectionName: (string) $row->section_name,
                division: \App\Support\StudentReport\NormalizeDivision::fromClass(
                    (string) ($row->class_type ?? ''),
                    (string) ($row->class_name ?? ''),
                    $row->class_division ?? null, // explicit division seam (Stage A2)
                ),
            ))
            ->values()
            ->all();

        // Determine "primary" student type. If the student has any paid
        // enrollment, they are 'paid'; only if ALL enrollments are free
        // do we mark 'free'.
        $hasPaid = false;
        $hasFree = false;
        foreach ($enrollments as $e) {
            $type = DB::table('student_sections')
                ->where('id', $e->studentSectionId)
                ->value('student_type');
            $t = StudentType::fromString($type);
            if ($t === StudentType::Paid) $hasPaid = true;
            if ($t === StudentType::Free) $hasFree = true;
        }
        $studentType = $hasPaid ? StudentType::Paid : StudentType::Free;

        $enrollmentDate = null;
        if (!empty($student->enrollment_date)) {
            $enrollmentDate = substr((string) $student->enrollment_date, 0, 10);
        }

        // Last attendance date (across ALL enrollments �� uses student_id).
        $lastAttendance = DB::table('attendance')
            ->where('student_id', $studentId)
            ->orderByDesc('date')
            ->value('date');
        $lastAttendanceDate = $lastAttendance ? substr((string) $lastAttendance, 0, 10) : null;

        // Last payment date (non-deleted, across ALL enrollments — uses student_id on fees).
        $lastPayment = DB::table('payments as p')
            ->join('fees as f', 'f.id', '=', 'p.fee_id')
            ->where('f.student_id', $studentId)
            ->whereNull('p.deleted_at')
            ->orderByDesc('p.paid_at')
            ->value('p.paid_at');
        $lastPaymentDate = $lastPayment ? substr((string) $lastPayment, 0, 10) : null;

        // Outstanding amount and months (uses student_id on fees).
        $outstandingRow = DB::table('fees')
            ->leftJoin('payments as p', function ($join) {
                $join->on('p.fee_id', '=', 'fees.id')->whereNull('p.deleted_at');
            })
            ->where('fees.student_id', $studentId)
            ->where('fees.type', 'monthly')
            ->whereNull('p.id')
            ->selectRaw('
                COALESCE(SUM(fees.amount), 0) as total_amount,
                COUNT(fees.id) as total_count
            ')
            ->first();

        $outstandingAmount = (int) ($outstandingRow->total_amount ?? 0);
        $outstandingMonths = (int) ($outstandingRow->total_count ?? 0);

        return new StudentIdentity(
            id: (int) $student->id,
            name: (string) $student->name,
            fatherName: $student->father_name,
            fatherPhone: $student->father_phone,
            motherPhone: $student->mother_phone,
            status: StudentStatus::fromString($student->status),
            studentType: $studentType,
            enrollments: $enrollments,
            enrollmentDate: $enrollmentDate,
            lastAttendanceDate: $lastAttendanceDate,
            lastPaymentDate: $lastPaymentDate,
            outstandingAmount: $outstandingAmount,
            outstandingMonths: $outstandingMonths,
        );
    }
}
