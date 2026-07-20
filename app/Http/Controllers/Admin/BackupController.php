<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\BackupEntry;
use App\Services\BackupService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class BackupController extends Controller
{
    public function __construct(private readonly BackupService $backupService)
    {
    }

    public function overview(): \Illuminate\Http\JsonResponse
    {
        return response()->json($this->backupService->getOverview());
    }

    public function history(): \Illuminate\Http\JsonResponse
    {
        return response()->json($this->backupService->getHistory());
    }

    public function create(): \Illuminate\Http\JsonResponse
    {
        try {
            $entry = $this->backupService->create(auth()->id());

            if ($entry->status === 'failed') {
                return response()->json([
                    'success' => false,
                    'message' => 'Backup creation failed. Check logs for details.',
                ], 500);
            }

            return response()->json([
                'success' => true,
                'message' => 'Backup created successfully.',
                'backup' => [
                    'id' => $entry->id,
                    'filename' => $entry->filename,
                    'created_at' => $entry->created_at?->format('M d, Y h:i A'),
                    'created_by' => auth()->user()?->name ?? 'System',
                    'db_size' => $this->formatBytes($entry->db_size),
                    'backup_size' => $this->formatBytes($entry->file_size),
                    'status' => $entry->status,
                    'app_version' => $entry->app_version,
                    'laravel_version' => $entry->laravel_version,
                    'migration_count' => $entry->migration_count,
                    'checksum' => substr($entry->checksum, 0, 12) . '...',
                ],
            ]);
        } catch (\Throwable $e) {
            Log::channel('backup')->error('Backup creation exception', [
                'error' => $e->getMessage(),
            ]);
            return response()->json([
                'success' => false,
                'message' => 'Backup failed: ' . $e->getMessage(),
            ], 500);
        }
    }

    public function download(int $id): \Symfony\Component\HttpFoundation\BinaryFileResponse|\Illuminate\Http\JsonResponse
    {
        $entry = BackupEntry::findOrFail($id);

        if (!$entry->fileExists()) {
            return response()->json(['message' => 'Backup file not found on disk.'], 404);
        }

        Log::channel('backup')->info('Backup downloaded', ['filename' => $entry->filename]);

        return response()->download($entry->getFullPath(), $entry->filename);
    }

    public function restore(int $id): \Illuminate\Http\JsonResponse
    {
        $entry = BackupEntry::findOrFail($id);

        try {
            $this->backupService->restore($entry);

            return response()->json([
                'success' => true,
                'message' => 'Database restored successfully. Please refresh the application.',
            ]);
        } catch (\Throwable $e) {
            Log::channel('backup')->error('Restore exception', [
                'filename' => $entry->filename,
                'error' => $e->getMessage(),
            ]);
            return response()->json([
                'success' => false,
                'message' => 'Restore failed: ' . $e->getMessage(),
            ], 500);
        }
    }

    public function destroy(int $id): \Illuminate\Http\JsonResponse
    {
        $entry = BackupEntry::findOrFail($id);

        try {
            $this->backupService->delete($entry);
            return response()->json([
                'success' => true,
                'message' => 'Backup deleted.',
            ]);
        } catch (\Throwable $e) {
            return response()->json([
                'success' => false,
                'message' => 'Delete failed: ' . $e->getMessage(),
            ], 500);
        }
    }

    public function compatibility(int $id): \Illuminate\Http\JsonResponse
    {
        $entry = BackupEntry::findOrFail($id);
        return response()->json($this->backupService->checkCompatibility($entry));
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
}
