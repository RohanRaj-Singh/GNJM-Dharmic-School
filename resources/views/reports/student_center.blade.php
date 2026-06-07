{{--
    Student Report Center — V1 PDF layout.

    Receives the JSON from $report->toArray() (the same shape Inertia
    receives). Renders, in order:
      1. Cover / school header
      2. Range strip
      3. Student Snapshot (identity block)
      4. Gurmukhi division (attendance + fees + monthly breakdown + calendar)
      5. Kirtan division (attendance + fees + Kirtan performance + calendar)
      6. Footer

    Each major section starts on a new page. Calendar partials are
    paginated by 3 months per row inside the section.
--}}
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Student Report — {{ $identity['name'] ?? '' }}</title>
    <style>
        @page { margin: 15mm; }
        body { font-family: DejaVu Sans, sans-serif; font-size: 10px; color: #000; }
        h1 { font-size: 16px; margin: 0; }
        h2 { font-size: 13px; margin: 14px 0 6px; }
        h3 { font-size: 11px; margin: 12px 0 4px; color: #444; }
        h4 { font-size: 10px; margin: 8px 0 3px; color: #555; text-transform: uppercase; letter-spacing: 0.05em; }
        p  { margin: 2px 0; }

        .school-info p { margin: 1px 0; font-size: 9px; }

        .page-break { page-break-before: always; }
        .no-break   { page-break-inside: avoid; }

        .header-table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
        .header-table td { border: none; vertical-align: top; }
        .logo-cell { text-align: right; width: 30%; }
        .logo { width: 90px; }

        .meta-strip { background: #eef4ff; border: 1px solid #b8c8e8; padding: 6px 10px; margin-bottom: 8px; }
        .meta-strip .label { color: #4a6da7; font-size: 9px; text-transform: uppercase; }

        .identity-table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
        .identity-table td { border: 1px solid #ddd; padding: 5px 7px; font-size: 10px; }
        .identity-table .lbl { background: #f5f5f5; font-weight: bold; width: 22%; }

        .stat-table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
        .stat-table td { border: 1px solid #ddd; padding: 6px; text-align: center; }
        .stat-table .lbl { background: #f5f5f5; font-size: 9px; text-transform: uppercase; }
        .stat-table .val { font-size: 13px; font-weight: bold; }

        .data-table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
        .data-table th, .data-table td { border: 1px solid #ccc; padding: 4px 6px; font-size: 9px; }
        .data-table th { background: #f0f0f0; font-weight: bold; text-align: left; }
        .data-table .amount { text-align: right; white-space: nowrap; }
        .data-table .center { text-align: center; }
        .data-table .paid { color: #0a7a28; font-weight: bold; }
        .data-table .unpaid { color: #b30000; font-weight: bold; }

        .empty-state { color: #888; font-size: 10px; font-style: italic; padding: 8px; }

        .footer { margin-top: 16px; font-size: 8px; text-align: center; color: #888; border-top: 1px solid #ddd; padding-top: 6px; }
    </style>
</head>
<body>

{{-- ============== HEADER ============== --}}
<table class="header-table no-break">
    <tr>
        <td class="school-info">
            <h1>Guru Nanak Ji Mission Dharmic School</h1>
            <p>Nankana Sahib</p>
            <p><strong>Giani Balwant Singh</strong> — Ph: 0306-9276199<br>
               <strong>Veer Ji Amardeep Singh</strong> — Ph: 0302-2061313</p>
            <h2>Student Report</h2>
        </td>
        <td class="logo-cell">
            <img src="{{ public_path('../resources/images/logo.png') }}" class="logo">
        </td>
    </tr>
</table>

{{-- ============== META STRIP ============== --}}
<div class="meta-strip no-break">
    <div class="label">Range</div>
    <div><strong>{{ $meta['range_label'] ?? '' }}</strong>
        · {{ $range['total_months'] ?? 0 }} month(s)
        · Generated {{ $meta['generated_at'] ?? '' }}
    </div>
</div>

{{-- ============== STUDENT SNAPSHOT ============== --}}
<h3 class="no-break">Student Snapshot</h3>
<table class="identity-table no-break">
    <tr>
        <td class="lbl">Name</td>
        <td>{{ $identity['name'] ?? '' }}</td>
        <td class="lbl">Student ID</td>
        <td>{{ $identity['id'] ?? '' }}</td>
    </tr>
    <tr>
        <td class="lbl">Father</td>
        <td>
            {{ $identity['father_name'] ?? '—' }}
            @if(!empty($identity['father_phone'])) ({{ $identity['father_phone'] }}) @endif
        </td>
        <td class="lbl">Status</td>
        <td>{{ $identity['status_label'] ?? '—' }}</td>
    </tr>
    <tr>
        <td class="lbl">Student Type</td>
        <td>{{ $identity['student_type_label'] ?? '—' }}</td>
        <td class="lbl">Division</td>
        <td>{{ $identity['division_label'] ?? '—' }}</td>
    </tr>
    <tr>
        <td class="lbl">Current Class</td>
        <td colspan="3">
            @if(empty($identity['enrollments']))
                Not enrolled
            @else
                @foreach($identity['enrollments'] as $e)
                    {{ $e['class_name'] }} - {{ $e['section_name'] }}@if(!$loop->last), @endif
                @endforeach
            @endif
        </td>
    </tr>
    <tr>
        <td class="lbl">Enrolled Since</td>
        <td>{{ $identity['enrollment_date'] ?? '—' }}</td>
        <td class="lbl">Last Attendance</td>
        <td>{{ $identity['last_attendance_date'] ?? '—' }}</td>
    </tr>
    <tr>
        <td class="lbl">Last Payment</td>
        <td>{{ $identity['last_payment_date'] ?? '—' }}</td>
        <td class="lbl">Outstanding</td>
        <td>
            Rs. {{ number_format($identity['outstanding_amount'] ?? 0) }}
            ({{ $identity['outstanding_months'] ?? 0 }} month(s))
        </td>
    </tr>
</table>

@php
    $gurmukhi = $divisions['gurmukhi'] ?? null;
    $kirtan   = $divisions['kirtan']   ?? null;
    $isFree   = ($identity['student_type'] ?? '') === 'free';
@endphp

{{-- ============== GURMUKHI ============== --}}
@if($gurmukhi)
<h2>Gurmukhi (Academic)</h2>

@if(!$gurmukhi['enrolled'])
    <p class="empty-state">Student is not enrolled in Gurmukhi. No attendance or fees to show.</p>
@else
    <h3>Attendance</h3>
    <table class="stat-table no-break">
        <tr>
            <td><div class="lbl">Present</div><div class="val">{{ $gurmukhi['attendance']['present'] }}</div></td>
            <td><div class="lbl">Absent</div><div class="val">{{ $gurmukhi['attendance']['absent'] }}</div></td>
            <td><div class="lbl">Leave</div><div class="val">{{ $gurmukhi['attendance']['leave'] }}</div></td>
            <td><div class="lbl">Marked</div><div class="val">{{ $gurmukhi['attendance']['marked_days'] }}</div></td>
            <td><div class="lbl">Attendance %</div><div class="val">{{ number_format($gurmukhi['attendance']['percentage'], 2) }}%</div></td>
        </tr>
    </table>

    @if(!empty($gurmukhi['attendance']['current_streak_length']))
        <p>Current streak: <strong>{{ $gurmukhi['attendance']['current_streak_length'] }}</strong> day(s) of <strong>{{ $gurmukhi['attendance']['current_streak_status'] }}</strong></p>
    @endif

    <h3>Fees</h3>
    <table class="stat-table no-break">
        <tr>
            <td><div class="lbl">Total Charged</div><div class="val">Rs. {{ number_format($gurmukhi['fees']['total_charged']) }}</div></td>
            <td><div class="lbl">Total Paid</div><div class="val">Rs. {{ number_format($gurmukhi['fees']['total_paid']) }}</div></td>
            <td><div class="lbl">Pending</div><div class="val">Rs. {{ number_format($gurmukhi['fees']['pending']) }}</div></td>
            <td><div class="lbl">Outstanding Months</div><div class="val">{{ $gurmukhi['fees']['outstanding_months'] }}</div></td>
        </tr>
    </table>
    @if(!empty($gurmukhi['fees']['last_payment_date']))
        <p>Last payment: <strong>{{ $gurmukhi['fees']['last_payment_date'] }}</strong></p>
    @endif

    @if($isFree)
        <p><em>This student is exempt from monthly fees. Only custom fees are listed below (if any).</em></p>
    @endif

    @if(!empty($gurmukhi['fees']['monthly_breakdown']))
        <h4>Monthly Breakdown</h4>
        <table class="data-table">
            <thead>
                <tr>
                    <th>Month</th>
                    <th class="amount">Charged</th>
                    <th class="amount">Paid</th>
                    <th class="amount">Pending</th>
                    <th class="center">Status</th>
                </tr>
            </thead>
            <tbody>
                @foreach($gurmukhi['fees']['monthly_breakdown'] as $m)
                    <tr>
                        <td>{{ $m['month'] }}</td>
                        <td class="amount">Rs. {{ number_format($m['charged']) }}</td>
                        <td class="amount">Rs. {{ number_format($m['paid']) }}</td>
                        <td class="amount {{ $m['pending'] > 0 ? 'unpaid' : '' }}">Rs. {{ number_format($m['pending']) }}</td>
                        <td class="center {{ $m['is_paid'] ? 'paid' : 'unpaid' }}">{{ $m['is_paid'] ? 'PAID' : 'DUE' }}</td>
                    </tr>
                @endforeach
            </tbody>
        </table>
    @endif

    @if(empty($gurmukhi['fees']['rows']))
        <p class="empty-state">No fee records in this range.</p>
    @endif

    <h3>Calendar</h3>
    @include('reports.partials.student_center_calendar', [
        'months'     => $gurmukhi['months'] ?? [],
        'year'       => (int) ($range['start_label'] ? substr($range['start_label'], 0, 4) : date('Y')),
        'showLesson' => false,
    ])
@endif
@endif

{{-- ============== KIRTAN ============== --}}
@if($kirtan)
<h2>Kirtan (Spiritual)</h2>

@if(!$kirtan['enrolled'])
    <p class="empty-state">Student is not enrolled in Kirtan. No attendance or fees to show.</p>
@else
    <h3>Attendance</h3>
    <table class="stat-table no-break">
        <tr>
            <td><div class="lbl">Present</div><div class="val">{{ $kirtan['attendance']['present'] }}</div></td>
            <td><div class="lbl">Absent</div><div class="val">{{ $kirtan['attendance']['absent'] }}</div></td>
            <td><div class="lbl">Leave</div><div class="val">{{ $kirtan['attendance']['leave'] }}</div></td>
            <td><div class="lbl">Marked</div><div class="val">{{ $kirtan['attendance']['marked_days'] }}</div></td>
            <td><div class="lbl">Attendance %</div><div class="val">{{ number_format($kirtan['attendance']['percentage'], 2) }}%</div></td>
        </tr>
    </table>

    @if(!empty($kirtan['attendance']['current_streak_length']))
        <p>Current streak: <strong>{{ $kirtan['attendance']['current_streak_length'] }}</strong> day(s) of <strong>{{ $kirtan['attendance']['current_streak_status'] }}</strong></p>
    @endif

    <h3>Fees</h3>
    <table class="stat-table no-break">
        <tr>
            <td><div class="lbl">Total Charged</div><div class="val">Rs. {{ number_format($kirtan['fees']['total_charged']) }}</div></td>
            <td><div class="lbl">Total Paid</div><div class="val">Rs. {{ number_format($kirtan['fees']['total_paid']) }}</div></td>
            <td><div class="lbl">Pending</div><div class="val">Rs. {{ number_format($kirtan['fees']['pending']) }}</div></td>
            <td><div class="lbl">Outstanding Months</div><div class="val">{{ $kirtan['fees']['outstanding_months'] }}</div></td>
        </tr>
    </table>
    @if(!empty($kirtan['fees']['last_payment_date']))
        <p>Last payment: <strong>{{ $kirtan['fees']['last_payment_date'] }}</strong></p>
    @endif

    @if(!empty($kirtan['kirtan_score']))
        <h3>Kirtan Performance</h3>
        @if(($kirtan['kirtan_score']['data_status'] ?? '') === 'no_data')
            <p class="empty-state">No attendance recorded in the selected range — score is not available.</p>
        @else
            <table class="stat-table no-break">
                <tr>
                    <td><div class="lbl">Score</div><div class="val">{{ number_format($kirtan['kirtan_score']['score'], 1) }}%</div></td>
                    <td><div class="lbl">Rating</div><div class="val">{{ $kirtan['kirtan_score']['rating'] }}</div></td>
                    <td><div class="lbl">Total Classes</div><div class="val">{{ $kirtan['kirtan_score']['total_classes'] }}</div></td>
                    <td><div class="lbl">Lessons Learned</div><div class="val">{{ $kirtan['kirtan_score']['lessons_learned'] }}</div></td>
                </tr>
            </table>
            <p>Attendance component: <strong>{{ number_format($kirtan['kirtan_score']['components']['attendance'], 2) }}%</strong> × 0.6
               · Lesson component: <strong>{{ number_format($kirtan['kirtan_score']['components']['lesson'], 2) }}%</strong> × 0.4</p>
        @endif
    @endif

    @if(!empty($kirtan['fees']['monthly_breakdown']))
        <h4>Monthly Breakdown</h4>
        <table class="data-table">
            <thead>
                <tr>
                    <th>Month</th>
                    <th class="amount">Charged</th>
                    <th class="amount">Paid</th>
                    <th class="amount">Pending</th>
                    <th class="center">Status</th>
                </tr>
            </thead>
            <tbody>
                @foreach($kirtan['fees']['monthly_breakdown'] as $m)
                    <tr>
                        <td>{{ $m['month'] }}</td>
                        <td class="amount">Rs. {{ number_format($m['charged']) }}</td>
                        <td class="amount">Rs. {{ number_format($m['paid']) }}</td>
                        <td class="amount {{ $m['pending'] > 0 ? 'unpaid' : '' }}">Rs. {{ number_format($m['pending']) }}</td>
                        <td class="center {{ $m['is_paid'] ? 'paid' : 'unpaid' }}">{{ $m['is_paid'] ? 'PAID' : 'DUE' }}</td>
                    </tr>
                @endforeach
            </tbody>
        </table>
    @endif

    @if(empty($kirtan['fees']['rows']))
        <p class="empty-state">No fee records in this range.</p>
    @endif

    <h3>Calendar</h3>
    @include('reports.partials.student_center_calendar', [
        'months'     => $kirtan['months'] ?? [],
        'year'       => (int) ($range['start_label'] ? substr($range['start_label'], 0, 4) : date('Y')),
        'showLesson' => true,
    ])
@endif
@endif

<div class="footer">
    Generated on {{ now()->format('d M Y, h:i A') }} · Guru Nanak Ji Mission Dharmic School · Student Report Center
</div>

</body>
</html>
