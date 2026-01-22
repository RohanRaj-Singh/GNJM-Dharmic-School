<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Fees Report</title>

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

        /* SUMMARY */
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

        /* SECTION TITLES */
        h4 {
            margin: 16px 0 6px;
            font-size: 13px;
        }

        /* DATA TABLE */
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

        .paid {
            color: #0a7a28;
            font-weight: bold;
        }

        .unpaid {
            color: #b30000;
            font-weight: bold;
        }

        .amount {
            text-align: right;
            white-space: nowrap;
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
<table class="header-table">
    <tr>
        <td class="school-info">
            <h2>Guru Nanak Ji Mission Dharmic School</h2>
            <p>Nankana Sahib</p>

            <p>
                <strong>Giani Balwant Singh</strong> — Ph: 0306-9276-199<br>
                <strong>Veer Ji Amardeep Singh</strong> — Ph: 0302-2061313
            </p>

            <p><strong>Fees Report</strong></p>
        </td>
        <td class="logo-cell">
            <img src="{{ public_path('../resources/images/logo.png') }}" class="logo">
        </td>
    </tr>
</table>

<hr>

{{-- ================= SUMMARY ================= --}}
<table class="summary-table">
    <tr>
        <td class="summary-label">Total Students</td>
        <td>{{ $summary['total_students'] }}</td>

        <td class="summary-label">Paid Students</td>
        <td>{{ $summary['paid_students'] }}</td>
    </tr>
    <tr>
        <td class="summary-label">Total Fees</td>
        <td>Rs. {{ number_format($summary['total_fees']) }}</td>

        <td class="summary-label">Collected</td>
        <td>Rs. {{ number_format($summary['total_collected']) }}</td>
    </tr>
    <tr>
        <td class="summary-label">Pending</td>
        <td>Rs. {{ number_format($summary['total_pending']) }}</td>

        <td class="summary-label">Collection %</td>
        <td>{{ $summary['collection_percentage'] }}%</td>
    </tr>
</table>

{{-- ================= CLASS BREAKDOWN ================= --}}
@if(!empty($breakdowns['by_class']))
<h4>Class-wise Fee Breakdown</h4>

<table class="data-table">
    <thead>
        <tr>
            <th>Class</th>
            <th>Total Fees</th>
            <th>Collected</th>
            <th>Pending</th>
            <th>%</th>
        </tr>
    </thead>
    <tbody>
        @foreach($breakdowns['by_class'] as $row)
            <tr>
                <td>{{ $row['class'] }}</td>
                <td class="amount">Rs. {{ number_format($row['total']) }}</td>
                <td class="amount">Rs. {{ number_format($row['collected']) }}</td>
                <td class="amount">Rs. {{ number_format($row['pending']) }}</td>
                <td class="amount">{{ $row['percentage'] }}%</td>
            </tr>
        @endforeach
    </tbody>
</table>
@endif

{{-- ================= DETAILED TABLE ================= --}}
<h4>Detailed Fee Records</h4>

<table class="data-table">
    <thead>
        <tr>
            <th>Student</th>
            <th>Class</th>
            <th>Section</th>
            <th>Fee</th>
            <th>Month</th>
            <th>Amount</th>
            <th>Status</th>
        </tr>
    </thead>

    <tbody>
        @foreach($rows as $row)
            <tr>
                <td>
                    <div class="student-name">{{ $row->student_name }}</div>
                    @if($row->father_name)
                        <div class="father-name">
                            Father: {{ $row->father_name }}
                        </div>
                    @endif
                </td>

                <td>{{ $row->class_name }}</td>
                <td>{{ $row->section_name }}</td>
                <td>{{ $row->fee_title }}</td>

                <td>
                    @if($row->fee_type === 'monthly' && $row->month)
                        {{ \Carbon\Carbon::parse($row->month . '-01')->format('F Y') }}
                    @else
                        —
                    @endif
                </td>

                <td class="amount">
                    Rs. {{ number_format($row->amount) }}
                </td>

                <td class="{{ $row->is_paid ? 'paid' : 'unpaid' }}">
                    {{ $row->is_paid ? 'Paid' : 'Unpaid' }}
                </td>
            </tr>
        @endforeach
    </tbody>
</table>

<div class="footer">
    Generated on {{ now()->format('d M Y, h:i A') }}
</div>

</body>
</html>
