<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
//use Illuminate\Container\Attributes\Log;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Illuminate\Support\Facades\Log;

class AuthenticatedSessionController extends Controller
{
    /**
     * Show login page
     */
    public function create()
    {
        return Inertia::render('Splash');
    }

    /**
     * Handle login
     */
    public function store(Request $request)
    {
       // dd('HIT MY LOGIN CONTROLLER 2');

        Log::info('Login Hit', request()->all());
        $request->validate([
            'login' => 'required|string',
            'password' => 'required|string',
        ]);

        $field = filter_var($request->login, FILTER_VALIDATE_EMAIL)
            ? 'email'
            : 'username';

        if (! Auth::attempt([
            $field => $request->login,
            'password' => $request->password,
            'is_active' => true,
        ])) {
            throw ValidationException::withMessages([
                'login' => 'Invalid credentials',
            ]);
        }

        $request->session()->regenerate();

        $user = Auth::user();

        return redirect()->intended(
            match ($user->role) {
                'admin' => route('admin.dashboard'),
                'accountant' => '/accountant',
                'teacher' => route('teacher.dashboard'),
                default => '/',
            }
        );
    }

    /**
     * Logout
     */
    public function destroy(Request $request)
    {
        Auth::logout();

        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return redirect('/');
    }
}
