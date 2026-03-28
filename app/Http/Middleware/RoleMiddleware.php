<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class RoleMiddleware
{
    /**
     * Handle an incoming request.
     * Enforces role-based access control on server-side
     */
    public function handle(Request $request, Closure $next, ...$roles): Response
    {
        $user = $request->user();

        // If no user is authenticated, redirect to login
        if (!$user) {
            return redirect()->route('login');
        }

        // Check if user has the required role
        if (!in_array($user->role, $roles)) {
            // Log unauthorized access attempt
            \Illuminate\Support\Facades\Log::warning('Unauthorized access attempt', [
                'user_id' => $user->id,
                'user_role' => $user->role,
                'required_roles' => $roles,
                'path' => $request->path(),
            ]);

            // Redirect to role-appropriate page
            return match ($user->role) {
                'admin' => redirect()->route('admin.dashboard'),
                'accountant' => redirect('/accountant'),
                'teacher' => redirect()->route('teacher.dashboard'),
                default => abort(403, 'Unauthorized access'),
            };
        }

        return $next($request);
    }

}
