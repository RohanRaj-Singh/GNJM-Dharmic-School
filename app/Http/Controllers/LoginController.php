<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;
class LoginController extends Controller
{
 public function authenticate(Request $request)
{
    Log::info('Login Hit', request()->all());
    $request->validate([
        'login' => 'required|string',
        'password' => 'required|string',
    ]);

    $loginType = filter_var($request->login, FILTER_VALIDATE_EMAIL)
        ? 'email'
        : 'username';

    if (!Auth::attempt([
        $loginType => $request->login,
        'password' => $request->password,
        'is_active' => true,
    ])) {
        throw ValidationException::withMessages([
            'login' => 'Invalid credentials',
        ]);
    }

    $request->session()->regenerate();

    // 🔑 REDIRECT BASED ON ROLE
    $user = Auth::user();

    return redirect()->to(match ($user->role) {
        'admin'      => '/admin/dashboard',
        'accountant' => '/accountant',
        'teacher'    => '/attendance',
        default      => '/',
    });
}


    public function logout(Request $request)
    {
        Auth::logout();

        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return redirect('/');
    }
}
