<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Attendance Report</title>
    <style>
        body {
            font-family: DejaVu Sans, sans-serif;
            font-size: 11px;
            color: #000;
        }

        .school-info h2 {
            margin: 0;
            font-size: 16px;
        }

        .school-info p {
            margin: 2px 0;
            font-size: 11px;
        }

        .logo {
            width: 120px;
        }

        .header-table {
            width: 100%;
            border-collapse: collapse;
        }

        .logo-cell {
            text-align: right;
            vertical-align: top;
            margin: 12px 0;
            border: none;
            border-top: 1px solid #ccc;
        }

        .meta {
            margin-top: 10px;
            font-size: 11px;
        }

        .summary-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 15px;
        }

        .summary-table td {
            border: 1px solid #ddd;
            padding: 6px;
            font-size: 11px;
        }

        .summary-label {
            background: #f5f5f5;
            font-weight: bold;
            width: 25%;
        }

        h4 {
            margin: 16px 0 6px;
            font-size: 13px;
        }

        table.data-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 15px;
        }

        table.data-table th,
        table.data-table td {
            border: 1px solid #ccc;
            padding: 6px;
            vertical-align: top;
        }

        table.data-table th {
            background: #f0f0f0;
            font-size: 11px;
        }

        .student-name {
            font-weight: bold;
        }

        .father-name {
            font-size: 10px;
            color: #555;
        }

        .amount {
            text-align: right;
            white-space: nowrap;
        }

        .center {
            text-align: center;
        }

        .paid {
            color: #0a7a28;
            font-weight: bold;
        }

        .unpaid {
            color: #b30000;
            font-weight: bold;
        }

        .absentee-title {
            margin: 16px 0 6px;
            font-size: 13px;
            color: #b30000;
        }

        .footer {
            margin-top: 20px;
            font-size: 10px;
            text-align: right;
            color: #666;
        }
    </style>
</head>
<body>

{{-- ================= HEADER (same as fees report) ================= --}}
<table class="header-table">
    <tr>
        <td class="school-info">
            <h2>Guru Nanak Ji Mission Dharmic School</h2>
            <p>Nankana Sahib</p>

            <p>
                <strong>Giani Balwant Singh</strong> — Ph: 0306-9276-199<br>
                <strong>Veer Ji Amardeep Singh</strong> — Ph: 0302-2061313
            </p>

            <p><strong>Attendance Report</strong></p>
        </td>
        <td class="logo-cell">
            <img src="{{ public_path('../resources/images/logo.png') }}" class="logo">
        </td>
    </tr>
</table>

<hr>

<div class="meta">
    Generated at: {{ $meta['generated_at'] ?? now() }} ·
    {{ $summary['student_count'] ?? 0 }} student(s) ·
    {{ $summary['total_records'] ?? 0 }} record(s)
</div>

{{-- ================= SUMMARY ================= --}}
<table class="summary-table">
    <tr>
        <td class="summary-label">Students</td>
        <td>{{ $summary['student_count'] }}</td>
        <td class="summary-label">Present</td>
        <td>{{ $summary['present'] }}</td>
    </tr>
    <tr>
        <td class="summary-label">Absent</td>
        <td>{{ $summary['absent'] }}</td>
        <td class="summary-label">Leave</td>
        <td>{{ $summary['leave'] }}</td>
    </tr>
    <tr>
        <td class="summary-label">Total Records</td>
        <td>{{ $summary['total_records'] }}</td>
        <td class="summary-label">Attendance %</td>
        <td>{{ number_format($summary['attendance_percentage'], 1) }}%</td>
    </tr>
</table>

{{-- ================= PER-STUDENT TABLE ================= --}}
<h4>Student-wise Attendance Summary</h4>

<table class="data-table">
    <thead>
        <tr>
            <th>Student</th>
            <th>Class</th>
            <th>Section</th>
            <th class="amount">Present</th>
            <th class="amount">Absent</th>
            <th class="amount">Leave</th>
            <th class="center">%</th>
        </tr>
    </thead>

    <tbody>
        @forelse($students ?? [] as $s)
            <tr>
                <td>
                    <div class="student-name">{{ $s['student_name'] }}</div>
                    @if(!empty($s['father_name']))
                        <div class="father-name">Father: {{ $s['father_name'] }}</div>
                    @endif
                </td>
                <td>{{ $s['class_name'] }}</td>
                <td>{{ $s['section_name'] }}</td>
                <td class="amount paid">{{ $s['present'] }}</td>
                <td class="amount {{ $s['absent'] > 0 ? 'unpaid' : '' }}">{{ $s['absent'] }}</td>
                <td class="amount">{{ $s['leave'] }}</td>
                <td class="center" style="color: {{ $s['percentage'] >= 85 ? '#0a7a28' : ($s['percentage'] >= 70 ? '#cc8800' : '#b30000') }};">
                    {{ number_format($s['percentage'], 1) }}%
                </td>
            </tr>
        @empty
            <tr>
                <td colspan="7" style="text-align:center;color:#888;">No attendance data in this range.</td>
            </tr>
        @endforelse
    </tbody>
</table>

{{-- ================= TOP ABSENTEES ================= --}}
@if(!empty($top_absentees) && count($top_absentees) > 0)
    <h4 style="color:#b30000;">Top Absentees</h4>

    <table class="data-table">
        <thead>
            <tr>
                <th style="width:30px;">#</th>
                <th>Student</th>
                <th>Father</th>
                <th>Class</th>
                <th>Section</th>
                <th class="amount">Absent Days</th>
            </tr>
        </thead>
        <tbody>
            @foreach($top_absentees as $i => $s)
                <tr>
                    <td>{{ $i + 1 }}</td>
                    <td>
                        <div class="student-name">{{ $s['student_name'] }}</div>
                    </td>
                    <td>{{ $s['father_name'] ?? '—' }}</td>
                    <td>{{ $s['class_name'] }}</td>
                    <td>{{ $s['section_name'] }}</td>
                    <td class="amount unpaid">{{ $s['absent'] }}</td>
                </tr>
            @endforeach
        </tbody>
    </table>
@endif

<div class="footer">
    Generated on {{ now()->format('d M Y, h:i A') }} · GNJM Dharmic School
</div>

</body>
</html>
