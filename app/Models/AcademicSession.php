<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\QueryException;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * An academic year/session, e.g. "2025–26" (April–March).
 *
 * The `is_current` flag marks the session the school is operating in right now.
 * At most one session should have is_current = true at any time.
 */
class AcademicSession extends Model
{
    protected $fillable = [
        'name',
        'start_date',
        'end_date',
        'is_current',
    ];

    protected $casts = [
        'start_date' => 'date',
        'end_date'   => 'date',
        'is_current' => 'boolean',
    ];

    // ── Scopes ──

    public function scopeCurrent($query)
    {
        return $query->where('is_current', true);
    }

    // ── Helpers ──

    /**
     * Resolve the current academic session, or create one from today's date
     * if none exists (useful for seeding / fallback).
     */
    public static function currentOrCreate(): self
    {
        return DB::transaction(function () {
            // Index-backed locking read on the singleton column: with the
            // partial unique index in place this serializes concurrent
            // "create current" attempts instead of letting two sessions both
            // become current.
            $existing = static::query()
                ->where('is_current_singleton', 1)
                ->lockForUpdate()
                ->first();

            if ($existing) {
                return $existing;
            }

            $now = Carbon::now(config('app.timezone'));
            $year = (int) $now->format('Y');
            $month = (int) $now->format('m');

            // Academic session: April – March.
            $sessionYear = $month >= 4 ? $year : $year - 1;
            $label = $sessionYear . '–' . substr((string) ($sessionYear + 1), -2);

            try {
                return static::create([
                    'name'       => $label,
                    'start_date' => Carbon::create($sessionYear, 4, 1)->toDateString(),
                    'end_date'   => Carbon::create($sessionYear + 1, 3, 31)->toDateString(),
                    'is_current' => true,
                ]);
            } catch (QueryException $e) {
                // A concurrent request won the race and already created the
                // current session; read it instead of failing.
                $existing = static::query()
                    ->where('is_current_singleton', 1)
                    ->lockForUpdate()
                    ->first();

                if ($existing) {
                    return $existing;
                }

                throw $e;
            }
        });
    }
}
