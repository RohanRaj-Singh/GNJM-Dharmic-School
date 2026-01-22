<?php

namespace App\Reports;

class ReportRegistry
{
    public static function all(): array
    {
        return [
            'fees' => self::fees(),
            // future:
            // 'attendance' => self::attendance(),
            // 'students' => self::students(),
        ];
    }

    public static function get(string $key): array
    {
        return self::all()[$key] ?? abort(404, 'Invalid report type');
    }

        protected static function fees(): array
    {
        return [

            /* ---------------------------------------
             | Metadata
             --------------------------------------- */
            'key'   => 'fees',
            'label' => 'Fees Report',

            /* ---------------------------------------
             | Base model
             --------------------------------------- */
            'model' => \App\Models\Fee::class,

            /* ---------------------------------------
             | Allowed filters (UI + API)
             --------------------------------------- */
            'filters' => [

                'year' => [
                    'type' => 'year',
                    'label' => 'Year',
                ],

                'class_ids' => [
                    'type' => 'multi-select',
                    'label' => 'Class',
                    'source' => 'classes',
                ],

                'section_ids' => [
                    'type' => 'multi-select',
                    'label' => 'Section',
                    'source' => 'sections',
                ],

                'student_ids' => [
                    'type' => 'multi-select',
                    'label' => 'Students',
                    'source' => 'students',
                ],

                'paid_status' => [
                    'type' => 'checkbox',
                    'label' => 'Payment Status',
                    'options' => [
                        'paid'   => 'Paid',
                        'unpaid' => 'Unpaid',
                    ],
                ],
            ],

            /* ---------------------------------------
             | Columns (checkbox-controlled)
             --------------------------------------- */
            'columns' => [

                'student_name' => [
                    'label' => 'Student',
                    'source' => 'students.name',
                ],

                'class_name' => [
                    'label' => 'Class',
                    'source' => 'classes.name',
                ],

                'section_name' => [
                    'label' => 'Section',
                    'source' => 'sections.name',
                ],

                'fee_title' => [
                    'label' => 'Fee',
                    'source' => 'fees.title',
                ],

                'fee_type' => [
                    'label' => 'Type',
                    'source' => 'fees.type',
                ],

                'month' => [
                    'label' => 'Month',
                    'source' => 'fees.month',
                ],

                'amount' => [
                    'label' => 'Amount',
                    'source' => 'fees.amount',
                    'format' => 'currency',
                ],

                'is_paid' => [
                    'label' => 'Paid',
                    'source' => 'payments.id',
                    'format' => 'boolean',
                ],

                'paid_at' => [
                    'label' => 'Paid Date',
                    'source' => 'payments.paid_at',
                    'format' => 'date',
                ],
            ],

            /* ---------------------------------------
             | Default visible columns
             --------------------------------------- */
            'default_columns' => [
                'student_name',
                'class_name',
                'section_name',
                'month',
                'amount',
                'is_paid',
            ],
        ];
    }
}


