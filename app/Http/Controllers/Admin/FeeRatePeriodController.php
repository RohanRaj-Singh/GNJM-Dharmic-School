<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Fee;
use App\Models\FeeRatePeriod;
use App\Models\SchoolClass;
use App\Models\Section;
use App\Services\MonthlyFeeResolver;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class FeeRatePeriodController extends Controller
{
    public function __construct(private readonly MonthlyFeeResolver $monthlyFeeResolver)
    {
    }

    public function classPeriods(SchoolClass $class)
    {
        return response()->json([
            'periods' => $this->listPeriods('class', (int) $class->id),
        ]);
    }

    public function sectionPeriods(Section $section)
    {
        return response()->json([
            'periods' => $this->listPeriods('section', (int) $section->id),
        ]);
    }

    public function storeForClass(Request $request, SchoolClass $class)
    {
        $result = $this->storePeriod($request, 'class', (int) $class->id);
        return response()->json($result, 201);
    }

    public function storeForSection(Request $request, Section $section)
    {
        $result = $this->storePeriod($request, 'section', (int) $section->id);
        return response()->json(['period' => $result['period']], 201);
    }

    public function updateForClass(Request $request, SchoolClass $class, FeeRatePeriod $period)
    {
        abort_unless($period->scope_type === 'class' && (int) $period->scope_id === (int) $class->id, 404);
        return response()->json($this->updatePeriod($request, $period));
    }

    public function updateForSection(Request $request, Section $section, FeeRatePeriod $period)
    {
        abort_unless($period->scope_type === 'section' && (int) $period->scope_id === (int) $section->id, 404);
        $result = $this->updatePeriod($request, $period);
        return response()->json(['period' => $result['period']]);
    }

    public function destroyForClass(SchoolClass $class, FeeRatePeriod $period)
    {
        abort_unless($period->scope_type === 'class' && (int) $period->scope_id === (int) $class->id, 404);
        return $this->destroyPeriod($period);
    }

    public function destroyForSection(Section $section, FeeRatePeriod $period)
    {
        abort_unless($period->scope_type === 'section' && (int) $period->scope_id === (int) $section->id, 404);
        return $this->destroyPeriod($period);
    }

    private function storePeriod(Request $request, string $scopeType, int $scopeId): array
    {
        $data = $this->validatePayload($request);
        $normalized = $this->normalizePeriodBounds($data);

        $this->autoCloseOpenPeriodForFutureRollover(
            $scopeType,
            $scopeId,
            $normalized['start_date']
        );

        $this->assertNoOverlap($scopeType, $scopeId, $normalized['start_date'], $normalized['end_date']);

        $period = FeeRatePeriod::create([
            'scope_type' => $scopeType,
            'scope_id' => $scopeId,
            'amount' => $data['amount'],
            'effective_from' => $normalized['start_date'],
            'effective_to' => $normalized['end_date'],
        ]);

        $this->syncLegacyFeeColumn($scopeType, $scopeId);
        $sectionSync = $this->applySectionLegacyReset($scopeType, $scopeId, $data);
        if (!empty($sectionSync['valid_ids'])) {
            $this->refreshUnpaidMonthlyFeesForSections($sectionSync['valid_ids']);
        }
        $this->refreshUnpaidMonthlyFees(
            $scopeType,
            $scopeId,
            $this->toMonth($normalized['start_date']),
            $this->toMonth($normalized['end_date'])
        );

        return [
            'period' => $this->serializePeriod($period),
            'section_sync' => $sectionSync,
        ];
    }

    private function updatePeriod(Request $request, FeeRatePeriod $period): array
    {
        $oldStartMonth = $this->toMonth($period->effective_from);
        $oldEndMonth = $this->toMonth($period->effective_to);

        $data = $this->validatePayload($request);
        $normalized = $this->normalizePeriodBounds($data);

        if ($this->collectedMonthlyFeesExist(
            $period->scope_type,
            (int) $period->scope_id,
            $this->toMonth($period->effective_from),
            $this->toMonth($period->effective_to)
        )) {
            throw ValidationException::withMessages([
                'period' => 'This period cannot be changed because collected fees exist in its range.',
            ]);
        }

        $this->assertNoOverlap(
            $period->scope_type,
            (int) $period->scope_id,
            $normalized['start_date'],
            $normalized['end_date'],
            (int) $period->id
        );

        $period->update([
            'amount' => $data['amount'],
            'effective_from' => $normalized['start_date'],
            'effective_to' => $normalized['end_date'],
        ]);

        $period = $period->fresh();

        [$refreshStartMonth, $refreshEndMonth] = $this->mergeMonthRanges(
            $oldStartMonth,
            $oldEndMonth,
            $this->toMonth($period->effective_from),
            $this->toMonth($period->effective_to)
        );

        $this->syncLegacyFeeColumn($period->scope_type, (int) $period->scope_id);
        $sectionSync = $this->applySectionLegacyReset($period->scope_type, (int) $period->scope_id, $data);
        if (!empty($sectionSync['valid_ids'])) {
            $this->refreshUnpaidMonthlyFeesForSections($sectionSync['valid_ids']);
        }
        $this->refreshUnpaidMonthlyFees(
            $period->scope_type,
            (int) $period->scope_id,
            $refreshStartMonth,
            $refreshEndMonth
        );

        return [
            'period' => $this->serializePeriod($period),
            'section_sync' => $sectionSync,
        ];
    }

    private function destroyPeriod(FeeRatePeriod $period)
    {
        $startMonth = $this->toMonth($period->effective_from);
        $endMonth = $this->toMonth($period->effective_to);

        if ($this->collectedMonthlyFeesExist(
            $period->scope_type,
            (int) $period->scope_id,
            $this->toMonth($period->effective_from),
            $this->toMonth($period->effective_to)
        )) {
            return response()->json([
                'message' => 'This period cannot be deleted because collected fees exist in its range.',
            ], 422);
        }

        $period->delete();
        $this->syncLegacyFeeColumn($period->scope_type, (int) $period->scope_id);
        $this->refreshUnpaidMonthlyFees(
            $period->scope_type,
            (int) $period->scope_id,
            $startMonth,
            $endMonth
        );

        return response()->json([], 204);
    }

    private function validatePayload(Request $request): array
    {
        return $request->validate([
            'amount' => ['required', 'integer', 'min:0'],
            'effective_from' => ['required', 'date_format:Y-m'],
            'effective_to' => ['nullable', 'date_format:Y-m'],
            'reset_section_ids' => ['nullable', 'array'],
            'reset_section_ids.*' => ['integer', 'exists:sections,id'],
        ]);
    }

    private function normalizePeriodBounds(array $data): array
    {
        $start = Carbon::createFromFormat('Y-m', $data['effective_from'], config('app.timezone'))->startOfMonth();
        $end = null;
        if (!empty($data['effective_to'])) {
            $end = Carbon::createFromFormat('Y-m', $data['effective_to'], config('app.timezone'))->startOfMonth();
            if ($end->lt($start)) {
                throw ValidationException::withMessages([
                    'effective_to' => 'End month cannot be earlier than start month.',
                ]);
            }
        }

        return [
            'start_date' => $start->toDateString(),
            'end_date' => $end?->toDateString(),
        ];
    }

    private function assertNoOverlap(
        string $scopeType,
        int $scopeId,
        string $startDate,
        ?string $endDate,
        ?int $ignoreId = null
    ): void {
        $candidateEnd = $endDate ?? '9999-12-01';

        $overlapExists = FeeRatePeriod::query()
            ->where('scope_type', $scopeType)
            ->where('scope_id', $scopeId)
            ->when($ignoreId, fn ($q, $id) => $q->where('id', '!=', $id))
            ->whereDate('effective_from', '<=', $candidateEnd)
            ->where(function ($q) use ($startDate) {
                $q->whereNull('effective_to')
                    ->orWhereDate('effective_to', '>=', $startDate);
            })
            ->exists();

        if ($overlapExists) {
            throw ValidationException::withMessages([
                'period' => 'Fee periods cannot overlap for the same class/section.',
            ]);
        }
    }

    private function autoCloseOpenPeriodForFutureRollover(string $scopeType, int $scopeId, string $newStartDate): void
    {
        $newStart = Carbon::parse($newStartDate)->startOfMonth();
        $currentMonth = Carbon::now(config('app.timezone'))->startOfMonth();
        if ($newStart->lte($currentMonth)) {
            return;
        }

        $openPeriods = FeeRatePeriod::query()
            ->where('scope_type', $scopeType)
            ->where('scope_id', $scopeId)
            ->whereNull('effective_to')
            ->whereDate('effective_from', '<', $newStart->toDateString())
            ->orderBy('effective_from')
            ->get();

        if ($openPeriods->isEmpty()) {
            return;
        }

        if ($openPeriods->count() > 1) {
            throw ValidationException::withMessages([
                'period' => 'Cannot auto-close period because multiple open periods exist. Resolve timeline overlaps first.',
            ]);
        }

        if ($this->collectedMonthlyFeesExist($scopeType, $scopeId, $newStart->format('Y-m'), null)) {
            throw ValidationException::withMessages([
                'period' => 'Cannot start a new period from this month because collected fees already exist from that month onward.',
            ]);
        }

        $openPeriods->first()->update([
            'effective_to' => $newStart->copy()->subMonth()->startOfMonth()->toDateString(),
        ]);
    }

    private function collectedMonthlyFeesExist(string $scopeType, int $scopeId, string $startMonth, ?string $endMonth): bool
    {
        $query = Fee::query()
            ->join('student_sections', 'student_sections.id', '=', 'fees.student_section_id')
            ->join('payments', function ($join) {
                $join->on('payments.fee_id', '=', 'fees.id')
                    ->whereNull('payments.deleted_at');
            })
            ->where('fees.type', 'monthly')
            ->whereNotNull('fees.month')
            ->where('fees.month', '>=', $startMonth);

        if ($endMonth) {
            $query->where('fees.month', '<=', $endMonth);
        }

        if ($scopeType === 'section') {
            $query->where('student_sections.section_id', $scopeId);
        } else {
            $query->where('student_sections.class_id', $scopeId);
        }

        return $query->exists();
    }

    private function refreshUnpaidMonthlyFees(
        string $scopeType,
        int $scopeId,
        string $startMonth,
        ?string $endMonth
    ): void {
        $query = Fee::query()
            ->join('student_sections', 'student_sections.id', '=', 'fees.student_section_id')
            ->where('fees.type', 'monthly')
            ->whereNotNull('fees.month')
            ->where('fees.month', '>=', $startMonth)
            ->whereDoesntHave('payments', fn ($q) => $q->whereNull('deleted_at'));

        if ($endMonth) {
            $query->where('fees.month', '<=', $endMonth);
        }

        if ($scopeType === 'section') {
            $query->where('student_sections.section_id', $scopeId);
        } else {
            $query->where('student_sections.class_id', $scopeId);
        }

        $ids = $query->pluck('fees.id');
        if ($ids->isEmpty()) {
            return;
        }

        $fees = Fee::query()
            ->whereIn('id', $ids)
            ->with([
                'studentSection:id,class_id,section_id,student_type',
                'studentSection.section:id,class_id,monthly_fee',
                'studentSection.schoolClass:id,default_monthly_fee',
            ])
            ->get();

        foreach ($fees as $fee) {
            if (empty($fee->month) || !$fee->studentSection) {
                continue;
            }

            $resolvedAmount = $this->monthlyFeeResolver->resolveForMonth($fee->studentSection, $fee->month);
            if ($resolvedAmount <= 0) {
                $fee->delete();
                continue;
            }

            if ((int) $fee->amount !== (int) $resolvedAmount) {
                $fee->update(['amount' => (int) $resolvedAmount]);
            }
        }
    }

    private function mergeMonthRanges(
        ?string $startA,
        ?string $endA,
        ?string $startB,
        ?string $endB
    ): array {
        $starts = array_filter([$startA, $startB]);
        $mergedStart = empty($starts) ? now(config('app.timezone'))->format('Y-m') : min($starts);

        if ($endA === null || $endB === null) {
            return [$mergedStart, null];
        }

        return [$mergedStart, max($endA, $endB)];
    }

    private function applySectionLegacyReset(string $scopeType, int $scopeId, array $data): array
    {
        if ($scopeType !== 'class') {
            return ['requested' => 0, 'updated' => 0, 'with_timeline' => 0, 'ignored' => 0, 'timelines_zeroed' => 0, 'valid_ids' => []];
        }

        $requestedIds = collect($data['reset_section_ids'] ?? [])
            ->map(fn ($id) => (int) $id)
            ->filter(fn ($id) => $id > 0)
            ->unique()
            ->values();

        if ($requestedIds->isEmpty()) {
            return ['requested' => 0, 'updated' => 0, 'with_timeline' => 0, 'ignored' => 0, 'timelines_zeroed' => 0, 'valid_ids' => []];
        }

        $validIds = Section::query()
            ->where('class_id', $scopeId)
            ->whereIn('id', $requestedIds->all())
            ->pluck('id')
            ->map(fn ($id) => (int) $id)
            ->all();

        if (!empty($validIds)) {
            Section::whereIn('id', $validIds)->update(['monthly_fee' => 0]);
        }

        $sectionTimelineQuery = FeeRatePeriod::query()
            ->where('scope_type', 'section')
            ->whereIn('scope_id', $validIds);

        $withTimelineCount = empty($validIds)
            ? 0
            : (clone $sectionTimelineQuery)
                ->distinct('scope_id')
                ->count('scope_id');
        $timelinesZeroed = empty($validIds)
            ? 0
            : (clone $sectionTimelineQuery)->update(['amount' => 0]);

        return [
            'requested' => $requestedIds->count(),
            'updated' => count($validIds),
            'with_timeline' => (int) $withTimelineCount,
            'ignored' => max(0, $requestedIds->count() - count($validIds)),
            'timelines_zeroed' => (int) $timelinesZeroed,
            'valid_ids' => $validIds,
        ];
    }

    private function refreshUnpaidMonthlyFeesForSections(array $sectionIds): void
    {
        $sectionIds = collect($sectionIds)
            ->map(fn ($id) => (int) $id)
            ->filter(fn ($id) => $id > 0)
            ->unique()
            ->values()
            ->all();

        if (empty($sectionIds)) {
            return;
        }

        $ids = Fee::query()
            ->join('student_sections', 'student_sections.id', '=', 'fees.student_section_id')
            ->where('fees.type', 'monthly')
            ->whereNotNull('fees.month')
            ->whereIn('student_sections.section_id', $sectionIds)
            ->whereDoesntHave('payments', fn ($q) => $q->whereNull('deleted_at'))
            ->pluck('fees.id');

        if ($ids->isEmpty()) {
            return;
        }

        $fees = Fee::query()
            ->whereIn('id', $ids)
            ->with([
                'studentSection:id,class_id,section_id,student_type',
                'studentSection.section:id,class_id,monthly_fee',
                'studentSection.schoolClass:id,default_monthly_fee',
            ])
            ->get();

        foreach ($fees as $fee) {
            if (empty($fee->month) || !$fee->studentSection) {
                continue;
            }

            $resolvedAmount = $this->monthlyFeeResolver->resolveForMonth($fee->studentSection, $fee->month);
            if ($resolvedAmount <= 0) {
                $fee->delete();
                continue;
            }

            if ((int) $fee->amount !== (int) $resolvedAmount) {
                $fee->update(['amount' => (int) $resolvedAmount]);
            }
        }
    }

    private function listPeriods(string $scopeType, int $scopeId): array
    {
        return FeeRatePeriod::query()
            ->where('scope_type', $scopeType)
            ->where('scope_id', $scopeId)
            ->orderBy('effective_from')
            ->get()
            ->map(fn (FeeRatePeriod $period) => $this->serializePeriod($period))
            ->all();
    }

    private function serializePeriod(FeeRatePeriod $period): array
    {
        return [
            'id' => (int) $period->id,
            'amount' => (int) $period->amount,
            'effective_from' => $this->toMonth($period->effective_from),
            'effective_to' => $this->toMonth($period->effective_to),
        ];
    }

    private function toMonth($date): ?string
    {
        if (!$date) {
            return null;
        }

        return Carbon::parse($date)->format('Y-m');
    }

    private function syncLegacyFeeColumn(string $scopeType, int $scopeId): void
    {
        $currentMonthStart = Carbon::now(config('app.timezone'))->startOfMonth()->toDateString();

        $activeAmount = (int) (
            FeeRatePeriod::query()
                ->where('scope_type', $scopeType)
                ->where('scope_id', $scopeId)
                ->whereDate('effective_from', '<=', $currentMonthStart)
                ->where(function ($q) use ($currentMonthStart) {
                    $q->whereNull('effective_to')
                        ->orWhereDate('effective_to', '>=', $currentMonthStart);
                })
                ->orderByDesc('effective_from')
                ->value('amount') ?? 0
        );

        if ($scopeType === 'class') {
            SchoolClass::whereKey($scopeId)->update([
                'default_monthly_fee' => max(0, $activeAmount),
            ]);
            return;
        }

        Section::whereKey($scopeId)->update([
            'monthly_fee' => max(0, $activeAmount),
        ]);
    }
}
