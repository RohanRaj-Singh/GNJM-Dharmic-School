<?php

namespace Tests\Unit;

use App\Models\BackupEntry;
use App\Services\BackupService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Pins BackupService (Sprint 4.3):
 *
 *   - create() writes a real .sql.gz file + a 'created' BackupEntry
 *   - restore() pre-flight safety gates (R10) throw BEFORE any destructive
 *     table drop: missing file, checksum mismatch, empty dump, non-SQL dump
 *   - delete() removes the file and the entry
 *   - getOverview() / getHistory() shape
 *   - checkCompatibility() surfaces age / app_version / laravel_version /
 *     migration_count warnings
 *
 * The restore gates are exercised with a real on-disk file whose stored
 * checksum/content is deliberately corrupted — each gate throws before the
 * destructive DB step, so the test database is never touched.
 *
 * Sprint 6.1 — closes the missing service-test gap for BackupService.
 */
class BackupServiceTest extends TestCase
{
    use RefreshDatabase;

    private BackupService $service;

    /** @var array<int, BackupEntry> entries created during the test (cleaned in tearDown) */
    private array $createdEntries = [];

    protected function setUp(): void
    {
        parent::setUp();
        $this->service = app(BackupService::class);
        $this->createdEntries = [];
    }

    protected function tearDown(): void
    {
        foreach ($this->createdEntries as $entry) {
            $path = $entry->getFullPath();
            if (file_exists($path)) {
                @unlink($path);
            }
            if ($entry->exists) {
                $entry->delete();
            }
        }
        parent::tearDown();
    }

    /* ───────────────────────────────────────────────
       create
       ─────────────────────────────────────────────── */

    public function test_create_writes_gz_file_and_created_entry(): void
    {
        $entry = $this->createBackup();

        $this->assertSame('created', $entry->status);
        $this->assertMatchesRegularExpression('/^backup-\d{4}-\d{2}-\d{2}-\d{6}\.sql\.gz$/', $entry->filename);
        $this->assertTrue($entry->fileExists(), 'backup file should exist on disk');
        $this->assertGreaterThan(0, $entry->file_size);
        $this->assertMatchesRegularExpression('/^[0-9a-f]{64}$/', $entry->checksum);
        $this->assertGreaterThan(0, $entry->migration_count);
        $this->assertSame(config('app.version', '1.0.0'), $entry->app_version);
    }

    /* ───────────────────────────────────────────────
       restore — pre-flight safety gates (R10)
       ─────────────────────────────────────────────── */

    public function test_restore_rejects_missing_file(): void
    {
        $entry = new BackupEntry([
            'filename' => 'backup-missing.sql.gz',
            'file_path' => 'backups/does-not-exist.sql.gz',
            'status' => 'created',
        ]);

        $this->expectException(\RuntimeException::class);
        $this->expectExceptionMessage('Backup file not found on disk.');

        $this->service->restore($entry);
    }

    public function test_restore_rejects_checksum_mismatch(): void
    {
        $entry = $this->createBackup();
        $entry->checksum = str_repeat('0', 64);
        $entry->save();

        $this->expectException(\RuntimeException::class);
        $this->expectExceptionMessage('Checksum mismatch');

        $this->service->restore($entry);
    }

    public function test_restore_rejects_empty_dump(): void
    {
        $entry = $this->createBackup();

        // Overwrite the on-disk file with gzip of an empty string, then sync
        // the stored checksum so only the dump-validation gate can fire.
        $content = gzencode('');
        file_put_contents($entry->getFullPath(), $content);
        $entry->checksum = hash('sha256', $content);
        $entry->save();

        $this->expectException(\RuntimeException::class);
        $this->expectExceptionMessage('Backup file is empty');

        $this->service->restore($entry);
    }

    public function test_restore_rejects_non_sql_dump(): void
    {
        $entry = $this->createBackup();

        // gzip of text that is not a MySQL dump (no DROP/CREATE TABLE).
        $content = gzencode("SELECT 1;\n-- this is not a table dump\n");
        file_put_contents($entry->getFullPath(), $content);
        $entry->checksum = hash('sha256', $content);
        $entry->save();

        $this->expectException(\RuntimeException::class);
        $this->expectExceptionMessage('does not contain a valid table structure');

        $this->service->restore($entry);
    }

    public function test_restore_rejects_corrupt_gzip_archive(): void
    {
        $entry = $this->createBackup();

        // Truncate the archive (keep the checksum matching the *new* bytes) so
        // the gzdecode step fails cleanly instead of the checksum gate.
        $content = "this is not gzip data";
        file_put_contents($entry->getFullPath(), $content);
        $entry->checksum = hash('sha256', $content);
        $entry->save();

        $this->expectException(\RuntimeException::class);
        $this->expectExceptionMessage('Failed to decompress');

        $this->service->restore($entry);
    }

    /* ───────────────────────────────────────────────
       delete
       ─────────────────────────────────────────────── */

    public function test_delete_removes_file_and_entry(): void
    {
        $entry = $this->createBackup();
        $path = $entry->getFullPath();
        $this->assertTrue(file_exists($path));

        $this->service->delete($entry);

        $this->assertFalse(file_exists($path));
        $this->assertNull(BackupEntry::find($entry->id));
    }

    /* ───────────────────────────────────────────────
       getOverview + getHistory
       ─────────────────────────────────────────────── */

    public function test_get_overview_shape_after_create(): void
    {
        $this->createBackup();

        $overview = $this->service->getOverview();

        $this->assertArrayHasKey('db_size', $overview);
        $this->assertArrayHasKey('db_size_formatted', $overview);
        $this->assertArrayHasKey('last_backup', $overview);
        $this->assertArrayHasKey('backup_count', $overview);
        $this->assertArrayHasKey('estimated_restore_time', $overview);

        $this->assertIsInt($overview['db_size']);
        $this->assertGreaterThan(0, $overview['backup_count']);
        $this->assertNotNull($overview['last_backup']);
    }

    public function test_get_history_shape_after_create(): void
    {
        $this->createBackup();

        $history = $this->service->getHistory();

        $this->assertNotEmpty($history);
        $first = $history[0];
        $this->assertArrayHasKey('id', $first);
        $this->assertArrayHasKey('filename', $first);
        $this->assertArrayHasKey('created_at', $first);
        $this->assertArrayHasKey('created_by', $first);
        $this->assertArrayHasKey('db_size', $first);
        $this->assertArrayHasKey('backup_size', $first);
        $this->assertArrayHasKey('status', $first);
        $this->assertArrayHasKey('app_version', $first);
        $this->assertArrayHasKey('laravel_version', $first);
        $this->assertArrayHasKey('migration_count', $first);
        $this->assertArrayHasKey('checksum', $first);

        $this->assertSame('created', $first['status']);
        $this->assertMatchesRegularExpression('/^[0-9a-f]{12}\.\.\.$/', $first['checksum']);
    }

    /* ───────────────────────────────────────────────
       checkCompatibility
       ─────────────────────────────────────────────── */

    public function test_check_compatibility_returns_empty_for_current_entry(): void
    {
        $entry = $this->createBackup();

        $this->assertSame([], $this->service->checkCompatibility($entry));
    }

    public function test_check_compatibility_warns_on_age_and_version_drift(): void
    {
        $entry = new BackupEntry([
            'filename' => 'backup-old.sql.gz',
            'file_path' => 'backups/backup-old.sql.gz',
            'file_size' => 100,
            'db_size' => 100,
            'checksum' => str_repeat('a', 64),
            'app_version' => '0.9.0',
            'laravel_version' => '99.0.0',
            'migration_count' => 999999,
            'status' => 'created',
        ]);
        $entry->created_at = now()->subDays(60);
        $entry->save();

        $warnings = $this->service->checkCompatibility($entry);

        $types = array_column($warnings, 'type');
        $this->assertContains('age', $types);
        $this->assertContains('app_version', $types);
        $this->assertContains('laravel_version', $types);
        $this->assertContains('migration_count', $types);

        $this->assertSame(4, count($warnings));
    }

    public function test_check_compatibility_does_not_warn_on_fresh_recent_entry(): void
    {
        $entry = new BackupEntry([
            'filename' => 'backup-fresh.sql.gz',
            'file_path' => 'backups/backup-fresh.sql.gz',
            'file_size' => 100,
            'db_size' => 100,
            'checksum' => str_repeat('b', 64),
            'app_version' => config('app.version', '1.0.0'),
            'laravel_version' => app()->version(),
            'migration_count' => $this->migrationCount(),
            'status' => 'created',
        ]);
        $entry->created_at = now();
        $entry->save();

        $this->assertSame([], $this->service->checkCompatibility($entry));
    }

    /* ───────────────────────────────────────────────
       Helpers
       ─────────────────────────────────────────────── */

    private function createBackup(): BackupEntry
    {
        $entry = $this->service->create();
        $this->createdEntries[] = $entry;

        return $entry;
    }

    private function migrationCount(): int
    {
        return \DB::table('migrations')->count();
    }
}
