<?php

namespace App\Services\StudentReport;

use App\Support\StudentReport\StudentReport;
use App\Support\StudentReport\StudentReportRequest;
use Closure;
use Illuminate\Support\Facades\Cache;

/**
 * Generation-counter cache for Student Reports.
 *
 * Why this design (kickoff §3.4): the default SQLite cache driver does not
 * support cache tags. We embed a per-student generation counter in the
 * cache key; bumping the counter on a data write orphans all stale keys
 * (they expire naturally via the 10-minute TTL backstop).
 *
 * On a cache miss, the build closure runs and the result is stored.
 */
final class StudentReportCache
{
    public const TTL_SECONDS = 600; // 10 minutes backstop
    public const KEY_PREFIX = 'student_report:v1:';
    public const GEN_PREFIX = 'student_report:v1:gen:';

    public function remember(StudentReportRequest $req, Closure $build): StudentReport
    {
        $key = $this->key($req);
        return Cache::remember($key, self::TTL_SECONDS, $build);
    }

    public function forget(int $studentId): void
    {
        // Bump the per-student generation. We don't use Cache::increment
        // because it is a no-op when the key doesn't yet exist, which would
        // mean forget() silently does nothing on a student's first
        // invalidation. Instead: if no gen key exists, set it to a fresh
        // timestamp; otherwise increment it.
        $genKey = self::GEN_PREFIX . $studentId;
        if (Cache::has($genKey)) {
            Cache::increment($genKey);
        } else {
            // Use a high-resolution timestamp so future increments differ
            // from the initial value, and so the value is monotonic.
            Cache::forever($genKey, (int) (microtime(true) * 1000));
        }
    }

    public function key(StudentReportRequest $req): string
    {
        $gen = (int) (Cache::get(self::GEN_PREFIX . $req->studentId) ?? 1);
        return self::KEY_PREFIX
            . $req->studentId . ':'
            . $gen . ':'
            . sha1(json_encode($req->filterPayload()));
    }
}
