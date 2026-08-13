<?php

namespace App\Providers;

use App\Models\User;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Vite;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        Vite::prefetch(concurrency: 3);

        // Sprint 3.1 — Admin is a super-user. The whole admin surface is already
        // behind role:admin middleware, so the policy layer treats admin as
        // authorized for everything and only the accountant/teacher roles fall
        // through to the granular rules in app/Policies.
        Gate::before(function ($user, $ability) {
            return $user instanceof User && $user->isAdmin() ? true : null;
        });
    }
}
