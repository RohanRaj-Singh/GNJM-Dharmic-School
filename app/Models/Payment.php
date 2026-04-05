<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class Payment extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'fee_id',
        'amount_paid',
        'paid_at',
    ];

    protected $casts = [
        'paid_at' => 'datetime',
        'deleted_at' => 'datetime',
    ];

    public function fee(): BelongsTo
    {
        return $this->belongsTo(Fee::class);
    }
}
