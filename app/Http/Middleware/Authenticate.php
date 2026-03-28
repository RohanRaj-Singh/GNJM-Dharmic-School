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
            // Return redirect to login - this is the proper way
            return route('login');
        }
        
        return null;
    }
}
