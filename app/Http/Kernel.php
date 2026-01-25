<?php

namespace App\Http;

use Illuminate\Foundation\Http\Kernel as HttpKernel;

/* -------- Core -------- */
use Illuminate\Http\Middleware\HandleCors;
use Illuminate\Foundation\Http\Middleware\ValidatePostSize;
use Illuminate\Foundation\Http\Middleware\ConvertEmptyStringsToNull;

/* -------- Web -------- */
use App\Http\Middleware\EncryptCookies;
use Illuminate\Cookie\Middleware\AddQueuedCookiesToResponse;
use Illuminate\Session\Middleware\StartSession;
use Illuminate\View\Middleware\ShareErrorsFromSession;
use App\Http\Middleware\VerifyCsrfToken;
use Illuminate\Routing\Middleware\SubstituteBindings;
use App\Http\Middleware\RedirectIfAuthenticated;

/* -------- Auth -------- */
use App\Http\Middleware\Authenticate;
use App\Http\Middleware\TrimStrings;
//use App\Http\Middleware\DebugAuthMiddleware;

/* -------- Custom -------- */
use App\Http\Middleware\RoleMiddleware;
use Symfony\Component\ErrorHandler\Debug;

class Kernel extends HttpKernel
{
    protected $middleware = [
        HandleCors::class,
        ValidatePostSize::class,
        TrimStrings::class,
        ConvertEmptyStringsToNull::class,
    ];

    protected $middlewareGroups = [
        'web' => [
            EncryptCookies::class,
            AddQueuedCookiesToResponse::class,
            StartSession::class,
            ShareErrorsFromSession::class,
            VerifyCsrfToken::class,
            SubstituteBindings::class,
           // Authenticate::class,
           DebugAuthMiddleware::class,
        ],

        'api' => [
            SubstituteBindings::class,
        ],
    ];

    protected $middlewareAliases = [
    'auth' => \App\Http\Middleware\Authenticate::class,
    'guest' => \App\Http\Middleware\RedirectIfAuthenticated::class,
    'role' => \App\Http\Middleware\RoleMiddleware::class,
];
}

