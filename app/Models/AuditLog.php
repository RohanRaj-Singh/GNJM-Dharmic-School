<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphTo;

/**
 * Append-only audit log (Sprint 3.2).
 *
 * One row per significant fee/attendance mutation. Use the static record()
 * helper at the mutation site; never update or delete existing rows — this
 * model is write-once by design (no timestamps/updated_at).
 */
class AuditLog extends Model
{
    public const ACTION_FEE_COLLECTED      = 'fee.collected';
    public const ACTION_FEE_DECOLLECTED    = 'fee.de_collected';
    public const ACTION_FEE_CUSTOM_CREATED = 'fee.custom_created';
    public const ACTION_FEE_CUSTOM_UPDATED = 'fee.custom_updated';
    public const ACTION_FEE_CUSTOM_DELETED = 'fee.custom_deleted';
    public const ACTION_FEE_MONTHLY_GENERATED = 'fee.monthly_generated';
    public const ACTION_ATTENDANCE_MARKED  = 'attendance.marked';

    public $timestamps = false;

    protected $fillable = [
        'user_id',
        'action',
        'auditable_type',
        'auditable_id',
        'payload',
        'created_at',
    ];

    protected $casts = [
        'payload'     => 'array',
        'created_at'  => 'datetime',
    ];

    public function auditable(): MorphTo
    {
        return $this->morphTo();
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Write an audit entry. The actor is the authenticated user when present;
     * system tasks (e.g. scheduled fee generation) fall back to null.
     */
    public static function record(
        string $action,
        ?Model $auditable = null,
        array $payload = [],
    ): self {
        return static::create([
            'user_id'        => auth()->id(),
            'action'         => $action,
            'auditable_type' => $auditable ? $auditable->getMorphClass() : null,
            'auditable_id'   => $auditable?->getKey(),
            'payload'        => $payload ?: null,
            'created_at'     => now(),
        ]);
    }
}
