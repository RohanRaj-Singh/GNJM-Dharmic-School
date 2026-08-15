{{--
    Student Report Center — V1 PDF layout.

    Receives the JSON from $report->toArray() (the same shape Inertia
    receives). Renders, in order:
      1. Cover / school header
      2. Range strip
      3. Student Snapshot (identity block)
      4. One section per division (Gurmukhi + Kirtan + any third+ class)
      5. Footer

    The per-division block is the partial at
    reports.partials.student_center_division — data-driven, so adding a
    Music class needs no template change.
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
    $isFree = ($identity['student_type'] ?? '') === 'free';
@endphp

{{-- ============== DIVISION SECTIONS (data-driven) ============== --}}
{{-- Renders one section per division the StudentReportService returns. A
     third+ class (Music, Tabla, …) gets its own section with the same
     layout — title comes from the service-supplied division_label. The
     partial gates Kirtan-only features (lesson-marker, kirtan-score) on
     the division key. --}}
@foreach($divisions ?? [] as $divisionKey => $division)
    @include('reports.partials.student_center_division', [
        'division' => $division,
        'range'    => $range ?? [],
        'isFree'   => $isFree,
    ])
@endforeach

<div class="footer">
    Generated on {{ now()->format('d M Y, h:i A') }} · Guru Nanak Ji Mission Dharmic School · Student Report Center
</div>

</body>
</html>
