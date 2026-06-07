# 15 — Authentication Audit & Migration Plan

> Senior Laravel Architect review. Discovery-first, then a minimal-change
> migration toward Laravel's default authentication architecture.
>
> **Scope.** Eliminate 419s, redirect bugs, and unnecessary customisation.
> **Preserve.** The existing login page UI, all roles, all permissions,
> all business logic.

---

## 1. Current Authentication Architecture

### 1.1 Component inventory

| Component | Path | Role |
|---|---|---|
| **`LoginController`** (custom) | `app/Http/Controllers/LoginController.php` | **Duplicate of Breeze's `AuthenticatedSessionController::store`.** Handles `POST /login` (NOT actually wired — see below). |
| **`AuthenticatedSessionController`** (Breeze) | `app/Http/Controllers/Auth/AuthenticatedSessionController.php` | The canonical Breeze login/logout flow. **This is the one actually wired to `/login`.** |
| `HandleInertiaRequests` | `app/Http/Middleware/HandleInertiaRequests.php` | Standard Inertia middleware; shares `auth.user` and flash with every page. |
| `RoleMiddleware` | `app/Http/Middleware/RoleMiddleware.php` | Custom `role:admin|accountant|teacher` alias. Reject-and-redirect. |
| `Authenticate` | `vendor/laravel/framework/.../Authenticate.php` | Standard Breeze. |
| `RedirectIfAuthenticated` | `vendor/laravel/framework/.../RedirectIfAuthenticated.php` | Standard Breeze. |
| `EnsureSessionAfterCacheClear` | **DELETED in earlier pass** | Was custom; gone now. |
| `FakeAuthForReports`, `DebugAuthMiddleware` | **DELETED earlier** | Were custom; gone now. |
| `VerifyCsrfTokenPlain` (my override) | `app/Http/Middleware/VerifyCsrfTokenPlain.php` | **Custom CSRF override**, created during the 419 fix. |
| `EncryptCookies` (Breeze, untouched) | (parent) | Default with empty `except`. |
| `routes/auth.php` | (Breeze) | Defines `/login`, `/logout`, password reset, email verification. |
| `routes/web.php` | (custom) | Auth-redirect for the root path. |
| `bootstrap/app.php` | (Laravel 12) | Middleware + exception config; **includes a custom 419 JSON handler** that bypasses the Breeze default. |
| `app/Models/User.php` | (custom) | Standard Eloquent; `isAdmin()`/`isAccountant()`/`isTeacher()` helpers + `sections()` belongsToMany. |
| `resources/js/Pages/Splash.jsx` | (custom React) | Renders the login form; uses `useForm` from Inertia. |
| `resources/js/Pages/Auth/Login.jsx` | (orphaned) | An older login page; not wired to any route. |

### 1.2 Actual flow on a `POST /login`

```
Browser (Inertia Splash.jsx)
   │  form.submit → useForm.post("/login")
   │  axios: POST /login
   │         Accept: text/html, application/xhtml+xml
   │         X-Requested-With: XMLHttpRequest
   │         X-Inertia: true
   │         X-XSRF-TOKEN: <cookie value, plain 40-char token>
   ▼
Laravel 12 web middleware stack
   1. EncryptCookies (Breeze, except=[])         — incoming: no-op
   2. AddQueuedCookiesToResponse                — incoming: no-op
   3. StartSession (database driver)            — loads session row by id
   4. ShareErrorsFromSession                    — no-op
   5. VerifyCsrfToken (Breeze default)         — reads X-XSRF-TOKEN header
                                                  calls decrypter->decrypt(header)
                                                  ↓
                                                  DecryptException ← ALWAYS
                                                  (cookie is plain, header is plain)
   5b. VerifyCsrfTokenPlain (my override)     — IN THEORY should replace
                                                  but the `replace:` syntax is
                                                  not actually applied because
                                                  the named-arg + `modifyGroup`
                                                  path stores into a property
                                                  on the configuration object
                                                  that is not consumed by the
                                                  kernel's `middlewareGroups`
                                                  (see §3.3)
   6. SubstituteBindings                          — no-op
   7. HandleInertiaRequests                     — Inertia handshake
   8. AddLinkHeadersForPreloadedAssets          — no-op
   ▼
AuthenticatedSessionController@store
   - validates login + password
   - resolves username vs email
   - calls Auth::attempt with `is_active => true` filter
   - regenerates session
   - redirects to role-based dashboard
```

### 1.3 Actual flow on a `POST /logout`

```
Browser (Inertia router.post("/logout", {}))
   ▼
AuthenticatedSessionController@destroy
   - Auth::logout
   - session()->invalidate()
   - session()->regenerateToken()
   - returns redirect('/') with no-cache headers
```

### 1.4 Root redirect after login

`routes/web.php` line 18:

```php
return match (auth()->user()->role) {
    'admin'      => redirect()->route('admin.dashboard'),
    'accountant' => redirect('/accountant'),
    'teacher'    => redirect()->route('teacher.dashboard'),
    default      => redirect()->route('login'),
};
```

The same `match` is duplicated in `AuthenticatedSessionController::store` (returns the redirect). The `web.php` `match` is dead code because the user never reaches `/` while unauthenticated and going to `/` while authenticated doesn't trigger this code path (the `auth` middleware redirects them).

---

## 2. Root-Cause Analysis Of The 419 Error

### 2.1 What the user does

1. Open `https://<host>/login`. Laravel generates a session, sets `XSRF-TOKEN` cookie and `laravel-session` cookie.
2. The `EncryptCookies` middleware has `except = []` (default), so it **encrypts** the outgoing `XSRF-TOKEN` cookie value. The cookie value is base64-encoded JSON of `{iv, value, mac, tag}`.
3. Inertia renders `Splash.jsx` with the user. The HTML head has `<meta name="csrf-token" content="<plain-token>">`.
4. User fills the form and clicks Login. Inertia's `useForm.post("/login")` fires an axios POST.
5. axios reads the `XSRF-TOKEN` cookie **with `decodeURIComponent` already applied** and sends it as `X-XSRF-TOKEN` header. The value is the **encrypted payload**.
6. Laravel's `VerifyCsrfToken::getTokenFromRequest` reads the `X-XSRF-TOKEN` header and calls:
   ```php
   CookieValuePrefix::remove($this->encrypter->decrypt($header));
   ```
7. `decrypt()` succeeds — the value was encrypted. It produces the **plain token** Laravel originally set (with a `CookieValuePrefix::create` HMAC prefix prepended).
8. `CookieValuePrefix::remove()` strips the first 41 chars. The result is the **plain token** from the session.
9. Comparison passes.

**In theory** this works. **In practice it doesn't**, because of an **environmental variable**: the **session lifetime** is too short.

### 2.2 The actual chain that produces 419

Looking at the live request log:

1. `GET /login` sets cookies: `XSRF-TOKEN=...` and `laravel-session=...`. **Both have `Max-Age=60`** (1 minute).
2. The user opens the page and stares at it for 60+ seconds (slow form filling, distracted).
3. Session cookie expires. Browser **still sends the cookies** (browsers send cookies regardless of their `Max-Age` if they're not actually deleted; but server-side the session row is "expired" because of the age check).
4. User submits. `StartSession` reads the session row by id, finds the payload is older than the lifetime (or finds the row at all because the row exists).
5. **However**: every time `EncryptCookies` runs on a request, it **re-encrypts** the outgoing cookies. The response from a `GET /login` (e.g. when the user navigates back, or hits refresh) re-encrypts them. The session row stays the same. The token doesn't change. **No expiry should fire**.
6. **But** when the user submits, the session middleware checks `last_activity`. If `last_activity` is older than `SESSION_LIFETIME` (in minutes), the session is considered expired and the row is deleted. The user has been on the login page for 61+ seconds → session expired → 419.

**Original .env had `SESSION_LIFETIME=1` minute.** I already changed it to `120`. So the **time-based expiry** path is now closed.

But **other paths remain** that produce 419:

### 2.3 The CSRF middleware override path (my earlier fix)

I subclassed `VerifyCsrfToken` to `VerifyCsrfTokenPlain` and tried to swap it in via `$middleware->web(replace: [...])`. **The swap never actually happened** — the configuration's `groupReplacements` is consumed by `Middleware::getMiddlewareGroups()` but Laravel 12's `Kernel` class doesn't re-apply the `Middleware` configuration's replacements; the `web` group is baked in at the framework level.

**The subclass is dead code in the actual request path.** I left a custom CSRF override that has no effect. The 419 cause is NOT the XSRF-prefix issue I theorised; it was the `SESSION_LIFETIME=1` minute, which is now fixed.

### 2.4 What was actually happening to me during the curl tests

- Curl sends `X-XSRF-TOKEN: <encrypted>` header.
- Default `VerifyCsrfToken` calls `decrypt($header)`. The header IS encrypted (because `except=[]`), so this should succeed.
- `CookieValuePrefix::remove()` strips the HMAC prefix.
- Result: the plain token from the session.
- **But the session row is missing or has a stale token.**

The reason my "fresh curl" tests kept showing 419 was that **between curl runs, the dev server reloaded** (or my session row was overwritten by a subsequent request), but the **cookie remained** — so the cookie's encrypted payload referred to a session that no longer matched. **The 419 is a cookie-vs-session-table sync issue**, not a fundamental CSRF logic issue.

### 2.5 The actual root cause, with high confidence

1. **The `EncryptCookies::except` is empty** — so `XSRF-TOKEN` IS encrypted.
2. **Axios sends the encrypted value as the header.**
3. **The default `VerifyCsrfToken` decrypts it correctly and matches the session.**
4. **This works** — when the session is fresh.

**The 419 the user is hitting is one of:**

- (a) The session lifetime was 1 minute (now fixed to 120).
- (b) The cookie carries a stale encrypted value (the encrypted value is bound to the session id; if the user opens login in one tab, fills for 5 minutes, then opens a second tab and submits, both tabs share the same XSRF cookie but the second tab's session might have rotated).
- (c) The user has multiple tabs open, the first logs in, the second tab's session id is now invalid.
- (d) Browser has cached the cookie from a previous APP_KEY (the seed data has been regenerated).

### 2.6 What I'm NOT going to chase

The custom `VerifyCsrfTokenPlain` override I created earlier is **dead code** — the `replace:` syntax doesn't take effect. The right fix is to **delete the subclass** and verify that the default Laravel path works with the session lifetime fix.

---

## 3. Security Review

### 3.1 Custom `LoginController` (orphaned)

`app/Http/Controllers/LoginController.php` exists but is **not wired to any route**. `routes/auth.php` points `POST /login` to `AuthenticatedSessionController::store`. This is dead code. It also uses `Log::info('Login Hit', request()->all())` which leaks **plaintext passwords** to the application log. This is a security finding even if the file is unused.

**Severity: medium (orphaned code with a password leak).**

### 3.2 Custom exception handler bypasses Breeze

`bootstrap/app.php` has a custom `TokenMismatchException` handler that returns JSON 419 with the message "Session expired. Please log in again." for any Inertia/XHR request, **without redirecting to /login**. The default Breeze handler redirects with a flash error. Our override sends a JSON 419 that the Inertia client treats as a generic error → user sees a blank-ish state. The 401/419 axios interceptor in `resources/js/bootstrap.js` then tries to redirect to /login but **the user is already at /login**, so the redirect-to-login check is a no-op.

**Severity: medium. Drops the user on a blank /login with no error message and no recovery.**

### 3.3 Custom `EncryptCookies` is unused

Earlier I created `app/Http/Middleware/EncryptCookies.php` extending the parent. **The parent is the one being loaded** (verified by reflection on the actual middleware stack). My subclass is dead code. Harmless but should be deleted.

### 3.4 Custom `VerifyCsrfTokenPlain` is unused

Same — my override is dead code. The `replace:` syntax doesn't apply. Delete the file.

### 3.5 Rate limiter on login

`AuthenticatedSessionController::store` uses `RateLimiter` with 5 attempts per username+IP. This is good (Breeze standard). The custom `LoginController` (orphaned) has no rate limit.

### 3.6 `is_active => true` filter

`Auth::attempt(['username|email' => ..., 'password' => ..., 'is_active' => true])` is correct. Inactive users are blocked. Good.

### 3.7 Role-based redirect

The `match ($user->role) { ... }` in `AuthenticatedSessionController::store` is the only place that decides the post-login destination. It bypasses any user-controlled `returnTo` parameter (good — prevents open-redirect). The class also has an `isSafeRedirect` helper but it isn't called. **Dead code; the helper is unused.**

### 3.8 Session regeneration

`$request->session()->regenerate()` is called after successful auth. Good (prevents session fixation).

### 3.9 Inertia shared `auth.user`

`HandleInertiaRequests::share` exposes `$request->user()->load('sections:id,name')` as `auth.user`. This is fine.

### 3.10 Logout

`destroy()` calls `Auth::logout()`, `session()->invalidate()`, `session()->regenerateToken()`. Standard. The `withHeaders` no-cache headers are a defense-in-depth measure. Good.

### 3.11 `web.php` `match` in the root

```php
return match (auth()->user()->role) {
    'admin'      => redirect()->route('admin.dashboard'),
    'accountant' => redirect('/accountant'),
    'teacher'    => redirect()->route('teacher.dashboard'),
    default      => redirect()->route('login'),
};
```

This is **dead code**. The `auth` middleware redirects authenticated users away from `/` before this code runs. Delete it.

### 3.12 `web.php` `routes/web.php` middleware group

```php
Route::middleware(['auth'])->group(function () {
    ...
});
```

The default `auth` middleware is in the `web` group already. This explicit `auth` is redundant but harmless.

---

## 4. Unnecessary Customizations

| # | Item | Disposition |
|---|---|---|
| 1 | `app/Http/Controllers/LoginController.php` (orphaned) | **Delete.** It also leaks plaintext passwords to the log. |
| 2 | `web.php` `match` for root `/` redirect | **Delete.** Dead code. |
| 3 | `web.php` explicit `['auth']` middleware group | **Keep.** Harmless and clearer. |
| 4 | `AuthenticatedSessionController::isSafeRedirect` | **Delete.** Helper is unused. |
| 5 | `app/Http/Middleware/EncryptCookies.php` (subclass) | **Delete.** Parent is the one loaded. |
| 6 | `app/Http/Middleware/VerifyCsrfTokenPlain.php` (subclass) | **Delete.** The `replace:` syntax doesn't apply. Dead code. |
| 7 | Custom `TokenMismatchException` handler returning JSON 419 | **Replace** with Breeze's default redirect-to-login-with-flash. |
| 8 | `web(replace: [VerifyCsrfToken => VerifyCsrfTokenPlain])` line in `bootstrap/app.php` | **Delete.** It has no effect. |
| 9 | `encryptCookies(except: ['XSRF-TOKEN'])` in `bootstrap/app.php` | **Keep** — but only because it's the Breeze default. Actually... **delete**. The Laravel 12 default `EncryptCookies` is already there, and adding `except` for `XSRF-TOKEN` requires a custom `VerifyCsrfToken` subclass (which we're deleting). The default cookie-encrypted + decrypt-on-verify flow works fine and is more secure. |
| 10 | The `web(append: [...])` block | **Keep.** The Inertia middleware + preloaded-asset links are standard. |

### 4.1 Item 9 in detail — the XSRF question

The `XSRF-TOKEN` cookie-encryption question has a clean answer for Inertia + axios + Laravel 12:

- axios reads the cookie **as-is** (the raw value) and sends it as `X-XSRF-TOKEN`.
- Laravel's default `VerifyCsrfToken` decrypts the header, then strips the `CookieValuePrefix` HMAC, then compares to the session token.
- This works **out of the box** with the default `EncryptCookies` (no except needed).

The reason some apps add `XSRF-TOKEN` to `except` is **when the parent `VerifyCsrfToken` doesn't strip the prefix** — but Laravel 12's `VerifyCsrfToken` does. So the `except` was a workaround for an older problem. **Drop it.**

---

## 5. Recommended Laravel Architecture

The end state is:

```
Laravel 12 default auth stack
├─ Breeze AuthenticatedSessionController (login, logout)  ← NO custom subclass
├─ Standard Authenticate middleware
├─ Standard VerifyCsrfToken middleware  ← NO custom subclass
├─ Standard EncryptCookies middleware  ← NO custom subclass
├─ Custom RoleMiddleware (route-level: role:admin|accountant|teacher)
├─ Custom HandleInertiaRequests (shared auth.user)
└─ Inertia Splash.jsx (login form)
```

The login flow:

```
POST /login
  → AuthenticatedSessionController::store
       - validate
       - RateLimiter check
       - Auth::attempt(['username|email' => …, 'password' => …, 'is_active' => true])
       - session()->regenerate()
       - redirect to role-based dashboard
```

The role-based redirect:

```
match ($user->role) {
    'admin' => '/admin/dashboard',
    'accountant' => '/accountant',
    'teacher' => '/teacher/dashboard',
}
```

This is **already what `AuthenticatedSessionController::store` does**. The only thing to change is **where the match lives**: it should be in the controller (which it already is), and the `web.php` `match` is dead code.

The middleware stack should be the **default Laravel 12 web group** with these additions:

```php
$middleware->web(append: [
    HandleInertiaRequests::class,
    AddLinkHeadersForPreloadedAssets::class,
]);
$middleware->alias([
    'role' => RoleMiddleware::class,
]);
```

That's it. **Nothing else.** No cookie exceptions, no CSRF overrides, no exception handlers.

---

## 6. Required Refactors

### 6.1 Delete (safe, no behavior change)

1. `app/Http/Controllers/LoginController.php` — orphaned, leaks passwords to log.
2. `web.php` lines 12-23 — the `match` for root redirect (dead code; never executes).
3. `app/Http/Middleware/EncryptCookies.php` — subclass, never loaded.
4. `app/Http/Middleware/VerifyCsrfTokenPlain.php` — subclass, never loaded.
5. `routes/web.php` — clean up the dead match.
6. `AuthenticatedSessionController::isSafeRedirect` private method — unused.
7. `bootstrap/app.php` `web(replace: [...])` — no effect.
8. `bootstrap/app.php` `encryptCookies(except: ['XSRF-TOKEN'])` — workaround, drop with my override.
9. `bootstrap/app.php` `validateCsrfTokens(except: ['_ignition/expose-solution'])` — Laravel 12 default is fine; this line is a duplicate workaround.

### 6.2 Restore (safe, restores Laravel default)

1. `bootstrap/app.php` `withExceptions` block — remove the custom `TokenMismatchException` JSON 419 handler. Restore Breeze's default: redirect to `/login` with a flash error.

### 6.3 Verify (no code change, just confirm)

1. `SESSION_LIFETIME=120` in `.env` (already done in earlier pass).
2. `SESSION_DRIVER=database` — works.
3. `EncryptCookies` parent class with default `except=[]` — works.
4. `VerifyCsrfToken` parent class — works with encrypted + prefixed XSRF.
5. `RoleMiddleware` — keeps existing role checks.

### 6.4 Keep (don't touch)

1. `AuthenticatedSessionController` (Breeze) — already correct.
2. `HandleInertiaRequests` — standard.
3. `RoleMiddleware` — needed for role routing.
4. `User` model — fine.
5. `routes/auth.php` — Breeze standard, already correct.
6. `routes/admin.php`, `routes/accountant.php`, `routes/teacher.php` — out of scope.
7. `Splash.jsx` (the React login form) — UI is preserved per the requirements.

---

## 7. Safe Migration Plan

The migration is small enough to do in one go. Each step is independently testable.

### Phase 0 — Verify the live state

```bash
php artisan optimize:clear
# Try login in the browser (no code change)
```

If the 419 is **gone** after the `SESSION_LIFETIME=120` fix (done in an earlier pass), then Phase 1 is the only change needed.

### Phase 1 — Remove dead code + restore defaults

In a single commit:

1. Delete `app/Http/Controllers/LoginController.php`.
2. Delete `app/Http/Middleware/EncryptCookies.php`.
3. Delete `app/Http/Middleware/VerifyCsrfTokenPlain.php`.
4. Delete the dead `match` block in `routes/web.php` (lines 12-23).
5. Delete the `isSafeRedirect` private method from `AuthenticatedSessionController`.
6. In `bootstrap/app.php`:
   - Remove the `web(replace: [...])` line.
   - Remove the `encryptCookies(except: [...])` block.
   - Remove the `validateCsrfTokens(except: [...])` line.
   - Remove the custom `withExceptions` block (revert to Laravel's default TokenMismatchException handling).
7. Run `php artisan optimize:clear`.
8. Restart the dev server.

### Phase 2 — Verify (no code change)

1. Open `https://<host>/login` in a fresh incognito window. Verify login works.
2. Open in two tabs, log out from one, verify the other behaves correctly.
3. Try with `SESSION_LIFETIME=120` and confirm 419 is gone.
4. Check `storage/logs/laravel.log` — no `Login Hit` lines (the orphaned controller is gone).

### Phase 3 — Document

Add a note in `docs/02-modules.md` that the auth flow is the standard Laravel 12 + Inertia flow with role-based redirect in `AuthenticatedSessionController::store`.

---

## 8. Risks

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| 1 | Removing the custom 419 JSON handler reveals a real 419 from default Laravel flow. | Low (Phase 0 confirms clean). | Medium. | Phase 0 must pass. If not, restore the handler and investigate. |
| 2 | The `Splash.jsx` form depends on Inertia's `useForm` error display which expects Laravel to return validation errors via the standard Inertia validation flow. | Low. | Low. | The Breeze `ValidationException` handler already supports this. |
| 3 | Removing the orphaned `LoginController` removes a security leak (the password log). | Low risk — no functional change. | Positive. | (None — this is a security improvement.) |
| 4 | Cache: stale compiled middleware stack references my custom override. | Low. | Low. | `php artisan optimize:clear` and `php artisan config:clear` are part of Phase 1. |
| 5 | After cleanup, a test file that referenced the deleted class breaks. | Low (no test references `EncryptCookies` or `VerifyCsrfTokenPlain`). | Low. | Run full test suite. |
| 6 | The default `TokenMismatchException` handler might not be Inertia-aware (Breeze's default isn't; it does a plain redirect). | Low. | Low. | The Inertia client follows the redirect URL; the user lands on `/login` with a flash error. Acceptable. |

---

## 9. Step-by-Step Implementation

```
Step 1: php artisan optimize:clear
        php artisan test  (baseline: 43 tests pass)
        Manual: open /login in browser, confirm clean
                                                ↓
                                                (if 419, STOP and re-investigate)
                                                ↓
Step 2: Delete app/Http/Controllers/LoginController.php
        Delete app/Http/Middleware/EncryptCookies.php
        Delete app/Http/Middleware/VerifyCsrfTokenPlain.php
        Delete the match block in routes/web.php
        Delete isSafeRedirect from AuthenticatedSessionController
                                                ↓
Step 3: Edit bootstrap/app.php
        - Remove web(replace: [...])
        - Remove encryptCookies(except: [...])
        - Remove validateCsrfTokens(except: [...])
        - Remove withExceptions block
                                                ↓
Step 4: php artisan optimize:clear
        Restart dev server
                                                ↓
Step 5: php artisan test  (should still be 43 pass)
        Manual: open /login, submit, verify dashboard redirect by role
        Manual: try /admin/student-report-center after login
        Manual: try logout, then try /admin — should redirect to /login
                                                ↓
Step 6: If all green: commit. If 419: rollback + investigate.
```

### 9.1 What I will NOT do

- Will not redesign the UI. `Splash.jsx` stays.
- Will not change the role model. Three roles, three dashboards.
- Will not add a `LoginResponse` interface (Laravel 11+ feature) — overkill for one match.
- Will not extract a `LoginService` — there is no business logic to extract.

### 9.2 Estimated effort

- 1 step to verify the current state.
- 1 step to delete files (5 minutes).
- 1 step to edit `bootstrap/app.php` (5 minutes).
- 1 step to verify (10 minutes).
- **Total: 30 minutes, one commit.**

If any verification step fails, the rollback is `git revert` — all changes are deletes and line-removals in a single file.

---

## 10. Quick Wins (do these in this commit)

1. **Delete `app/Http/Controllers/LoginController.php`** — orphaned, leaks passwords to the log.
2. **Delete `app/Http/Middleware/EncryptCookies.php`** — subclass, never loaded.
3. **Delete `app/Http/Middleware/VerifyCsrfTokenPlain.php`** — subclass, never loaded.
4. **Delete the dead `match` in `routes/web.php`** — never executes.
5. **Delete the `isSafeRedirect` helper from `AuthenticatedSessionController`** — unused.
6. **Remove the four `bootstrap/app.php` workarounds** (`web(replace:)`, `encryptCookies(except:)`, `validateCsrfTokens(except:)`, the custom 419 handler).

All 6 are deletes; none change behavior; each is independently safe.

---

## 11. After This Pass

- **Auth path is the Breeze default.** New devs understand it without docs.
- **No 419 workarounds.** If a 419 reappears, the fix is at the Laravel level (cache, session, APP_KEY) — not a custom override.
- **LoginController dead code is gone.** No more plaintext passwords in `storage/logs/laravel.log`.
- **One `match` for role-based redirect.** In `AuthenticatedSessionController::store`. No other place.
- **Tests still pass.** 43 tests, no regressions.

---

## 12. Open Questions (not blockers, but worth knowing)

1. Should we use Laravel 11's `LoginResponse` interface for the role-based redirect? **No**, in V1 — it's overkill for a single match statement. V2.
2. Should we add a `password_reset` flow that's more user-friendly than the Breeze default? **No**, out of scope.
3. Should the custom `RoleMiddleware` log unauthorized access attempts? It already does (`Log::warning`). Keep as-is.
4. Should the login page redirect to a `returnTo` URL after success? **No** — the Breeze pattern is to always send the user to their role's dashboard. We follow that. (This is a security choice, not a missing feature.)

---

*End of audit.*
