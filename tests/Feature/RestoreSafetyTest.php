<?php

namespace Tests\Feature;

use App\Models\BackupEntry;
use App\Models\Student;
use App\Services\BackupService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use ReflectionMethod;
use Tests\TestCase;

/**
 * Sprint 3.3 — restore safety (R10).
 *
 * A restore drops every table, so the pre-flight gates (checksum, dump
 * validity) must reject bad backups while the database is still intact, and
 * post-restore validation must confirm the restored state. These tests never
 * reach the destructive drop path — they prove the gates fire first.
 */
class RestoreSafetyTest extends TestCase
{
    use RefreshDatabase;

    private const FILENAME = 'backup-safety-test.sql.gz';

    protected function setUp(): void
    {
        parent::setUp();

        Student::create([
            'name'        => 'Sentinel',
            'father_name' => 'Guard',
            'status'      => 'active',
        ]);
    }

    private function writeBackupFile(string $contents): string
    {
        $path = storage_path('app/backups/' . self::FILENAME);
        @mkdir(dirname($path), 0755, true);
        file_put_contents($path, $contents);
        return $path;
    }

    private function makeEntry(string $checksum, int $migrationCount = 1): BackupEntry
    {
        return BackupEntry::create([
            'filename'        => self::FILENAME,
            'file_path'       => 'backups/' . self::FILENAME,
            'file_size'       => 1,
            'db_size'         => 1,
            'checksum'        => $checksum,
            'app_version'     => '1.0.0',
            'laravel_version' => app()->version(),
            'migration_count' => $migrationCount,
            'status'          => 'created',
        ]);
    }

    /**
     * A failed restore must leave the database exactly as it was.
     */
    private function assertDatabaseIntact(): void
    {
        $this->assertSame(1, Student::count());
        $this->assertDatabaseHas('students', ['name' => 'Sentinel']);
    }

    public function test_restore_rejects_missing_file_without_touching_database(): void
    {
        $entry = $this->makeEntry('deadbeef');
        $entry->update(['file_path' => 'backups/does-not-exist.sql.gz']);

        $this->expectException(\RuntimeException::class);
        $this->expectExceptionMessage('not found');

        app(BackupService::class)->restore($entry);
    }

    public function test_restore_rejects_checksum_mismatch_before_touching_database(): void
    {
        $path = $this->writeBackupFile(gzencode('-- not the real dump'));
        $entry = $this->makeEntry(hash('sha256', 'different content'));

        try {
            app(BackupService::class)->restore($entry);
            $this->fail('Expected a checksum-mismatch exception.');
        } catch (\RuntimeException $e) {
            $this->assertStringContainsString('Checksum mismatch', $e->getMessage());
        }

        $this->assertDatabaseIntact();
        @unlink($path);
    }

    public function test_restore_rejects_corrupt_archive_before_touching_database(): void
    {
        $contents = 'this is not gzip data';
        $path = $this->writeBackupFile($contents);
        $entry = $this->makeEntry(hash('sha256', $contents));

        try {
            app(BackupService::class)->restore($entry);
            $this->fail('Expected a decompress exception.');
        } catch (\RuntimeException $e) {
            $this->assertStringContainsString('Failed to decompress', $e->getMessage());
        }

        $this->assertDatabaseIntact();
        @unlink($path);
    }

    public function test_restore_rejects_dump_without_table_structure_before_touching_database(): void
    {
        $contents = gzencode('SELECT 1;');
        $path = $this->writeBackupFile($contents);
        $entry = $this->makeEntry(hash('sha256', $contents));

        try {
            app(BackupService::class)->restore($entry);
            $this->fail('Expected a dump-validation exception.');
        } catch (\RuntimeException $e) {
            $this->assertStringContainsString('valid table structure', $e->getMessage());
        }

        $this->assertDatabaseIntact();
        @unlink($path);
    }

    public function test_post_restore_validation_flags_migration_count_mismatch(): void
    {
        $entry = $this->makeEntry('ignored', migrationCount: 999999);

        $method = new ReflectionMethod(BackupService::class, 'validateRestoredDatabase');
        $method->setAccessible(true);

        $this->expectException(\RuntimeException::class);
        $this->expectExceptionMessage('Migration count mismatch');

        $method->invoke(app(BackupService::class), $entry);
    }
}
