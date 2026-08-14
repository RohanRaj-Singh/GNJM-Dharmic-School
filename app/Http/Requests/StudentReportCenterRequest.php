<?php

namespace App\Http\Requests;

use App\Support\StudentReport\StudentReportRequest as FilterRequest;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Validates the Student Performance Report filter input and produces
 * a StudentReportRequest value object for the engine.
 */
class StudentReportCenterRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // role middleware handles authorization
    }

    public function rules(): array
    {
        $base = [
            'student_id' => ['required', 'integer', 'exists:students,id'],
            'range_mode' => ['required', Rule::in([
                FilterRequest::RANGE_ACADEMIC_SESSION,
                FilterRequest::RANGE_CALENDAR_YEAR,
                FilterRequest::RANGE_MONTH,
                FilterRequest::RANGE_RANGE,
            ])],
            // Division is an open string (Stage B): a third+ class's
            // division key is representable. Engine validates non-empty.
            'division' => ['required', 'string', 'min:1'],
        ];

        $mode = $this->input('range_mode');

        return match ($mode) {
            FilterRequest::RANGE_ACADEMIC_SESSION, FilterRequest::RANGE_CALENDAR_YEAR => array_merge($base, [
                'single_year' => ['required', 'integer', 'min:2000', 'max:2100'],
            ]),
            FilterRequest::RANGE_MONTH => array_merge($base, [
                'single_month' => ['required', 'date_format:Y-m'],
            ]),
            FilterRequest::RANGE_RANGE => array_merge($base, [
                'range_start' => ['required', 'date_format:Y-m'],
                'range_end'   => ['required', 'date_format:Y-m', 'after_or_equal:range_start'],
            ]),
            default => $base,
        };
    }

    public function messages(): array
    {
        return [
            'student_id.exists' => 'Selected student does not exist.',
            'range_end.after_or_equal' => 'Range end must be on or after range start.',
        ];
    }

    public function toFilterRequest(): FilterRequest
    {
        return FilterRequest::fromArray($this->validated());
    }
}
