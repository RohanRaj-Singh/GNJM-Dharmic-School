<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class FeeRatePeriod extends Model
{
    protected $fillable = [
        'scope_type',
        'scope_id',
        'amount',
        'effective_from',
        'effective_to',
    ];

    protected $casts = [
        'effective_from' => 'date',
        'effective_to' => 'date',
    ];

    public function schoolClass(): BelongsTo
    {
        return $this->belongsTo(SchoolClass::class, 'scope_id');
    }

    public function section(): BelongsTo
    {
        return $this->belongsTo(Section::class, 'scope_id');
    }
}
