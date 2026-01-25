<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;

class DebugAuthMiddleware
{
    public function handle($request, Closure $next)
    {
        Log::info('DEBUG AUTH STATE', [
            'path' => $request->path(),
            'auth_check' => Auth::check(),
            'user_id' => Auth::id(),
            'user_role' => optional(Auth::user())->role,
            'session_id' => session()->getId(),
        ]);

        return $next($request);
    }
}
