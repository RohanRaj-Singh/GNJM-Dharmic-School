<?php

namespace App\Console\Commands;

use App\Models\Fee;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class CleanupMonthlyFees extends Command
{
    protected $signature = 'fees:cleanup-monthly {--execute : Apply changes. Without this flag the command runs as dry-run.}';

    protected $description = 'Find and optionally clean duplicate/inconsistent monthly fees.';

    public function handle(): int
    {
        $execute = (bool) $this->option('execute');

        $duplicates = Fee::query()
            ->where('type', 'monthly')
            ->whereNotNull('month')
            ->select([
                'student_section_id',
                'month',
                DB::raw('COUNT(*) as total'),
                DB::raw('MIN(id) as keep_id'),
            ])
            ->groupBy('student_section_id', 'month')
            ->havingRaw('COUNT(*) > 1')
            ->get();

        $this->info('Duplicate monthly groups: ' . $duplicates->count());

        foreach ($duplicates as $group) {
            $rows = Fee::query()
                ->where('type', 'monthly')
                ->where('student_section_id', $group->student_section_id)
                ->where('month', $group->month)
                ->orderBy('id')
                ->get();

            $keep = $rows->first();
            if (!$keep) {
                continue;
            }

            $drop = $rows->skip(1);
            $this->line(sprintf(
                'student_section_id=%d month=%s keep=%d drop=%s',
                $group->student_section_id,
                $group->month,
                $keep->id,
                $drop->pluck('id')->join(',')
            ));

            if (!$execute) {
                continue;
            }

            DB::transaction(function () use ($drop) {
                foreach ($drop as $fee) {
                    if ($fee->payments()->whereNull('deleted_at')->exists()) {
                        continue;
                    }
                    $fee->delete();
                }
            });
        }

        if (!$execute) {
            $this->warn('Dry-run mode. Re-run with --execute to apply cleanup.');
        } else {
            $this->info('Cleanup applied.');
        }

        return self::SUCCESS;
    }
}
