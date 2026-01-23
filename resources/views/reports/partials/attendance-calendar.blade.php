<style>
.calendar-row {
    width: 100%;
    margin-bottom: 14px;
}

.calendar-box {
    width: 32%;
    display: inline-block;
    vertical-align: top;
    margin-right: 1%;
}

.calendar-box:last-child {
    margin-right: 0;
}

.cal-title {
    text-align: center;
    font-weight: bold;
    font-size: 11px;
    margin-bottom: 4px;
}

.cal-table {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
}

.cal-table th,
.cal-table td {
    border: 1px solid #ccc;
    text-align: center;
    font-size: 9px;
    padding: 2px;
}

.cal-table th {
    background: #f0f0f0;
    font-weight: bold;
}

.bg-present { background: lightgreen; }
.bg-absent  { background: lightcoral; }
.bg-leave   { background: lightgoldenrodyellow; }
.bg-na      { background: #f2f2f2; color: #999; }

.lesson {
    display: block;
    font-size: 8px;
    font-weight: bold;
    color: #1d4ed8;
}
</style>

@if(empty($attendance['calendar']))
    <p style="font-size:10px;color:#666;">No attendance data available.</p>
@else

@php
    $months = array_chunk($attendance['calendar'], 3, true);
@endphp

@foreach($months as $rowMonths)
<div class="calendar-row">

@foreach($rowMonths as $monthName => $days)

@php
    $monthNum = \Carbon\Carbon::parse("1 $monthName $year")->month;
    $firstDay = \Carbon\Carbon::create($year, $monthNum, 1)->dayOfWeekIso; // 1=Mon
    $daysInMonth = \Carbon\Carbon::create($year, $monthNum, 1)->daysInMonth;
    $day = 1;
@endphp

<div class="calendar-box">
    <div class="cal-title">{{ $monthName }}</div>

    <table class="cal-table">
        <thead>
            <tr>
                <th>M</th><th>T</th><th>W</th><th>T</th><th>F</th><th>S</th><th>S</th>
            </tr>
        </thead>
        <tbody>

@for($week = 1; $week <= 6; $week++)
<tr>
@for($dow = 1; $dow <= 7; $dow++)
@php
    $cell = null;
    $class = 'bg-na';

    if (($week > 1 || $dow >= $firstDay) && $day <= $daysInMonth) {
        $cell = $days[$day] ?? null;

        if ($cell && $cell['status'] === 'present') $class = 'bg-present';
        elseif ($cell && $cell['status'] === 'absent') $class = 'bg-absent';
        elseif ($cell && $cell['status'] === 'leave') $class = 'bg-leave';
        else $class = 'bg-na';
    }
@endphp

<td class="{{ $class }}">
@if($cell !== null)
    {{ $day }}
    @if($cell['status'] === 'present' && $showLesson && !empty($cell['lesson_learned']))
        <span class="lesson">✓</span>
    @endif
    @php $day++; @endphp
@else
    —
@endif
</td>

@endfor
</tr>
@endfor

        </tbody>
    </table>
</div>

@endforeach
</div>
@endforeach
@endif
