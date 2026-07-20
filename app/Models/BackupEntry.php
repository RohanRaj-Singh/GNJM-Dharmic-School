<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class BackupEntry extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'filename',
        'file_path',
        'file_size',
        'db_size',
        'checksum',
        'app_version',
        'laravel_version',
        'migration_count',
        'status',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'file_size' => 'integer',
            'db_size' => 'integer',
            'migration_count' => 'integer',
            'created_at' => 'datetime',
        ];
    }

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function getFullPath(): string
    {
        return storage_path('app/' . ltrim($this->file_path, '/'));
    }

    public function fileExists(): bool
    {
        return file_exists($this->getFullPath());
    }
}
