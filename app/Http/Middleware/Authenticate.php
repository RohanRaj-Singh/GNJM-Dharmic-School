<?php

namespace App\Http\Middleware;

use Illuminate\Auth\Middleware\Authenticate as Middleware;
use Illuminate\Http\Request;
use Illuminate\Http\RedirectResponse;

class Authenticate extends Middleware
{
    /**
     * Handle an unauthenticated request.
     */
    protected function redirectTo($request): ?string
    {
        if (!$request->expectsJson()) {
            $request->session()->flash('error', 'Your session has expired. Please log in again.');

            return route('login');
        }
        
        return null;
    }
}
