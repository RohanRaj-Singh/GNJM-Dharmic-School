<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Attendance Report</title>

    <style>
        body {
            font-family: DejaVu Sans;
            font-size: 11px;
            color: #000;
        }

        .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .school h3 {
            margin: 0;
            font-size: 16px;
        }

        .school p {
            margin: 2px 0;
            font-size: 11px;
        }

        .meta {
            margin-top: 10px;
            font-size: 11px;
        }

        .summary {
            margin: 15px 0;
            display: table;
            width: 100%;
        }

        .summary div {
            display: table-cell;
            border: 1px solid #ccc;
            padding: 6px;
            text-align: center;
        }

        table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 10px;
        }

        th, td {
            border: 1px solid #ccc;
            padding: 5px;
            text-align: center;
        }

        th {
            background: #f5f5f5;
            font-weight: bold;
        }

        .student {
            text-align: left;
            font-weight: bold;
        }

        .father {
            font-size: 9px;
            color: #555;
        }

        .present { background: #c6efce; }
        .absent  { background: #ffc7ce; }
        .leave   { background: #ffeb9c; }

        .lesson {
            font-size: 9px;
            color: #1d4ed8;
            font-weight: bold;
        }
    </style>
</head>
<body>

{{-- ================= HEADER ================= --}}
<div class="header">
    <div class="school">
        <h3>Guru Nanak Ji Mission Dharmic School</h3>
        <p>Nankana Sahib</p>
        <p>Giani Balwant Singh — 📞 03XXXXXXXXX</p>
        <p>Veer Ji Amardeep Singh</p>
    </div>
</div>

<hr>

<div class="meta">
    <strong>Attendance Report</strong><br>
    Generated at: {{ $meta['generated_at'] ?? now() }}
</div>

{{-- ================= SUMMARY ================= --}}
<div class="summary">
    <div>
        <strong>Total</strong><br>
        {{ $summary['total_records'] }}
    </div>
    <div>
        <strong>Present</strong><br>
        {{ $summary['present'] }}
    </div>
    <div>
        <strong>Absent</strong><br>
        {{ $summary['absent'] }}
    </div>
    <div>
        <strong>Leave</strong><br>
        {{ $summary['leave'] }}
    </div>
    <div>
        <strong>%</strong><br>
        {{ $summary['attendance_percentage'] }}%
    </div>
</div>

{{-- ================= TABLE ================= --}}
<table>
    <thead>
        <tr>
            <th>Student</th>
            <th>Class</th>
            <th>Section</th>
            <th>Date</th>
            <th>Status</th>
            <th>Lesson</th>
        </tr>
    </thead>

    <tbody>
        @forelse ($rows as $row)
            <tr>
                <td class="student">
                    {{ $row->student_name }}
                    @if($row->father_name)
                        <div class="father">Father: {{ $row->father_name }}</div>
                    @endif
                </td>

                <td>{{ $row->class_name }}</td>
                <td>{{ $row->section_name }}</td>
                <td>{{ \Carbon\Carbon::parse($row->date)->format('d M Y') }}</td>

                <td class="{{ $row->status }}">
                    {{ ucfirst($row->status) }}
                </td>

                <td>
                    @if($row->lesson_learned)
                        <span class="lesson">✓</span>
                    @endif
                </td>
            </tr>
        @empty
            <tr>
                <td colspan="6">No attendance data</td>
            </tr>
        @endforelse
    </tbody>
</table>

</body>
</html>
