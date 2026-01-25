<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class RoleMiddleware
{
    /**
     * Handle an incoming request.
     *
     * @param  \Closure(\Illuminate\Http\Request): (\Symfony\Component\HttpFoundation\Response)  $next
     */
    public function handle(Request $request, Closure $next, ...$roles): Response
{
    $user = $request->user();

    if (!$user) {
        return redirect()->route('login');
    }

    if (!in_array($user->role, $roles)) {
        return match ($user->role) {
            'admin' => redirect()->route('admin.dashboard'),
            'accountant' => redirect('/accountant'),
            'teacher' => redirect()->route('teacher.dashboard'),
            default => abort(403),
        };
    }

    return $next($request);
}

}
