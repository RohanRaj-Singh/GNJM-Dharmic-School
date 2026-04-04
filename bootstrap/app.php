<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;
use Illuminate\Session\TokenMismatchException;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {

    // Web middleware stack
    $middleware->web(append: [
        \App\Http\Middleware\HandleInertiaRequests::class,
        \Illuminate\Http\Middleware\AddLinkHeadersForPreloadedAssets::class,
    ]);

    // 🔑 Route middleware aliases (Laravel 12 way)
    $middleware->alias([
        'role' => \App\Http\Middleware\RoleMiddleware::class,
        'session.cache_guard' => \App\Http\Middleware\EnsureSessionAfterCacheClear::class,
    ]);
})

    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->render(function (TokenMismatchException $exception, Request $request) {
            if ($request->expectsJson()) {
                return response()->json([
                    'message' => 'Session expired. Please log in again.',
                ], 419);
            }

            return redirect()
                ->guest(route('login'))
                ->with('error', 'Your session has expired. Please log in again.');
        });
    })->create();
