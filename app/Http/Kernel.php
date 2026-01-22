<?php

namespace App\Http;

use Illuminate\Foundation\Http\Kernel as HttpKernel;

/* -------- Core Laravel Middleware -------- */
use Illuminate\Http\Middleware\HandleCors;
use Illuminate\Foundation\Http\Middleware\ValidatePostSize;
use Illuminate\Foundation\Http\Middleware\ConvertEmptyStringsToNull;

/* -------- Web Middleware -------- */
use App\Http\Middleware\EncryptCookies;
use Illuminate\Cookie\Middleware\AddQueuedCookiesToResponse;
use Illuminate\Session\Middleware\StartSession;
use Illuminate\View\Middleware\ShareErrorsFromSession;
use App\Http\Middleware\VerifyCsrfToken;
use Illuminate\Routing\Middleware\SubstituteBindings;

/* -------- Auth -------- */
use App\Http\Middleware\Authenticate;
use App\Http\Middleware\TrimStrings;

/* -------- Custom -------- */
use App\Http\Middleware\FakeAuthForReports;

class Kernel extends HttpKernel
{
    /*
    |--------------------------------------------------------------------------
    | Global HTTP middleware
    |--------------------------------------------------------------------------
    */
    protected $middleware = [
        HandleCors::class,
        ValidatePostSize::class,
        TrimStrings::class,
        ConvertEmptyStringsToNull::class,
    ];

    /*
    |--------------------------------------------------------------------------
    | Middleware Groups
    |--------------------------------------------------------------------------
    */
    protected $middlewareGroups = [
        'web' => [
            EncryptCookies::class,
            AddQueuedCookiesToResponse::class,
            StartSession::class,
            ShareErrorsFromSession::class,
            VerifyCsrfToken::class,
            SubstituteBindings::class,
        ],

        'api' => [
            SubstituteBindings::class,
        ],
    ];

    /*
    |--------------------------------------------------------------------------
    | Route Middleware
    |--------------------------------------------------------------------------
    */
    protected $routeMiddleware = [
        'auth' => Authenticate::class,

        // 🔥 TEMP — auto-login first user for reports testing
        'fake.auth.reports' => FakeAuthForReports::class,
    ];
}
