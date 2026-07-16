<?php

namespace App\Services;

use App\Models\Student;
use App\Models\StudentSection;

/**
 * Validates student lifecycle transitions.
 *
 * Each method checks the current state of the student and their enrollments
 * to determine whether the requested transition is allowed.
 */
class StudentLifecycleValidator
{
    /**
     * Check if a student can be promoted to the next class.
     */
    public function canPromote(Student $student): ValidationResult
    {
        $warnings = [];

        // Terminal states cannot be changed
        if ($student->status === Student::STATUS_PASSED_OUT) {
            return ValidationResult::denied('Student has already passed out. Cannot promote.');
        }
        if ($student->status === Student::STATUS_LEFT) {
            return ValidationResult::denied('Student has left the school. Cannot promote.');
        }

        // Must be active
        if ($student->status !== Student::STATUS_ACTIVE) {
            return ValidationResult::denied('Student must have status "active" to be promoted.');
        }

        // Must have at least one active enrollment
        $hasActiveEnrollment = StudentSection::where('student_id', $student->id)
            ->where('status', StudentSection::STATUS_ACTIVE)
            ->whereNull('transferred_at')
            ->exists();

        if (!$hasActiveEnrollment) {
            return ValidationResult::denied('Student has no active enrollment to promote from.');
        }

        return ValidationResult::allowed($warnings);
    }

    /**
     * Check if a student can pass out (complete studies).
     */
    public function canPassOut(Student $student): ValidationResult
    {
        $warnings = [];

        if ($student->status === Student::STATUS_PASSED_OUT) {
            return ValidationResult::denied('Student has already passed out.');
        }
        if ($student->status === Student::STATUS_LEFT) {
            return ValidationResult::denied('Student has left the school. Cannot pass out.');
        }

        if ($student->status !== Student::STATUS_ACTIVE) {
            return ValidationResult::denied('Student must have status "active" to pass out.');
        }

        $hasActiveEnrollment = StudentSection::where('student_id', $student->id)
            ->where('status', StudentSection::STATUS_ACTIVE)
            ->whereNull('transferred_at')
            ->exists();

        if (!$hasActiveEnrollment) {
            return ValidationResult::denied('Student has no active enrollment to pass out from.');
        }

        return ValidationResult::allowed($warnings);
    }

    /**
     * Check if a student can leave school permanently.
     * Only allowed from inactive status (safety gate).
     */
    public function canLeaveSchool(Student $student): ValidationResult
    {
        $warnings = [];

        if ($student->status === Student::STATUS_PASSED_OUT) {
            return ValidationResult::denied('Student has already passed out. Cannot leave.');
        }
        if ($student->status === Student::STATUS_LEFT) {
            return ValidationResult::denied('Student has already left the school.');
        }

        if ($student->status !== Student::STATUS_INACTIVE) {
            return ValidationResult::denied(
                'Student must be "inactive" before leaving the school. '
                . 'Make the student inactive first, then mark as left.'
            );
        }

        return ValidationResult::allowed($warnings);
    }

    /**
     * Check if a student can be made inactive (temporary break).
     */
    public function canMakeInactive(Student $student): ValidationResult
    {
        $warnings = [];

        if ($student->status === Student::STATUS_PASSED_OUT) {
            return ValidationResult::denied('Student has already passed out. Cannot make inactive.');
        }
        if ($student->status === Student::STATUS_LEFT) {
            return ValidationResult::denied('Student has left the school. Cannot make inactive.');
        }

        if ($student->status !== Student::STATUS_ACTIVE) {
            return ValidationResult::denied('Student must have status "active" to be made inactive.');
        }

        $hasActiveEnrollment = StudentSection::where('student_id', $student->id)
            ->where('status', StudentSection::STATUS_ACTIVE)
            ->whereNull('transferred_at')
            ->exists();

        if (!$hasActiveEnrollment) {
            return ValidationResult::denied('Student has no active enrollment to set inactive.');
        }

        return ValidationResult::allowed($warnings);
    }

    /**
     * Check if a student can be reactivated (return from temporary break).
     */
    public function canReactivate(Student $student): ValidationResult
    {
        $warnings = [];

        if ($student->status === Student::STATUS_PASSED_OUT) {
            return ValidationResult::denied('Student has passed out. Cannot reactivate.');
        }
        if ($student->status === Student::STATUS_LEFT) {
            return ValidationResult::denied('Student has left the school. Cannot reactivate.');
        }

        if ($student->status !== Student::STATUS_INACTIVE) {
            return ValidationResult::denied('Student must have status "inactive" to be reactivated.');
        }

        $hasInactiveEnrollment = StudentSection::where('student_id', $student->id)
            ->where('status', StudentSection::STATUS_INACTIVE)
            ->exists();

        if (!$hasInactiveEnrollment) {
            return ValidationResult::denied('Student has no inactive enrollment to reactivate.');
        }

        return ValidationResult::allowed($warnings);
    }
}
