<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {

        // Web middleware stack
        //
        // We append only the Inertia + preloaded-asset middlewares on top of
        // the Laravel 12 default web group (EncryptCookies, StartSession,
        // ShareErrorsFromSession, VerifyCsrfToken, SubstituteBindings).
        // The default VerifyCsrfToken handles the X-XSRF-TOKEN header
        // correctly: axios sends the cookie value as-is, Laravel decrypts
        // the encrypted value, strips the CookieValuePrefix HMAC, and
        // compares to the session token. No custom subclass required.
        $middleware->web(append: [
            \App\Http\Middleware\HandleInertiaRequests::class,
            \Illuminate\Http\Middleware\AddLinkHeadersForPreloadedAssets::class,
        ]);

        // Route middleware aliases
        $middleware->alias([
            'role' => \App\Http\Middleware\RoleMiddleware::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        // Default Laravel exception handling. The framework's built-in
        // TokenMismatchException renderer redirects to /login with a
        // flash message, which is what we want.
    })
    ->create();
