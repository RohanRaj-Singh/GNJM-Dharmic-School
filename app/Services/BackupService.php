<?php

namespace App\Services;

use App\Models\BackupEntry;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;

class BackupService
{
    private string $storagePath;

    public function __construct()
    {
        $this->storagePath = storage_path('app/backups');
        if (!is_dir($this->storagePath)) {
            mkdir($this->storagePath, 0755, true);
        }
    }

    public function create(?int $userId = null): BackupEntry
    {
        $timestamp = now()->format('Y-m-d-His');
        $filename = "backup-{$timestamp}.sql.gz";
        $relativePath = "backups/{$filename}";
        $fullPath = storage_path("app/{$relativePath}");

        Log::channel('backup')->info('Starting backup creation', ['filename' => $filename]);

        $dbSize = $this->calculateDbSize();
        $sql = $this->exportDatabase();

        $compressed = gzencode($sql, 9);
        if ($compressed === false) {
            Log::channel('backup')->error('Gzip compression failed');
            return $this->recordFailure($userId, $filename, $relativePath, $dbSize, 'Gzip compression failed');
        }

        $written = file_put_contents($fullPath, $compressed);
        if ($written === false) {
            Log::channel('backup')->error('Failed to write backup file', ['path' => $fullPath]);
            return $this->recordFailure($userId, $filename, $relativePath, $dbSize, 'Failed to write backup file');
        }

        $fileSize = filesize($fullPath);
        $checksum = hash_file('sha256', $fullPath);

        $entry = BackupEntry::create([
            'filename' => $filename,
            'file_path' => $relativePath,
            'file_size' => $fileSize ?: 0,
            'db_size' => $dbSize,
            'checksum' => $checksum,
            'app_version' => config('app.version', '1.0.0'),
            'laravel_version' => app()->version(),
            'migration_count' => $this->getMigrationCount(),
            'status' => 'created',
            'created_by' => $userId,
        ]);

        Log::channel('backup')->info('Backup created successfully', [
            'filename' => $filename,
            'file_size' => $fileSize,
            'db_size' => $dbSize,
            'checksum' => $checksum,
        ]);

        return $entry;
    }

    public function restore(BackupEntry $entry): bool
    {
        Log::channel('backup')->info('Starting database restore', ['filename' => $entry->filename]);

        $fullPath = $entry->getFullPath();
        if (!file_exists($fullPath)) {
            Log::channel('backup')->error('Backup file not found', ['path' => $fullPath]);
            throw new \RuntimeException('Backup file not found on disk.');
        }

        /* -----------------------------------------------------------------
         * Pre-flight safety (R10): verify BEFORE any destructive step.
         * A restore drops every table, so a corrupted or foreign dump must be
         * rejected while the database is still intact.
         * ----------------------------------------------------------------- */
        $this->verifyChecksum($entry, $fullPath);

        $compressed = file_get_contents($fullPath);
        if ($compressed === false) {
            throw new \RuntimeException('Failed to read backup file.');
        }

        // @ suppresses the gzip warning so a corrupt archive surfaces as a
        // clean RuntimeException instead of an ErrorException.
        $sql = @gzdecode($compressed);
        if ($sql === false) {
            throw new \RuntimeException('Failed to decompress backup file.');
        }

        $this->validateDump($sql);

        $entry->update(['status' => 'restoring']);

        try {
            // NOTE: MySQL DDL auto-commits, so this transaction cannot undo the
            // table drops on MySQL — it guards the SQLite path (whose DDL is
            // transactional) and keeps the status bookkeeping atomic. The real
            // MySQL safety comes from the pre-flight gates + post-restore
            // validation below.
            DB::transaction(function () use ($entry, $sql) {
                DB::statement('SET FOREIGN_KEY_CHECKS = 0');

                $tables = DB::select('SHOW TABLES');
                $tableKey = 'Tables_in_' . DB::getDatabaseName();
                foreach ($tables as $table) {
                    DB::statement("DROP TABLE IF EXISTS `{$table->$tableKey}`");
                }

                DB::unprepared($sql);

                DB::statement('SET FOREIGN_KEY_CHECKS = 1');

                $this->validateRestoredDatabase($entry);
            });

            $entry->update(['status' => 'restored']);

            Log::channel('backup')->info('Database restored successfully', ['filename' => $entry->filename]);

            return true;
        } catch (\Throwable $e) {
            $entry->update(['status' => 'failed']);
            Log::channel('backup')->error('Restore failed, database may be in incomplete state', [
                'filename' => $entry->filename,
                'error' => $e->getMessage(),
            ]);
            throw $e;
        }
    }

    /**
     * Reject a backup whose on-disk file no longer matches the checksum stored
     * at creation time. Protects against truncated/corrupted/edited archives
     * being applied on top of a live database.
     */
    private function verifyChecksum(BackupEntry $entry, string $fullPath): void
    {
        if (empty($entry->checksum)) {
            Log::channel('backup')->warning('Backup has no stored checksum; skipping verification', [
                'filename' => $entry->filename,
            ]);
            return;
        }

        $actual = hash_file('sha256', $fullPath);
        if ($actual === false || !hash_equals($entry->checksum, $actual)) {
            Log::channel('backup')->error('Checksum mismatch — refusing to restore', [
                'filename' => $entry->filename,
                'stored'   => substr($entry->checksum, 0, 12) . '...',
                'actual'   => substr((string) $actual, 0, 12) . '...',
            ]);
            throw new \RuntimeException('Checksum mismatch. The backup file may be corrupted or modified. Refusing to restore.');
        }
    }

    /**
     * Sanity-check the decompressed SQL before dropping any table. Both the
     * native export and mysqldump emit DROP TABLE then CREATE TABLE; a dump
     * without them is empty or not a MySQL dump at all.
     */
    private function validateDump(string $sql): void
    {
        if (trim($sql) === '') {
            throw new \RuntimeException('Backup file is empty; refusing to restore.');
        }

        if (!str_contains($sql, 'DROP TABLE') || !str_contains($sql, 'CREATE TABLE')) {
            Log::channel('backup')->error('Backup does not look like a valid SQL dump', [
                'sql_length' => strlen($sql),
            ]);
            throw new \RuntimeException('Backup does not contain a valid table structure; refusing to restore.');
        }
    }

    /**
     * After applying the dump, confirm the database actually matches the
     * backup's recorded state. Catches truncated dumps that "restored"
     * successfully but silently.
     */
    private function validateRestoredDatabase(BackupEntry $entry): void
    {
        $problems = [];

        $currentMigrationCount = $this->getMigrationCount();
        if ($entry->migration_count !== $currentMigrationCount) {
            $problems[] = "Migration count mismatch: backup {$entry->migration_count}, restored {$currentMigrationCount}.";
        }

        foreach (['users', 'students', 'classes', 'sections', 'fees'] as $table) {
            if (!Schema::hasTable($table)) {
                $problems[] = "Required table `{$table}` is missing after restore.";
            }
        }

        // The live schema requires student_id on fees/attendance (Sprint 0.5);
        // a dump from before that constraint would restore NULLs.
        $nullStudentFees = DB::table('fees')->whereNull('student_id')->count();
        if ($nullStudentFees > 0) {
            $problems[] = "{$nullStudentFees} fee(s) restored with a NULL student_id.";
        }

        $nullStudentAttendance = DB::table('attendance')->whereNull('student_id')->count();
        if ($nullStudentAttendance > 0) {
            $problems[] = "{$nullStudentAttendance} attendance row(s) restored with a NULL student_id.";
        }

        if ($problems !== []) {
            $message = 'Restore validation failed: ' . implode(' ', $problems);
            Log::channel('backup')->error($message, ['filename' => $entry->filename]);
            throw new \RuntimeException($message);
        }
    }

    public function delete(BackupEntry $entry): void
    {
        $fullPath = $entry->getFullPath();
        if (file_exists($fullPath)) {
            unlink($fullPath);
        }

        Log::channel('backup')->info('Backup deleted', ['filename' => $entry->filename]);
        $entry->delete();
    }

    public function getOverview(): array
    {
        $connection = DB::connection()->getDriverName();

        try {
            if ($connection === 'mysql' || $connection === 'mariadb') {
                $result = DB::selectOne(
                    'SELECT ROUND(SUM(data_length + index_length), 0) AS size
                     FROM information_schema.tables
                     WHERE table_schema = ?',
                    [DB::getDatabaseName()]
                );
                $dbSize = (int) ($result->size ?? 0);
            } elseif ($connection === 'sqlite') {
                $path = database_path('database.sqlite');
                $dbSize = file_exists($path) ? filesize($path) : 0;
            } else {
                $dbSize = $this->calculateDbSize();
            }
        } catch (\Throwable) {
            $dbSize = $this->calculateDbSize();
        }

        $lastBackup = BackupEntry::where('status', 'created')
            ->latest('created_at')
            ->first();

        $backupCount = BackupEntry::where('status', 'created')->count();

        $estimatedSecs = max(5, (int) round($dbSize / 500000));
        $estimatedTime = $estimatedSecs < 60
            ? "~{$estimatedSecs} seconds"
            : '~' . ceil($estimatedSecs / 60) . ' minutes';

        return [
            'db_size' => $dbSize,
            'db_size_formatted' => $this->formatBytes($dbSize),
            'last_backup' => $lastBackup?->created_at?->format('M d, Y h:i A'),
            'backup_count' => $backupCount,
            'estimated_restore_time' => $estimatedTime,
        ];
    }

    public function getHistory(): array
    {
        return BackupEntry::with('creator:id,name')
            ->orderByDesc('created_at')
            ->get()
            ->map(fn (BackupEntry $entry) => [
                'id' => $entry->id,
                'filename' => $entry->filename,
                'created_at' => $entry->created_at?->format('M d, Y h:i A'),
                'created_by' => $entry->creator?->name ?? 'System',
                'db_size' => $this->formatBytes($entry->db_size),
                'backup_size' => $this->formatBytes($entry->file_size),
                'status' => $entry->status,
                'app_version' => $entry->app_version,
                'laravel_version' => $entry->laravel_version,
                'migration_count' => $entry->migration_count,
                'checksum' => substr($entry->checksum, 0, 12) . '...',
            ])
            ->all();
    }

    public function checkCompatibility(BackupEntry $entry): array
    {
        $warnings = [];
        $currentAppVersion = config('app.version', '1.0.0');
        $currentLaravelVersion = app()->version();
        $currentMigrationCount = $this->getMigrationCount();

        $backupDate = $entry->created_at;
        if ($backupDate) {
            // diffInDays() is signed (negative for past dates), so a real old
            // backup would never satisfy > 30 — take the absolute value.
            $daysOld = (int) abs(now()->diffInDays($backupDate));
            if ($daysOld > 30) {
                $warnings[] = [
                    'type' => 'age',
                    'message' => "This backup is {$daysOld} days old.",
                ];
            }
        }

        if ($entry->app_version && $entry->app_version !== $currentAppVersion) {
            $warnings[] = [
                'type' => 'app_version',
                'message' => "Application version differs (backup: v{$entry->app_version}, current: v{$currentAppVersion}).",
            ];
        }

        if ($entry->laravel_version && $entry->laravel_version !== $currentLaravelVersion) {
            $warnings[] = [
                'type' => 'laravel_version',
                'message' => "Laravel version differs (backup: v{$entry->laravel_version}, current: v{$currentLaravelVersion}).",
            ];
        }

        if ($entry->migration_count !== $currentMigrationCount) {
            $warnings[] = [
                'type' => 'migration_count',
                'message' => "Migration count differs (backup: {$entry->migration_count}, current: {$currentMigrationCount}).",
            ];
        }

        return $warnings;
    }

    private function exportDatabase(): string
    {
        $connection = DB::connection()->getDriverName();

        if ($connection === 'mysql' || $connection === 'mariadb') {
            return $this->tryMysqldump() ?? $this->exportMysqlNative();
        }

        return $this->exportGeneric();
    }

    private function tryMysqldump(): ?string
    {
        $mysqldump = $this->findMysqldump();
        if ($mysqldump === null) {
            return null;
        }

        $host = config('database.connections.mysql.host');
        $port = config('database.connections.mysql.port', '3306');
        $db = config('database.connections.mysql.database');
        $user = config('database.connections.mysql.username');
        $pass = config('database.connections.mysql.password');

        $tempFile = tempnam(sys_get_temp_dir(), 'backup_');
        $command = sprintf(
            '%s --opt --single-transaction --routines --triggers --skip-comments '
            . '--host=%s --port=%s --user=%s --password=%s %s > %s 2>&1',
            escapeshellcmd($mysqldump),
            escapeshellarg($host),
            escapeshellarg($port),
            escapeshellarg($user),
            escapeshellarg($pass),
            escapeshellarg($db),
            escapeshellarg($tempFile)
        );

        exec($command, $output, $exitCode);

        if ($exitCode !== 0) {
            @unlink($tempFile);
            Log::channel('backup')->warning('mysqldump failed, falling back to native export', [
                'exit_code' => $exitCode,
                'output' => implode("\n", $output),
            ]);
            return null;
        }

        $sql = file_get_contents($tempFile);
        @unlink($tempFile);

        return $sql !== false ? $sql : null;
    }

    private function findMysqldump(): ?string
    {
        $paths = ['mysqldump', '/usr/bin/mysqldump', '/usr/local/bin/mysqldump'];
        foreach ($paths as $path) {
            $which = trim((string) shell_exec("command -v " . escapeshellarg($path) . " 2>/dev/null"));
            if ($which !== '' && @is_executable($which)) {
                return $which;
            }
            if (@is_executable($path)) {
                return $path;
            }
        }
        return null;
    }

    private function exportMysqlNative(): string
    {
        $output = '';
        $output .= "-- GNJM School ERP Database Backup\n";
        $output .= "-- Generated: " . now()->toDateTimeString() . "\n";
        $output .= "-- Database: " . DB::getDatabaseName() . "\n\n";
        $output .= "SET FOREIGN_KEY_CHECKS = 0;\n\n";

        $tables = DB::select('SHOW TABLES');
        $tableKey = 'Tables_in_' . DB::getDatabaseName();

        foreach ($tables as $tableRow) {
            $table = $tableRow->$tableKey;

            $createTable = DB::select("SHOW CREATE TABLE `{$table}`");
            $createKey = 'Create Table';
            $output .= "DROP TABLE IF EXISTS `{$table}`;\n";
            $output .= $createTable[0]->$createKey . ";\n\n";

            $count = DB::table($table)->count();
            if ($count === 0) {
                continue;
            }

            $output .= "INSERT INTO `{$table}` VALUES\n";

            $first = true;
            DB::table($table)->orderBy(DB::raw('1'))->chunk(500, function ($rows) use (&$output, &$first) {
                foreach ($rows as $row) {
                    $values = [];
                    foreach ((array) $row as $value) {
                        if ($value === null) {
                            $values[] = 'NULL';
                        } elseif (is_int($value) || is_float($value)) {
                            $values[] = $value;
                        } else {
                            $values[] = "'" . str_replace("'", "\\'", (string) $value) . "'";
                        }
                    }
                    $prefix = $first ? '  ' : ', ';
                    $output .= $prefix . '(' . implode(', ', $values) . ")\n";
                    $first = false;
                }
            });

            $output .= ";\n\n";
        }

        $output .= "SET FOREIGN_KEY_CHECKS = 1;\n";

        return $output;
    }

    private function exportGeneric(): string
    {
        $output = '';
        $output .= "-- GNJM School ERP Database Backup\n";
        $output .= "-- Generated: " . now()->toDateTimeString() . "\n\n";

        $tables = DB::select("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'");

        foreach ($tables as $tableRow) {
            $table = $tableRow->name;

            $createSql = DB::select("SELECT sql FROM sqlite_master WHERE type='table' AND name=?", [$table]);
            if (!empty($createSql) && !empty($createSql[0]->sql)) {
                $output .= "DROP TABLE IF EXISTS `{$table}`;\n";
                $output .= $createSql[0]->sql . ";\n\n";
            }

            $rows = DB::table($table)->get();
            if ($rows->isEmpty()) {
                continue;
            }

            $output .= "INSERT INTO `{$table}` VALUES\n";

            $first = true;
            foreach ($rows as $row) {
                $values = [];
                foreach ((array) $row as $value) {
                    if ($value === null) {
                        $values[] = 'NULL';
                    } elseif (is_int($value) || is_float($value)) {
                        $values[] = $value;
                    } else {
                        $values[] = "'" . str_replace("'", "''", (string) $value) . "'";
                    }
                }
                $prefix = $first ? '  ' : ', ';
                $output .= $prefix . '(' . implode(', ', $values) . ")\n";
                $first = false;
            }

            $output .= ";\n\n";
        }

        return $output;
    }

    private function calculateDbSize(): int
    {
        $connection = DB::connection()->getDriverName();

        if ($connection === 'sqlite') {
            $path = database_path('database.sqlite');
            return file_exists($path) ? (int) filesize($path) : 0;
        }

        try {
            $result = DB::selectOne(
                'SELECT ROUND(SUM(data_length + index_length), 0) AS size
                 FROM information_schema.tables
                 WHERE table_schema = ?',
                [DB::getDatabaseName()]
            );
            return (int) ($result->size ?? 0);
        } catch (\Throwable) {
            return 0;
        }
    }

    private function getMigrationCount(): int
    {
        try {
            return DB::table('migrations')->count();
        } catch (\Throwable) {
            return 0;
        }
    }

    private function formatBytes(int $bytes): string
    {
        if ($bytes < 1024) {
            return $bytes . ' B';
        }
        if ($bytes < 1024 * 1024) {
            return round($bytes / 1024, 1) . ' KB';
        }
        return round($bytes / (1024 * 1024), 1) . ' MB';
    }

    private function recordFailure(?int $userId, string $filename, string $relativePath, int $dbSize, string $error): BackupEntry
    {
        return BackupEntry::create([
            'filename' => $filename,
            'file_path' => $relativePath,
            'file_size' => 0,
            'db_size' => $dbSize,
            'checksum' => '',
            'app_version' => config('app.version', '1.0.0'),
            'laravel_version' => app()->version(),
            'migration_count' => $this->getMigrationCount(),
            'status' => 'failed',
            'created_by' => $userId,
        ]);
    }
}
