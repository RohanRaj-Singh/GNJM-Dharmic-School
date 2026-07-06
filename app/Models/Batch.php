<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * An admission cohort, e.g. "Batch 2025".
 *
 * A Batch is assigned when a student first joins the institution and
 * remains with them throughout their academic journey. It is primarily
 * used for identification, cohort reporting, and calculating expected
 * pass-out years.
 */
class Batch extends Model
{
    protected $fillable = [
        'name',
        'admission_year',
    ];

    protected $casts = [
        'admission_year' => 'integer',
    ];

    public function students(): HasMany
    {
        return $this->hasMany(Student::class);
    }
}
