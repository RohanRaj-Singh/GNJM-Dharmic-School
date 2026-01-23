<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Student Performa</title>

    <style>
        body {
            font-family: DejaVu Sans, sans-serif;
            font-size: 11px;
            color: #000;
        }

        h2 { margin: 0; font-size: 16px; }
        h4 { margin: 18px 0 6px; font-size: 13px; }
        p  { margin: 2px 0; }

        .logo { width: 110px; }

        table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 10px;
        }

        th, td {
            border: 1px solid #ccc;
            padding: 5px;
            vertical-align: middle;
        }

        th {
            background: #f0f0f0;
            font-size: 10px;
        }

        .summary-label {
            background: #f7f7f7;
            font-weight: bold;
            width: 25%;
        }

        .amount { text-align: right; white-space: nowrap; }
        .center { text-align: center; }

        .paid   { color: #0a7a28; font-weight: bold; }
        .unpaid { color: #b30000; font-weight: bold; }

        .stat {
            border: 1px solid #ccc;
            padding: 6px;
            text-align: center;
        }

        .stat-label {
            font-size: 10px;
            color: #555;
        }

        .stat-value {
            font-size: 14px;
            font-weight: bold;
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

{{-- ================= HEADER ================= --}}
<table>
    <tr>
        <td>
            <h2>Guru Nanak Ji Mission Dharmic School</h2>
            <p>Nankana Sahib</p>
            <p>
                <strong>Giani Balwant Singh</strong> — Ph: 0306-9276199<br>
                <strong>Veer Ji Amardeep Singh</strong> — Ph: 0302-2061313
            </p>
            <p><strong>Student Performa</strong></p>
        </td>
        <td style="text-align:right">
            <img src="{{ public_path('../resources/images/logo.png') }}" class="logo">
        </td>
    </tr>
</table>

<hr>

{{-- ================= STUDENT INFO ================= --}}
<table>
    <tr>
        <td class="summary-label">Student Name</td>
        <td>{{ $student['name'] }}</td>
        <td class="summary-label">Father Name</td>
        <td>{{ $student['father_name'] }}</td>
    </tr>
</table>

{{-- =====================================================
   GURMUKHI SECTION
===================================================== --}}
<h4>Gurmukhi (Academic)</h4>

{{-- FEES SUMMARY --}}
<table>
    <tr>
        <td class="summary-label">Total Fees</td>
        <td>Rs. {{ number_format($gurmukhi['fees']['summary']['total']) }}</td>
        <td class="summary-label">Paid</td>
        <td>Rs. {{ number_format($gurmukhi['fees']['summary']['paid']) }}</td>
    </tr>
    <tr>
        <td class="summary-label">Pending</td>
        <td colspan="3">Rs. {{ number_format($gurmukhi['fees']['summary']['pending']) }}</td>
    </tr>
</table>

{{-- FEES TABLE --}}
<table>
    <thead>
        <tr>
            <th>Fee</th>
            <th>Month</th>
            <th class="amount">Amount</th>
            <th>Status</th>
        </tr>
    </thead>
    <tbody>
        @forelse($gurmukhi['fees']['rows'] as $row)
            <tr>
                <td>{{ $row->title }}</td>
                <td>
                    {{ $row->month
                        ? \Carbon\Carbon::createFromFormat('Y-m', $row->month)->format('F Y')
                        : '—' }}
                </td>
                <td class="amount">Rs. {{ number_format($row->amount) }}</td>
                <td class="{{ $row->is_paid ? 'paid' : 'unpaid' }}">
                    {{ $row->is_paid ? 'Paid' : 'Unpaid' }}
                </td>
            </tr>
        @empty
            <tr><td colspan="4" class="center">No fee records</td></tr>
        @endforelse
    </tbody>
</table>

{{-- ATTENDANCE STATS --}}
<table>
    <tr>
        <td class="stat">
            <div class="stat-label">Present</div>
            <div class="stat-value">{{ $gurmukhi['attendance']['summary']['present'] }}</div>
        </td>
        <td class="stat">
            <div class="stat-label">Absent</div>
            <div class="stat-value">{{ $gurmukhi['attendance']['summary']['absent'] }}</div>
        </td>
        <td class="stat">
            <div class="stat-label">Leave</div>
            <div class="stat-value">{{ $gurmukhi['attendance']['summary']['leave'] }}</div>
        </td>
        <td class="stat">
            <div class="stat-label">Attendance %</div>
            <div class="stat-value">{{ $gurmukhi['attendance']['summary']['percentage'] }}%</div>
        </td>
    </tr>
</table>

{{-- ATTENDANCE CALENDAR --}}
@include('reports.partials.attendance-calendar', [
    'attendance' => $gurmukhi['attendance'],
    'year' => request('year'),
    'showLesson' => false,
])


{{-- =====================================================
   KIRTAN SECTION
===================================================== --}}
<h4>Kirtan (Spiritual)</h4>

{{-- FEES SUMMARY --}}
<table>
    <tr>
        <td class="summary-label">Total Fees</td>
        <td>Rs. {{ number_format($kirtan['fees']['summary']['total']) }}</td>
        <td class="summary-label">Paid</td>
        <td>Rs. {{ number_format($kirtan['fees']['summary']['paid']) }}</td>
    </tr>
    <tr>
        <td class="summary-label">Pending</td>
        <td colspan="3">Rs. {{ number_format($kirtan['fees']['summary']['pending']) }}</td>
    </tr>
</table>

{{-- PERFORMANCE STATS --}}
<table>
    <tr>
        <td class="stat">
            <div class="stat-label">Total Classes</div>
            <div class="stat-value">{{ $kirtan['performance']['total_classes'] }}</div>
        </td>
        <td class="stat">
            <div class="stat-label">Lessons Learned</div>
            <div class="stat-value">{{ $kirtan['performance']['lessons_learned'] }}</div>
        </td>
        <td class="stat">
            <div class="stat-label">Performance %</div>
            <div class="stat-value">{{ $kirtan['performance']['percentage'] }}%</div>
        </td>
        <td class="stat">
            <div class="stat-label">Rating</div>
            <div class="stat-value">{{ $kirtan['performance']['rating'] }}</div>
        </td>
    </tr>
</table>

{{-- KIRTAN ATTENDANCE CALENDAR --}}
@include('reports.partials.attendance-calendar', [
    'attendance' => $kirtan['attendance'],
    'year' => request('year'),
    'showLesson' => true,
])


<div class="footer">
    Generated on {{ now()->format('d M Y, h:i A') }}
</div>

</body>
</html>
