{{--
    Range-aware calendar grid.
    Renders the months passed in (one per month in the selected range,
    not a fixed 12). Lays out in 3-per-row strips.

    Required variables:
      $months       list<MonthCell>     -- the months to render
      $year         int                 -- the year of the range (for first-day computation)
      $showLesson   bool                -- whether to draw the lesson ✓ marker (Kirtan only)
--}}
<style>
    .sc-row { width: 100%; margin-bottom: 8px; }
    .sc-box { width: 32%; display: inline-block; vertical-align: top; margin-right: 1%; }
    .sc-box:last-child { margin-right: 0; }
    .sc-title { text-align: center; font-weight: bold; font-size: 10px; margin-bottom: 3px; }
    .sc-table { width: 100%; border-collapse: collapse; table-layout: fixed; }
    .sc-table th, .sc-table td { border: 1px solid #ccc; text-align: center; font-size: 8px; padding: 1px; height: 14px; }
    .sc-table th { background: #f0f0f0; font-weight: bold; }
    .sc-present { background: lightgreen; }
    .sc-absent  { background: lightcoral; }
    .sc-leave   { background: lightgoldenrodyellow; }
    .sc-na      { background: #f5f5f5; color: #aaa; }
    .sc-lesson  { display: block; font-size: 7px; font-weight: bold; color: #1d4ed8; line-height: 1; }
</style>

@if(empty($months))
    <p style="font-size:9px;color:#666;">No calendar data in this range.</p>
@else
    @php
        $rows = array_chunk($months, 3, true);
    @endphp

    @foreach($rows as $rowMonths)
        <div class="sc-row">
            @foreach($rowMonths as $m)
                @php
                    $monthNum = (int) $m['month'];
                    $firstDay = \Carbon\Carbon::create((int) $year, $monthNum, 1)->dayOfWeekIso; // 1=Mon
                    $daysInMonth = \Carbon\Carbon::create((int) $year, $monthNum, 1)->daysInMonth;
                    $day = 1;
                @endphp

                <div class="sc-box">
                    <div class="sc-title">{{ $m['label'] }}</div>
                    <table class="sc-table">
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
                                            $class = 'sc-na';
                                            if (($week > 1 || $dow >= $firstDay) && $day <= $daysInMonth) {
                                                $cell = $m['days'][(string) $day] ?? null;
                                                if ($cell && $cell['status'] === 'present') $class = 'sc-present';
                                                elseif ($cell && $cell['status'] === 'absent')  $class = 'sc-absent';
                                                elseif ($cell && $cell['status'] === 'leave')   $class = 'sc-leave';
                                                else $class = 'sc-na';
                                            }
                                        @endphp
                                        <td class="{{ $class }}">
                                            @if($cell !== null)
                                                {{ $day }}
                                                @if($showLesson && !empty($cell['lesson_learned']))
                                                    <span class="sc-lesson">✓</span>
                                                @endif
                                                @php $day++; @endphp
                                            @else
                                                &nbsp;
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
