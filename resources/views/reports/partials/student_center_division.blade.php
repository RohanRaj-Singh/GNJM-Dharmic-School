{{--
    Student Report Center — per-division PDF block.

    Iterates one division (Gurmukhi, Kirtan, Music, …) and renders the same
    attendance + fees + (Kirtan) performance + calendar layout. The parent
    template loops over every division the service returns so a third+ class
    surfaces its own PDF section without a code change.

    Required variables:
      $division       array        -- one DivisionReport::toArray() payload
      $range          array        -- the report range (for calendar year)
      $isFree         bool         -- student is free (no monthly fees)
--}}
@php
    $divisionKey   = $division['division'] ?? '';
    $divisionLabel = $division['division_label'] ?? ucfirst($divisionKey);
    $showLesson    = $divisionKey === 'kirtan'; // kirtan_score + lesson marker is a Kirtan-only feature
@endphp

<h2>{{ $divisionLabel }}</h2>

@if(empty($division['enrolled']))
    <p class="empty-state">Student is not enrolled in {{ $divisionLabel }}. No attendance or fees to show.</p>
@else
    <h3>Attendance</h3>
    <table class="stat-table no-break">
        <tr>
            <td><div class="lbl">Present</div><div class="val">{{ $division['attendance']['present'] }}</div></td>
            <td><div class="lbl">Absent</div><div class="val">{{ $division['attendance']['absent'] }}</div></td>
            <td><div class="lbl">Leave</div><div class="val">{{ $division['attendance']['leave'] }}</div></td>
            <td><div class="lbl">Marked</div><div class="val">{{ $division['attendance']['marked_days'] }}</div></td>
            <td><div class="lbl">Attendance %</div><div class="val">{{ number_format($division['attendance']['percentage'], 2) }}%</div></td>
        </tr>
    </table>

    @if(!empty($division['attendance']['current_streak_length']))
        <p>Current streak: <strong>{{ $division['attendance']['current_streak_length'] }}</strong> day(s) of <strong>{{ $division['attendance']['current_streak_status'] }}</strong></p>
    @endif

    <h3>Fees</h3>
    <table class="stat-table no-break">
        <tr>
            <td><div class="lbl">Total Charged</div><div class="val">Rs. {{ number_format($division['fees']['total_charged']) }}</div></td>
            <td><div class="lbl">Total Paid</div><div class="val">Rs. {{ number_format($division['fees']['total_paid']) }}</div></td>
            <td><div class="lbl">Pending</div><div class="val">Rs. {{ number_format($division['fees']['pending']) }}</div></td>
            <td><div class="lbl">Outstanding Months</div><div class="val">{{ $division['fees']['outstanding_months'] }}</div></td>
        </tr>
    </table>
    @if(!empty($division['fees']['last_payment_date']))
        <p>Last payment: <strong>{{ $division['fees']['last_payment_date'] }}</strong></p>
    @endif

    @if($isFree)
        <p><em>This student is exempt from monthly fees. Only custom fees are listed below (if any).</em></p>
    @endif

    @if(!empty($division['kirtan_score']))
        <h3>Kirtan Performance</h3>
        @if(($division['kirtan_score']['data_status'] ?? '') === 'no_data')
            <p class="empty-state">No attendance recorded in the selected range — score is not available.</p>
        @else
            <table class="stat-table no-break">
                <tr>
                    <td><div class="lbl">Score</div><div class="val">{{ number_format($division['kirtan_score']['score'], 1) }}%</div></td>
                    <td><div class="lbl">Rating</div><div class="val">{{ $division['kirtan_score']['rating'] }}</div></td>
                    <td><div class="lbl">Total Classes</div><div class="val">{{ $division['kirtan_score']['total_classes'] }}</div></td>
                    <td><div class="lbl">Lessons Learned</div><div class="val">{{ $division['kirtan_score']['lessons_learned'] }}</div></td>
                </tr>
            </table>
            <p>Attendance component: <strong>{{ number_format($division['kirtan_score']['components']['attendance'], 2) }}%</strong> × 0.6
               · Lesson component: <strong>{{ number_format($division['kirtan_score']['components']['lesson'], 2) }}%</strong> × 0.4</p>
        @endif
    @endif

    @if(!empty($division['fees']['monthly_breakdown']))
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
                @foreach($division['fees']['monthly_breakdown'] as $m)
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

    @if(empty($division['fees']['rows']))
        <p class="empty-state">No fee records in this range.</p>
    @endif

    <h3>Calendar</h3>
    @include('reports.partials.student_center_calendar', [
        'months'     => $division['months'] ?? [],
        'year'       => (int) ($range['start_label'] ? substr($range['start_label'], 0, 4) : date('Y')),
        'showLesson' => $showLesson,
    ])
@endif
