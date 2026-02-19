<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\Response;

class EnsureSessionAfterCacheClear
{
    public function handle(Request $request, Closure $next): Response
    {
        if (!Auth::check()) {
            return $next($request);
        }

        $globalStamp = Cache::rememberForever('auth_session_guard_stamp', fn () => (string) Str::uuid());
        $sessionStamp = (string) $request->session()->get('auth_session_guard_stamp', '');

        if ($sessionStamp === '') {
            $request->session()->put('auth_session_guard_stamp', $globalStamp);
            return $next($request);
        }

        if ($sessionStamp !== $globalStamp) {
            Auth::logout();
            $request->session()->invalidate();
            $request->session()->regenerateToken();

            return redirect()->route('login')->withErrors([
                'auth' => 'Session expired after system cache reset. Please log in again.',
            ]);
        }

        return $next($request);
    }
}

