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

        $enrollments = DB::table('student_sections as ss')
            ->join('classes as c', 'c.id', '=', 'ss.class_id')
            ->join('sections as sec', 'sec.id', '=', 'ss.section_id')
            ->where('ss.student_id', $studentId)
            ->whereNull('ss.transferred_at')
            ->orderBy('c.name')
            ->orderBy('sec.name')
            ->get([
                'ss.id as student_section_id',
                'c.id as class_id',
                'c.name as class_name',
                'c.type as class_type',
                'sec.id as section_id',
                'sec.name as section_name',
                'ss.student_type',
            ])
            ->map(fn ($row) => new EnrollmentInfo(
                studentSectionId: (int) $row->student_section_id,
                className: (string) $row->class_name,
                sectionName: (string) $row->section_name,
                division: \App\Support\StudentReport\NormalizeDivision::fromClass(
                    (string) ($row->class_type ?? ''),
                    (string) ($row->class_name ?? ''),
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

        // Last attendance date.
        $lastAttendance = DB::table('attendance as a')
            ->join('student_sections as ss', 'ss.id', '=', 'a.student_section_id')
            ->where('ss.student_id', $studentId)
            ->whereNull('ss.transferred_at')
            ->orderByDesc('a.date')
            ->value('a.date');
        $lastAttendanceDate = $lastAttendance ? substr((string) $lastAttendance, 0, 10) : null;

        // Last payment date (non-deleted).
        $lastPayment = DB::table('payments as p')
            ->join('fees as f', 'f.id', '=', 'p.fee_id')
            ->join('student_sections as ss', 'ss.id', '=', 'f.student_section_id')
            ->where('ss.student_id', $studentId)
            ->whereNull('ss.transferred_at')
            ->whereNull('p.deleted_at')
            ->orderByDesc('p.paid_at')
            ->value('p.paid_at');
        $lastPaymentDate = $lastPayment ? substr((string) $lastPayment, 0, 10) : null;

        // Outstanding amount and months (any monthly fee in the system with
        // no non-deleted payment, across the student's current enrollments).
        $outstandingRow = DB::table('fees as f')
            ->join('student_sections as ss', 'ss.id', '=', 'f.student_section_id')
            ->leftJoin('payments as p', function ($join) {
                $join->on('p.fee_id', '=', 'f.id')->whereNull('p.deleted_at');
            })
            ->where('ss.student_id', $studentId)
            ->whereNull('ss.transferred_at')
            ->where('f.type', 'monthly')
            ->whereNull('p.id')
            ->selectRaw('
                COALESCE(SUM(f.amount), 0) as total_amount,
                COUNT(f.id) as total_count
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
