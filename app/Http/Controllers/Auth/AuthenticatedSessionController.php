<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;

class AuthenticatedSessionController extends Controller
{
    /**
     * Show login page
     */
    public function create(Request $request)
    {
        // If user is already logged in, pass their info to show logout modal
        $user = null;
        if (auth()->check()) {
            $authUser = auth()->user();
            $user = [
                'id' => $authUser->id,
                'name' => $authUser->name,
                'username' => $authUser->username,
                'email' => $authUser->email,
                'role' => $authUser->role,
            ];
        }
        
        return Inertia::render('Splash', [
            'user' => $user,
        ]);
    }

    /**
     * Handle login
     */
    public function store(Request $request)
    {
        $request->validate([
            'login' => ['required', 'string', 'max:255'],
            'password' => ['required', 'string'],
            'remember' => ['nullable', 'boolean'],
        ]);

        $this->ensureIsNotRateLimited($request);

        $login = trim((string) $request->input('login'));
        $field = filter_var($request->login, FILTER_VALIDATE_EMAIL)
            ? 'email'
            : 'username';

        if (! Auth::attempt([
            $field => $login,
            'password' => $request->password,
            'is_active' => true,
        ], $request->boolean('remember'))) {
            RateLimiter::hit($this->throttleKey($request));

            throw ValidationException::withMessages([
                'login' => 'Invalid credentials',
            ]);
        }

        RateLimiter::clear($this->throttleKey($request));
        $request->session()->regenerate();

        $user = Auth::user();

        // Always redirect to role-appropriate dashboard - no user-controlled redirect
        return redirect()->to(
            match ($user->role) {
                'admin' => '/admin/dashboard',
                'accountant' => '/accountant',
                'teacher' => '/teacher',
                default => '/',
            }
        );
    }

    /**
     * Check if redirect URL is safe (no open redirect vulnerability)
     */
    private function isSafeRedirect(?string $url): bool
    {
        if (!$url) return false;
        
        $url = trim($url);
        
        if (str_starts_with($url, '/') && !str_starts_with($url, '//')) {
            $blocked = ['http://', 'https://', 'ftp://', 'javascript:'];
            foreach ($blocked as $blockedPrefix) {
                if (str_starts_with(strtolower($url), $blockedPrefix)) {
                    return false;
                }
            }
            return true;
        }
        
        return false;
    }

    /**
     * Logout
     */
    public function destroy(Request $request)
    {
        $user = Auth::user();
        $userId = $user?->id;
        $userRole = $user?->role;

        Auth::logout();

        $request->session()->invalidate();
        $request->session()->regenerateToken();

        // Log the logout event
        \Illuminate\Support\Facades\Log::info('User logged out', [
            'user_id' => $userId,
            'user_role' => $userRole,
            'ip' => $request->ip(),
        ]);

        // Return redirect with no-cache headers
        return redirect('/')
            ->withHeaders([
                'Cache-Control' => 'no-store, no-cache, must-revalidate, private',
                'Pragma' => 'no-cache',
                'Expires' => '0',
            ]);
    }

    private function ensureIsNotRateLimited(Request $request): void
    {
        if (!RateLimiter::tooManyAttempts($this->throttleKey($request), 5)) {
            return;
        }

        $seconds = RateLimiter::availableIn($this->throttleKey($request));

        throw ValidationException::withMessages([
            'login' => trans('auth.throttle', [
                'seconds' => $seconds,
                'minutes' => (int) ceil($seconds / 60),
            ]),
        ]);
    }

    private function throttleKey(Request $request): string
    {
        return Str::lower((string) $request->input('login')) . '|' . $request->ip();
    }
}
