<?php

// app/Models/ReportPreset.php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ReportPreset extends Model
{
    protected $fillable = [
        'name',
        'report_type',
        'filters',
        'columns',
        'user_id',
    ];

    protected $casts = [
        'filters' => 'array',
        'columns' => 'array',
    ];
}
