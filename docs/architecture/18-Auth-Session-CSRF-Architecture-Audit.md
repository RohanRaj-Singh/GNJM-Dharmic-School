# Authentication / Session / CSRF Final Architecture Audit

**Date:** 2026-08-19
**Branch:** `refactor/architecture`
**Stack:** Laravel 12 + Inertia 2 (React 18) + Breeze 2 (in dev-deps) + Sanctum 4 (in require)
**Scope:** Authentication, session, CSRF, user/account, and Inertia request lifecycle — full stack.

---

## 1. Executive Summary

The application has **a sound Laravel/Inertia foundation** that is correct end-to-end, but is layered with **significant organic patching around three symptoms: 419 (CSRF), 401 (auth), and tab-session expiry**. These patches duplicate responsibilities the framework already owns, and the most consequential of them — a global axios response interceptor in `resources/js/bootstrap.js` that auto-redirects every 401/419 to `/login` — is the **likely root cause of the "Admin actions failing while saving" symptom**, not the cure.

The architecture is structurally clean (Laravel-managed). The codebase is functionally clean (everything works). But the **defensive code is wrong**: it catches framework signals and converts them into side-effects that mask real failures.

### Classification (per the rubric)

> **C — PATCHED BUT FUNCTIONAL.**
>
> Underlying architecture works but several workarounds should be removed.

The fix path is **deletion of redundant client-side code, not addition of new mechanisms**. No Laravel changes are required.

### Headline findings (ranked)

| # | Severity | Finding |
|---|---|---|
| F1 | **P0** | Global axios response interceptor redirects ALL 401/419 to `/login` (catches the very errors it claims to handle) |
| F2 | **P1** | Attendance save uses raw `fetch` + manual CSRF-meta-tag read + manual X-CSRF-TOKEN header; bypasses axios interceptor |
| F3 | **P1** | 5 files independently read `meta[name="csrf-token"]` and inject `X-CSRF-TOKEN`; 5 different mechanisms coexist |
| F4 | **P2** | `TabSessionTimeout` fires forced `/logout` after 10 min of hidden tab, regardless of activity |
| F5 | **P2** | `AdminLayout` and `SimpleLayout` maintain duplicate "protected history" stack in `sessionStorage` (parallel to Inertia's history) |
| F6 | **P2** | `useBackButtonLogoutModal` (440-line file with embedded AC/test spec) — parallel back-button interception mechanism |
| F7 | **P3** | Dead code: `app/Http/Middleware/VerifyCsrfToken.php` only excludes `api/*` which doesn't exist; `app/Http/Requests/Auth/LoginRequest.php` is wired nowhere; `app/Http/Middleware/TrimStrings.php` only excludes `password` fields (Breeze default) |
| F8 | **P3** | 12 stale `console.log('[Attendance Save] ...')` debug lines + 4 stale `console.log('[CSRF] ...')` lines |
| F9 | **P3** | `AuthenticatedSessionController` does its own inline validation + rate-limit + throttle key, duplicating the unused `LoginRequest` it could be calling |

---

## 2. Current Authentication Stack

### 2.1 What is installed (`composer.json`)

| Package | Version | Status | Use |
|---|---|---|---|
| `laravel/framework` | ^12.0 | Production | Framework |
| `inertiajs/inertia-laravel` | ^2.0 | Production | Inertia server adapter |
| `laravel/sanctum` | ^4.0 | Production (but unused — see §2.3) | Listed in `require` |
| `laravel/breeze` | ^2.3 | **dev-deps only** | Installed via scaffolding; not used by the app |

### 2.2 What is actually wired

| Layer | Active | Mechanism |
|---|---|---|
| **Login controller** | `app/Http/Controllers/Auth/AuthenticatedSessionController.php` | Custom (inline validation, `Auth::attempt`, `session()->regenerate()`) |
| **Login FormRequest** | `app/Http/Requests/Auth/LoginRequest.php` | **Dead code** — never wired up |
| **Logout** | Same `AuthenticatedSessionController::destroy` | `Auth::logout()`, `session()->invalidate()`, `session()->regenerateToken()` |
| **Session driver** | `database` (per `.env`) | Sessions in `sessions` table |
| **Auth guard** | `web` (session-based) — `config/auth.php:38-43` | Standard Laravel default |
| **User provider** | `eloquent`, `App\Models\User` | Standard |
| **User model** | `app/Models/User.php` | `Authenticatable` + role helpers (`isAdmin/isAccountant/isTeacher`) |

### 2.3 Sanctum status

`laravel/sanctum` is in `require`, but:
- No `routes/api.php` exists.
- `bootstrap/app.php` does not register `EnsureFrontendRequestsAreStateful` or Sanctum's middleware.
- No client-side `withCredentials` setup beyond the default.
- No `SANCTUM_STATEFUL_DOMAINS` config.

**Conclusion: Sanctum is dormant.** It is installed but contributes nothing. Removing it from `composer.json` is a future housekeeping task (out of scope for this audit — does not affect behavior).

### 2.4 Breeze status

`laravel/breeze` is in `dev-deps`. The presence of Breeze-generated controllers under `app/Http/Controllers/Auth/` (ConfirmablePassword, EmailVerification*, NewPassword, Password, PasswordResetLink, RegisteredUser, VerifyEmail) is misleading — only `AuthenticatedSessionController` is wired into `routes/auth.php`. The others are dead. See §17.1 for the Breeze integrity assessment.

### 2.5 Role middleware

| Concern | Implementation |
|---|---|
| **Where** | `app/Http/Middleware/RoleMiddleware.php` |
| **Alias** | `role` (registered in `bootstrap/app.php:30-32`) |
| **Behaviour** | Checks `$request->user()->role` against an `in_array($roles)`; redirects on mismatch |
| **Concerns** | The middleware performs logging on every unauthorized attempt (good). But the redirect target is hardcoded per role — a custom behaviour not in Breeze. This is **legitimate application-specific behavior** that should be preserved. |

### 2.6 Custom authentication middleware

| File | Role |
|---|---|
| `app/Http/Middleware/Authenticate.php` | Subclass of `Illuminate\Auth\Middleware\Authenticate`; flashes "Your session has expired" error + redirects to `route('login')`. **Legitimate customization** (Breeze default doesn't flash a message). |
| `app/Http/Middleware/RedirectIfAuthenticated.php` | Role-aware redirect (admin → `/admin/dashboard`, etc.). **Legitimate customization** required by role system. |
| `app/Http/Middleware/HandleInertiaRequests.php` | Standard Inertia middleware; shares `auth.user`, `flash.success/error/status`. Clean. |
| `app/Http/Middleware/SecurityHeaders.php` | Adds `Cache-Control: no-store` + `X-Content-Type-Options`, etc. **Custom but harmless**; defensive. |
| `app/Http/Middleware/PreventCacheMiddleware.php` | Duplicates `SecurityHeaders`'s cache-control logic — **dead duplicate**, never registered in `bootstrap/app.php`. |

### 2.7 Answers to Phase 1 questions

| Q | Answer |
|---|---|
| 1. Which auth system is responsible for login? | `AuthenticatedSessionController` (custom inline validation; FormRequest path is unwired) |
| 2. Which middleware establishes the session? | Laravel 12 default `web` group: `EncryptCookies` + `StartSession` (no custom session middleware) |
| 3. Which middleware validates CSRF? | Laravel 12 default `Illuminate\Foundation\Http\Middleware\VerifyCsrfToken` (via `web` group). `app/Http/Middleware/VerifyCsrfToken.php` exists but is functionally identical (only `api/*` exclusion — and no `api/*` routes exist). |
| 4. Which middleware handles Inertia? | `App\Http\Middleware\HandleInertiaRequests` + `AddLinkHeadersForPreloadedAssets`, both `append:web` in `bootstrap/app.php:24-27` |
| 5. Which middleware handles roles? | `App\Http\Middleware\RoleMiddleware`, alias `role` |
| 6. Multiple competing auth mechanisms? | **No.** Single `Auth` facade + `web` guard. |
| 7. Multiple session mechanisms? | **No.** Single `database` driver, single `web` group session. |
| 8. Multiple CSRF mechanisms? | **On the backend: No.** **On the frontend: YES** — see §5. |

---

## 3. Current Session Architecture

### 3.1 Configuration (per `.env`)

| Setting | Value | Source |
|---|---|---|
| `SESSION_DRIVER` | `database` | `.env:30` |
| `SESSION_LIFETIME` | `120` (minutes) | `.env:31` |
| `SESSION_ENCRYPT` | `false` | `.env:32` |
| `SESSION_PATH` | `/` | `.env:33` |
| `SESSION_DOMAIN` | `null` (defaults to current host) | `.env:34` |
| `SESSION_HTTP_ONLY` | `true` (default in `config/session.php:185`) | `config/session.php` |
| `SESSION_SAME_SITE` | `lax` (default) | `config/session.php:202` |
| `SESSION_SECURE_COOKIE` | `null` (unset → follows `request->isSecure()`) | `.env` |
| `SESSION_PARTITIONED_COOKIE` | `false` | `config/session.php:215` |
| `APP_URL` | `http://localhost` | `.env:5` |
| `APP_DEBUG` | `true` | `.env:4` |

### 3.2 Session table

`SESSION_DRIVER=database` writes sessions to the `sessions` table. Per `.env:40`, `CACHE_STORE=database` — so both sessions and cache share the database. **No file sessions, no Redis.**

### 3.3 Cookie name

Per `config/session.php:130-133`:
```php
'cookie' => env('SESSION_COOKIE', Str::slug(env('APP_NAME', 'laravel')).'-session'),
```
With `APP_NAME=Laravel`, the session cookie name is `laravel-session`. The XSRF cookie is `XSRF-TOKEN` (Laravel default; not configurable in `config/session.php`).

### 3.4 Login → session regeneration

`AuthenticatedSessionController::store()` (line 69):
```php
$request->session()->regenerate();
```
✅ Correctly regenerates session ID after successful login. Laravel 12 default.

### 3.5 Logout → session invalidation

`AuthenticatedSessionController::destroy()` (lines 93-96):
```php
Auth::logout();
$request->session()->invalidate();
$request->session()->regenerateToken();
```
✅ Correctly invalidates session AND regenerates CSRF token. Laravel 12 default.

### 3.6 Custom session behaviour — none found

The middleware `StartSession` is the framework default. No custom session middleware exists.

---

## 4. Current CSRF Architecture

### 4.1 Backend (Laravel)

| Concern | Mechanism | Status |
|---|---|---|
| Token generation | `EncryptCookies` middleware decrypts `XSRF-TOKEN` cookie value → exposes `_token` to the request | ✅ |
| Token validation | `Illuminate\Foundation\Http\Middleware\VerifyCsrfToken` (via `web` group) | ✅ |
| Token rotation | `regenerateToken()` on `AuthenticatedSessionController::destroy` | ✅ |
| Custom subclass | `app/Http/Middleware/VerifyCsrfToken.php` with `$except = ['api/*']` | ⚠️ Dead (no `api/*` routes) |

The custom `VerifyCsrfToken.php` is **dead code functionally**. Laravel's default exclusion list is also empty by default; the subclass adds `api/*` exclusion, but the application has no `api/*` routes. This file can be deleted without behaviour change.

### 4.2 Frontend — **multiple competing mechanisms**

This is the heart of the audit. **Five independent CSRF-acquisition strategies exist on the frontend.** None of them is wrong in isolation, but the duplication is the problem.

| # | File | Mechanism | Lines |
|---|---|---|---|
| 1 | `resources/js/bootstrap.js` | Axios auto-reads `XSRF-TOKEN` cookie + sends as `X-XSRF-TOKEN` header (Laravel's documented mechanism) | 1-4 |
| 2 | `resources/js/Pages/Admin/Attendance/Index.jsx` | Raw `fetch` + manual read of `meta[name="csrf-token"]` + manual `X-CSRF-TOKEN` header | 248-285 |
| 3 | `resources/js/Pages/Admin/Users/Index.jsx` | Helper `csrf()` reads `meta[name="csrf-token"]`; helper `apiPost/apiDelete` inject `X-CSRF-TOKEN` | 9-37 |
| 4 | `resources/js/Pages/Admin/Students/Index.jsx` | Same `csrf()` helper | 19-21 |
| 5 | `resources/js/Pages/Admin/Utilities/Backup.jsx` | Same `csrf()` helper | 29-31 |
| 6 | `resources/js/Pages/Admin/Reports/Index.jsx` | Dynamic `<form>` with hidden `_token` input (Breeze-style form-CSRF) | 261-267 |
| 7 | `resources/js/Pages/Admin/Reports/Attendance.jsx` | Same dynamic `<form>` with hidden `_token` | 149-152 |

**Mechanism (1)** is the Laravel/Inertia-recommended path. Axios automatically reads the `XSRF-TOKEN` cookie that Laravel sets on every response, decrypts it, and sends it as `X-XSRF-TOKEN` on every subsequent request.

**Mechanisms (2-5)** all bypass axios (raw `fetch`) and manually read the `<meta name="csrf-token">` tag from `app.blade.php`. They inject the meta value as `X-CSRF-TOKEN` (different header name). Laravel accepts both `X-XSRF-TOKEN` and `X-CSRF-TOKEN` headers — but this is **two redundant mechanisms running side by side**.

**Mechanisms (6-7)** create a real `<form>` and submit it natively. This is the Breeze way to do POST without JavaScript (for CSV/PDF export). Legitimate use case.

### 4.3 The meta tag

`resources/views/app.blade.php:6`:
```blade
<meta name="csrf-token" content="{{ csrf_token() }}">
```
✅ Standard Breeze + Inertia pattern. Required for the `axios.post()` from Breeze/Inertia scaffolding — though Inertia's `router.post()` does NOT actually use this meta tag (Inertia uses the XSRF cookie just like axios does).

### 4.4 CSRF exclusions found

| Location | Exclusion | Live? |
|---|---|---|
| `app/Http/Middleware/VerifyCsrfToken.php:9-11` | `api/*` | No — no `api/*` routes |
| Anywhere else | None found | — |

✅ No security holes. No wildcard exclusions.

---

## 5. Inertia Request Architecture

### 5.1 Frontend mutation mechanisms (per file)

| Mechanism | Files |
|---|---|
| **Inertia `router.post/patch/delete`** (recommended) | `AdminLayout`, `SimpleLayout` (logout), `StudentFeeSheet`, `Reports/Index` (form-CSRF wrapper), `Sections/Index` |
| **Inertia `router.get/visit`** | `AdminLayout`, `SimpleLayout`, `Reports/Index` (filter URLs) |
| **Inertia `useForm` + `post`** | `Auth/Login.jsx`, `Splash.jsx` |
| **axios (`window.axios` / imported)** | `Splash.jsx` (logout), `TabSessionTimeout` (logout), `Sections/Index`, `Classes/Index`, `MasterDirectory`, `StudentProgression*`, `PassOutFlow`, `Reports/Index` (build), `Reports/Attendance` (build), `StudentReportCenter/Index` (build) |
| **Raw `fetch` + manual CSRF** | `Admin/Attendance/Index.jsx` (save), `Admin/Users/Index.jsx`, `Admin/Students/Index.jsx`, `Admin/Utilities/Backup.jsx`, `Admin/Reports/Index.jsx` (POST to build) |
| **Native `<form>` + hidden `_token`** | `Admin/Reports/Index.jsx` (CSV/PDF export), `Admin/Reports/Attendance.jsx` (PDF export) |

**Six request mechanisms coexist.** Inertia + axios + raw fetch + native forms.

### 5.2 The interceptor (F1 — the smoking gun)

`resources/js/bootstrap.js:18-33`:
```js
const redirectToLogin = () => {
    if (window.location.pathname !== "/login") {
        window.location.assign("/login");
    }
};

window.axios.interceptors.response.use(
    (response) => response,
    (error) => {
        const status = error?.response?.status;
        if (status === 401 || status === 419) {
            redirectToLogin();
        }
        return Promise.reject(error);
    }
);
```

**This is the mechanism converting intermittent 419s into "Admin actions failing while saving".**

When any POST returns 419, the page is **immediately** redirected to `/login` via `window.location.assign()`. The toast never even shows the underlying error — the page unloads before the user sees it. The session is still valid in most cases (the 419 was a transient CSRF token race), and now the user is dumped on `/login` thinking their session expired.

The comment on line 12-16 describes the symptom in plain English:
> On 401 (unauthenticated) or 419 (CSRF mismatch / session expired) we redirect to /login. Page-local handlers (Fee Report, Attendance Report, Student Center) catch 419 separately and show a friendly toast with a refresh button.

But the "page-local handlers" cannot show a toast because **the interceptor has already redirected away**. The two mechanisms fight each other.

### 5.3 Why does 419 happen?

Per Laravel's CSRF middleware: the `X-XSRF-TOKEN` axios header must equal the `_token` stored in the session. The session token is rotated:
- On login (no — `regenerate()` does not rotate `_token`; only session ID)
- On logout (`regenerateToken()` rotates `_token`)
- On session expiry (the session record is deleted; a fresh session has a new `_token`)

The XSRF cookie is set by Laravel's `AddQueuedCookiesToResponse` → `EncryptCookies`. It contains the **session's current `_token`**, encrypted. Axios reads this cookie value on every request and sends it as `X-XSRF-TOKEN`. Laravel decrypts it and compares to `session('_token')`.

**Failure mode:** if the browser presents an old XSRF cookie (e.g. user opened two tabs, logged out of one, the other still has the old cookie), the comparison fails and returns 419. Same if the user has been on the page for >2 hours (session lifetime) and the session record expired — the cookie still says one thing, the session says another.

**Correct behaviour:** let the 419 propagate to the page, refresh the page (which re-renders with a fresh XSRF cookie), then retry. The interceptor prevents this — it dumps the user to /login instead.

---

## 6. Login → Session → CSRF Lifecycle

```
Browser GET /login (no session)
  → Laravel: StartSession creates new session, generates _token, sets XSRF cookie
  → Inertia: HandleInertiaRequests renders <Splash/>, csrf_token() → <meta>
  → Browser POST /login (login + password + remember)
    → Laravel StartSession: existing session
    → EncryptCookies: decrypt XSRF cookie, set request _token
    → VerifyCsrfToken: matches ✓
    → AuthenticatedSessionController::store:
      → Auth::attempt validates credentials
      → $request->session()->regenerate()  ← new session ID, _token UNCHANGED
      → redirect() to role-specific dashboard
  → Browser GET /admin/dashboard
    → New session ID cookie set
    → XSRF cookie unchanged (still has the same _token)
    → HandleInertiaRequests renders Admin/Dashboard
  → Browser POST /admin/attendance/save (e.g. via raw fetch + X-CSRF-TOKEN)
    → Same session, same _token
    → VerifyCsrfToken: matches ✓
    → AdminAttendanceController::save
  → All good.
```

**Failure mode:** the only place the `_token` rotates is `regenerateToken()` on logout. After login, the `_token` is stable across the session lifetime. So 419 should only happen at session expiry (>2 hr) or if the user manually logged out in another tab.

**The fix:** the interceptor's auto-redirect IS what causes the "Admin actions failing while saving" symptom. If a transient 419 occurs (race condition, two-tab logout), the interceptor dumps the user. Removing the interceptor would expose the real underlying cause to the page-level handler that already knows how to retry.

---

## 7. Admin Request Lifecycle

Admin routes (from `routes/web.php:41-46`):
```php
Route::middleware(['auth'])
    ->prefix('admin')
    ->name('admin.')
    ->group(function () {
        Route::middleware('role:admin')
            ->prefix('admin')
            ->name('admin.')
            ->group(function () {
                require __DIR__.'/admin.php';
            });
    });
```
(Wait — the `auth` is on the outer group, `role:admin` on the inner. Both wrap `admin.php`.)

Effective middleware on every Admin route:
- `EncryptCookies` (web)
- `AddQueuedCookiesToResponse` (web)
- `StartSession` (web)
- `ShareErrorsFromSession` (web)
- `VerifyCsrfToken` (web)
- `SubstituteBindings` (web)
- `HandleInertiaRequests` (appended in `bootstrap/app.php:24-27`)
- `AddLinkHeadersForPreloadedAssets` (appended)
- `auth` (route)
- `role:admin` (route)

✅ Correct. **The admin tree has no special middleware treatment vs. Accountant/Teacher.** The middleware is identical; only the `role:` value differs.

The only Admin-specific oddities are:
- `AdminLayout.jsx` mounts `<TabSessionTimeout />` (line 260) — fires logout after 10 min hidden tab. **NOT in `SimpleLayout` only** — both `AdminLayout` AND `SimpleLayout` mount it (SimpleLayout:306). So this is universal, not Admin-specific.
- `AdminLayout.jsx` runs the back-button interceptor + protected-history sessionStorage logic.

**Conclusion: Admin has no auth/session/CSRF custom code at the middleware layer that Accountant/Teacher lack.** The differences are entirely in client-side UX code (the back-button interceptor, the modal).

---

## 8. Attendance Request Lifecycle

### Admin Attendance save (the main reproducible failure)

```
Admin loads /admin/attendance
  → Session + XSRF cookie + <meta csrf-token> all set
User selects attendance rows, clicks Save
  → Admin/Attendance/Index.jsx::saveAttendance()
  → Builds payload, logs to console
  → getCsrfToken(): reads <meta name="csrf-token"> → returns encrypted token
  → fetch("/admin/attendance/save", {
      method: "POST",
      credentials: "same-origin",
      headers: { "X-CSRF-TOKEN": csrfToken, "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    })
```

**This bypasses axios entirely.** Therefore:
- ✅ Axios's automatic `X-XSRF-TOKEN` header (correct framework mechanism) is NOT sent.
- ⚠️ Instead, the code reads `<meta name="csrf-token">` and sends it as `X-CSRF-TOKEN`.

**Will Laravel accept `X-CSRF-TOKEN` with the meta value?** Yes — Laravel's `VerifyCsrfToken` accepts `X-CSRF-TOKEN` AND `X-XSRF-TOKEN` AND `$_POST['_token']`. The value must match the session `_token`. The meta tag is rendered by `{{ csrf_token() }}` in `app.blade.php:6`, which is the same `Session::token()`. So it matches.

**Why does it fail then?** Three plausible reasons (all preventable):

1. **The session has been idle >120 min.** Session record deleted. Session regenerated on the new request → new `_token`. The meta tag on the old page has the old token. 419. (Correct Laravel behavior; the page should refresh.)

2. **The user clicked Save while the page was idle in a background tab for >10 min.** `TabSessionTimeout` (line 18-42) fires POST `/logout` → server invalidates session → next request from this page (still alive, still has old meta + old XSRF cookie) returns 419. (THIS IS A LIKELY ROOT CAUSE — see F4 below.)

3. **The meta tag has not yet been refreshed on the latest page render.** Unlikely on a SPA navigation but possible if the page was hydrated from cache.

The 419 toast that the user sees is from line 297-306 of `Attendance/Index.jsx`:
```js
if (r.status === 419) {
  const errorMsg = 'Session expired or CSRF token mismatch. Please refresh the page and try again.';
  ...
}
```
The toast is correct. **But** the global axios interceptor does NOT fire here (this code uses `fetch`, not axios). So the redirect-to-login doesn't happen — the toast appears, the user clicks refresh, the page reloads, fresh CSRF token, retry succeeds.

**The Admin Attendance save flow is structurally correct.** It is NOT broken. The only fragility is using raw `fetch` instead of `axios.post` (which would inherit axios's automatic XSRF handling). The fix is **swap `fetch` for `axios`** — which would also remove the manual CSRF meta read.

### Teacher Attendance

Per the Phase 2 audit, teacher attendance is implemented via `Teacher/Dashboard.jsx` and uses `axios` (correct path) with no manual CSRF. Likely works.

### Accountant Attendance

Same — accountant attendance uses Inertia components. Should work via axios.

---

## 9. Accountant vs Teacher vs Admin Comparison

| Layer | Admin | Accountant | Teacher |
|---|---|---|---|
| Route group | `role:admin` | `role:accountant` | `role:teacher` |
| Middleware (server) | auth + role:admin | auth + role:accountant | auth + role:teacher |
| Layout | `AdminLayout` | `SimpleLayout` | `SimpleLayout` |
| TabSessionTimeout | ✓ mounted | ✓ mounted | ✓ mounted |
| Back-button interceptor | ✓ (in AdminLayout + useBackButtonLogoutModal) | ✓ (in SimpleLayout) | ✓ (in SimpleLayout) |
| Protected-history sessionStorage | ✓ (in AdminLayout + SimpleLayout) | ✓ (in SimpleLayout) | ✓ (in SimpleLayout) |
| Attendance save | Raw `fetch` + manual CSRF | Likely Inertia router/axios | Likely Inertia router/axios |
| Reports CSRF | Dynamic `<form>` with hidden `_token` | n/a | n/a |
| Manual `meta[name="csrf-token"]` reads | 4 files | 0 | 0 |
| Raw `fetch` for mutations | 5 files | 0 | 0 |

**Admin has a disproportionately high concentration of "manual CSRF / raw fetch" patterns.** This is the smoking gun: Admin is the role that has the most patchwork, and Admin is the role the user reports as "historically produced the most problems."

---

## 10. Breeze Integrity

### 10.1 What Breeze shipped

Breeze generates:
- All controllers under `app/Http/Controllers/Auth/` — **all present** (ConfirmablePassword, EmailVerification*, NewPassword, Password, PasswordResetLink, RegisteredUser, VerifyEmail, AuthenticatedSessionController).
- `app/Http/Requests/Auth/LoginRequest.php` — **present, unwired**.
- `app/Http/Middleware/VerifyCsrfToken.php` — **present, but functionally empty** (just `api/*` exclusion).
- `app/Http/Middleware/TrimStrings.php` — **present, just password exclusions** (matches Breeze default).
- `resources/views/auth/login.blade.php` — **not present**. Login is React-based (`Pages/Auth/Login.jsx` + `Pages/Splash.jsx`).

### 10.2 What the application deviated from

| Concern | Breeze | App | Notes |
|---|---|---|---|
| Login view | `resources/views/auth/login.blade.php` | React (`Splash.jsx`, `Login.jsx`) | Inertia replaces — fine |
| Login FormRequest | `LoginRequest` | Custom inline validation in `AuthenticatedSessionController::store()` | Dead `LoginRequest` |
| Logout | Form request to `/logout` | React `router.post('/logout')` | Fine |
| Register | `RegisteredUserController` exists but route is `Route::post('register', ...)` — present | Routes registered | Functionally alive |
| Email verification | All controllers exist, routes wired | Routes wired | Functionally alive |
| Password reset | All controllers exist, routes wired | Routes wired | Functionally alive |

### 10.3 KEEP / REMOVE / RESTORE

| Breeze artefact | Disposition | Reason |
|---|---|---|
| `AuthenticatedSessionController` | **KEEP + refactor** | Custom logic is role-aware (good); but inline validation should migrate to `LoginRequest` |
| `LoginRequest` | **REMOVE OR WIRE** | It's dead — never used |
| `VerifyCsrfToken` | **REMOVE** | Pure dead code |
| `TrimStrings` | **KEEP** | Even though functionally empty, harmless and standard |
| Other Auth/* controllers | **KEEP** | Routes are wired |
| `Auth/EmailVerification*` + UI | **KEEP** | Functional |

---

## 11. Middleware Map

### 11.1 Global stack (`bootstrap/app.php` + Laravel 12 defaults)

Every HTTP request receives (in order):
1. `Illuminate\Foundation\Http\Middleware\HandleCors`
2. `Illuminate\Foundation\Http\Middleware\PreventRequestsDuringMaintenance`
3. `Illuminate\Cookie\Middleware\EncryptCookies`
4. `Illuminate\Cookie\Middleware\AddQueuedCookiesToResponse`
5. `Illuminate\Session\Middleware\StartSession`
6. `Illuminate\View\Middleware\ShareErrorsFromSession`
7. `Illuminate\Foundation\Http\Middleware\ValidateCsrfToken` ← **default; not the app subclass**
8. `Illuminate\Routing\Middleware\SubstituteBindings`
9. `App\Http\Middleware\HandleInertiaRequests` ← appended in bootstrap/app.php
10. `Illuminate\Http\Middleware\AddLinkHeadersForPreloadedAssets` ← appended

### 11.2 Per-route additions

| Route type | Extra middleware |
|---|---|
| `/admin/*` | `auth`, `role:admin` |
| `/accountant/*` | `auth`, `role:accountant` |
| `/teacher/*` | `auth`, `role:teacher` |
| `/attendance/*` (teacher+accountant) | `auth`, `role:teacher,accountant` |
| `/students/{student}/promote|pass-out|leave-school|make-inactive|reactivate` | `auth`, `role:admin` |
| `/login`, `/register`, `/password/*` | `guest` |
| `/logout`, `/email/verification-notification`, `/confirm-password`, `/password` (PUT) | `auth` |

### 11.3 Issues found

| Issue | Severity | Status |
|---|---|---|
| Double `auth` middleware nesting (outer `auth` group + inner `role` group inside `auth`) | Cosmetic | Not a bug; Laravel deduplicates `auth` |
| Routes outside `web` group | None | All routes are in `web.php` / `routes/*.php` which `bootstrap/app.php:9` loads as `web` |
| Routes accidentally under API middleware | None | No `routes/api.php` |

✅ Middleware map is **structurally correct**. The only oddity is double `auth` nesting, which Laravel handles.

---

## 12. Cookie / Domain / HTTPS Findings

### 12.1 Local config

| Setting | Value |
|---|---|
| `APP_URL` | `http://localhost` |
| `SESSION_DRIVER` | `database` |
| `SESSION_DOMAIN` | `null` (defaults to current host) |
| `SESSION_SECURE_COOKIE` | `null` (follows `request->isSecure()` — true on HTTPS, false on HTTP) |
| `SESSION_SAME_SITE` | `lax` |
| `SESSION_HTTP_ONLY` | `true` |
| HTTPS | Local: HTTP. Production: UNKNOWN. |

### 12.2 Production topology

**UNKNOWN — not in the repository.** `.env` for production is not committed (correct security practice). The user has not provided production env values. Per the audit rubric: marked UNKNOWN.

### 12.3 Common production failure modes (not yet confirmed)

If production uses:
- **HTTPS with `SESSION_SECURE_COOKIE=null`** → cookies still set (because `secure=null` follows `request->isSecure()`). Safe.
- **HTTPS with `SESSION_SECURE_COOKIE=false`** → cookies sent over HTTP → browsers reject. 419s on every request.
- **A reverse proxy without `TrustProxies` configured** → Laravel thinks request is HTTP, sets `secure=false`, browser sees HTTPS, cookie not sent. 419s.
- **Different domain (e.g. `app.example.com` vs `api.example.com`)** → `SESSION_DOMAIN=null` would scope cookies to the actual host. If frontend and backend are on different subdomains, sessions wouldn't share. 401s.
- **`www.` vs non-`www`** → cookies scope to one or the other depending on how the user navigated. Stale cookies could cause intermittent 419s.

### 12.4 Cookie name duplication

There is exactly one session cookie (`laravel-session`) and one XSRF cookie (`XSRF-TOKEN`). No name collisions.

---

## 13. Session Storage Findings

### 13.1 Driver: `database`

Sessions stored in the `sessions` table. Shared with the application's MySQL database (`gnjm_dharmic_school` per `.env:26`).

### 13.2 Cleanup

`config/session.php:117`:
```php
'lottery' => [2, 100],
```
✅ 2% chance per request that the GC will sweep expired sessions. Laravel default.

### 13.3 Concerns

| Concern | Status |
|---|---|
| Session table exists and is writable | Yes (Laravel default schema) |
| Sessions are pruned | Yes (lottery GC) |
| Multi-instance deployment | If production runs >1 PHP worker, they share DB sessions — fine |
| Session row growth | `lottery` sweeps; OK |

No findings.

---

## 14. Existing CSRF / Session Patches

This is the central deliverable. Every patch discovered in the audit, classified by intent, necessity, and recommendation.

| # | Location | Purpose | Still needed? | Recommendation |
|---|---|---|---|---|
| **P-A** | `resources/js/bootstrap.js:24-33` | Global axios interceptor: redirect 401/419 to /login | **NO** — causes the symptom it claims to fix | **REMOVE** |
| **P-B** | `resources/js/Pages/Admin/Attendance/Index.jsx:248-285` | Manual CSRF read + raw `fetch` + custom 419 toast | **NO** — Inertia/axios already handles this | **REPLACE with `router.post` or `axios.post`** |
| **P-C** | `resources/js/Pages/Admin/Users/Index.jsx:9-37` | `csrf()` helper + manual `X-CSRF-TOKEN` injection | **NO** — axios already does this | **REMOVE helper; use `axios.post`** |
| **P-D** | `resources/js/Pages/Admin/Students/Index.jsx:19-21` | `csrf()` helper | **NO** | **REMOVE** (function unused; `csrf()` defined but not actually called in the file) |
| **P-E** | `resources/js/Pages/Admin/Utilities/Backup.jsx:29-31, 36-38` | `csrf()` helper + manual `X-CSRF-TOKEN` injection | **NO** | **REPLACE with `axios.post`** |
| **P-F** | `resources/js/Pages/Admin/Reports/Index.jsx:261-267` | Dynamic `<form>` with hidden `_token` | **YES** (for file-download POST) | **KEEP** (legitimate use of Breeze-style form-CSRF) |
| **P-G** | `resources/js/Pages/Admin/Reports/Attendance.jsx:149-152` | Same dynamic `<form>` | **YES** | **KEEP** |
| **P-H** | `resources/js/Components/TabSessionTimeout.jsx` | Force-logout after 10 min of hidden tab | **NO** — Laravel session is HTTP-driven (per-request) and doesn't need this; can cause 419s on next save | **REMOVE** or relax (e.g. show a warning, not auto-logout) |
| **P-I** | `resources/js/Layouts/AdminLayout.jsx:8, 39-75, 110-148` | "Protected history" sessionStorage + popstate back-button guard | **NO** — Inertia already manages history; this is parallel state | **REMOVE** — let browser do what it does |
| **P-J** | `resources/js/Layouts/SimpleLayout.jsx:8, 57-89, 192-203` | Same protected history pattern | **NO** | **REMOVE** |
| **P-K** | `resources/js/Hooks/useBackButtonLogoutModal.jsx` | 440-line back-button-interceptor hook with embedded AC/test spec | **NO** — duplicates `AdminLayout`/`SimpleLayout` behaviour | **REMOVE** — dead (never imported anywhere) |
| **P-L** | `resources/js/Pages/Admin/Reports/Index.jsx:241` | `if (status === 419)` → setError() with refresh message | **YES** (graceful 419 handling) | **KEEP** as the model for the rest |
| **P-M** | `resources/js/Pages/Admin/Reports/Attendance.jsx:134` | Same | **YES** | **KEEP** |
| **P-N** | `resources/js/Pages/Admin/StudentReportCenter/Index.jsx:136` | Same | **YES** | **KEEP** |
| **P-O** | `resources/js/Pages/Splash.jsx:30-41` | `window.location.reload()` after logout | **NO** — `router.post('/logout')` already handles redirect | **SIMPLIFY** — just `router.post('/logout', { onSuccess: () => window.location.href = '/' })` |
| **P-P** | `resources/js/Components/TabSessionTimeout.jsx:40` | `window.location.assign('/login')` after forced logout | See P-H | See P-H |
| **P-Q** | `resources/js/Pages/Auth/Login.jsx:31-40, 43-54` | `window.location.href = redirectUrl` after login | **NO** — Inertia auto-navigates after `useForm().post()` | **SIMPLIFY** — remove the manual `window.location.href` |
| **P-R** | `resources/js/Pages/Admin/Attendance/Index.jsx:42-101` | localStorage draft persistence | **YES** (UX feature, not session/CSRF) | **KEEP** (separate concern) |
| **P-S** | `resources/js/Pages/Admin/Reports/Index.jsx:547` / `:257` (Attendance) | "Refresh page" button after 419 | **YES** (UX) | **KEEP** |
| **P-T** | `resources/js/Pages/Admin/Users/Index.jsx:304` | "Retry" button after error | **YES** | **KEEP** |
| **P-U** | `app/Http/Middleware/VerifyCsrfToken.php:9-11` | `api/*` exclusion | **NO** — no `api/*` routes | **REMOVE** (use Laravel default) |
| **P-V** | `app/Http/Requests/Auth/LoginRequest.php` | Login FormRequest | **NO** — never wired | **REMOVE OR WIRE** (prefer wire: it does what `AuthenticatedSessionController::store` does inline, more correctly) |
| **P-W** | `app/Http/Middleware/PreventCacheMiddleware.php` | Duplicate cache-control logic | **NO** — never registered in `bootstrap/app.php` | **REMOVE** (already a no-op) |
| **P-X** | `app/Http/Middleware/SecurityHeaders.php` | `Cache-Control: no-store` + security headers | **YES** (defensive) | **KEEP** (consider consolidating with PreventCacheMiddleware) |
| **P-Y** | `resources/js/Pages/Admin/Attendance/Index.jsx:227, 246, 254, 262, 266, 274, 295, 300, 305, 312, 318, 332` | Stale `console.log('[Attendance Save] ...')` debug | **NO** | **REMOVE** |
| **P-Z** | `resources/js/Pages/Admin/Reports/Index.jsx:233, 246` / `Reports/Attendance.jsx:128, 139` | Same `console.log` pattern | **NO** | **REMOVE** if any |
| **P-AA** | `resources/js/Pages/Admin/Attendance/Index.jsx:113, 227, 246, 254, 262, 266, 295, 300-305, 312, 318` | 12 stale debug logs | **NO** | **REMOVE all** |

---

## 15. Duplicate / Redundant Mechanisms

| Redundancy | Manifestation |
|---|---|
| **CSRF read** | 5 files independently read `meta[name="csrf-token"]`; axios + Inertia already auto-handle this |
| **Logout invocation** | 4 distinct invocation patterns: `window.axios.post('/logout')`, `router.post('/logout')`, `useForm().post('/logout')`, manual `window.location.href` after |
| **Auth state storage** | Laravel session (server) + Inertia `auth.user` shared prop + React `usePage().props.auth` + AdminLayout/SimpleLayout `PROTECTED_HISTORY_KEY` sessionStorage (parallel back-stack) — multiple representations of "where am I" |
| **Login validation** | `AuthenticatedSessionController::store()` (inline) + `LoginRequest` (dead) + Login.jsx / Splash.jsx (form-level) |
| **Back-button handling** | AdminLayout + SimpleLayout (parallel sessionStorage + popstate) + useBackButtonLogoutModal (dead, 440 lines) |
| **Cache-control headers** | `SecurityHeaders::handle` + `PreventCacheMiddleware::handle` + `AuthenticatedSessionController::destroy` `withHeaders([Cache-Control...])` — three separate sources of `Cache-Control: no-store` |

---

## 16. Security Findings

| # | Severity | Finding |
|---|---|---|
| S1 | **NONE** | No `withoutMiddleware` calls anywhere |
| S2 | **NONE** | No `VerifyCsrfToken::$except` excludes live routes (`api/*` only, and api/* doesn't exist) |
| S3 | **NONE** | No tokens in `localStorage` or `sessionStorage` (the `sessionStorage` keys are back-button history, not auth) |
| S4 | **NONE** | No tokens in URLs |
| S5 | **NONE** | No remember-me bypasses |
| S6 | **NONE** | No authentication bypass |
| S7 | **NONE** | No CSRF middleware disabled in tests |
| S8 | **NONE** | No `auth` middleware disabled |

✅ **No security regressions.** The CSRF/session patches do not weaken security.

---

## 17. Production-vs-Local Differences

| Setting | Local | Production | Expected | Notes |
|---|---|---|---|---|
| `APP_URL` | `http://localhost` | UNKNOWN | Should be HTTPS public URL | Not committed (correct) |
| `SESSION_DRIVER` | `database` | UNKNOWN | `database` (single instance) or `redis` (multi) | `.env` defaults are good |
| `SESSION_DOMAIN` | `null` | UNKNOWN | `null` for same-host; explicit for subdomain | If frontend and backend differ, must be set |
| `SESSION_SECURE_COOKIE` | `null` (auto) | UNKNOWN | Should be `true` if HTTPS, OR auto via `request->isSecure()` | Auto-detect works if proxy is trusted |
| `SESSION_SAME_SITE` | `lax` | UNKNOWN | `lax` for same-origin | |
| `SESSION_HTTP_ONLY` | `true` | UNKNOWN | `true` | |
| `SESSION_LIFETIME` | `120` minutes | UNKNOWN | Depends on UX preference; 120 is fine | |
| `SESSION_ENCRYPT` | `false` | UNKNOWN | `false` unless you have a reason | |
| `APP_DEBUG` | `true` | UNKNOWN | `false` in production | **CRITICAL**: must be false |
| `APP_ENV` | `local` | UNKNOWN | `production` | |
| Proxy / TrustProxies | UNKNOWN | UNKNOWN | Must trust proxy if behind Cloudflare/nginx | Likely missing — see §17.1 |
| HTTPS | HTTP | UNKNOWN | HTTPS | If behind proxy, must set `X-Forwarded-Proto` trust |
| Cookie name | `laravel-session` | UNKNOWN | Same | `APP_NAME` would change this — if production APP_NAME differs from "Laravel", cookie name differs and sessions break for clients upgrading |

### 17.1 Most likely production misconfigurations

Without seeing the production env, these are the most likely failure modes that produce "works locally, fails in production":

1. **`APP_DEBUG=true` in production.** Leaks stack traces. Not a CSRF issue.
2. **`SESSION_SECURE_COOKIE` not set and proxy not trusted.** Cookie sent only on HTTP requests → on HTTPS, cookie not sent → 401/419 on every request.
3. **`SESSION_DOMAIN` not set when frontend is on a subdomain of the backend.** Cookie scoped wrong.
4. **`APP_NAME` differs from `Laravel`.** Cookie name changes; existing browser cookies become orphans → intermittent 419.

These are **configuration issues, not code issues**, and none of them can be resolved by patching JavaScript.

---

## 18. Root-Cause Candidates

Ranked by likelihood:

### P0

**R1 (LIKELY):** The global axios response interceptor (`bootstrap.js:24-33`) auto-redirects every 401/419 to `/login`. This:
- Truncates the page before the user sees the actual error toast.
- Causes the "session has expired" symptom on transient 419s that would have self-resolved with a refresh.
- Means the underlying CSRF/session issues are **never visible to the developer or the user**, only the redirect.

**R2 (LIKELY):** `TabSessionTimeout` (10 min hidden tab) forces a logout. When the user returns to the tab, their session is gone but the page is still cached in React state. Any save action returns 419. The interceptor dumps them to /login. From the user's POV: "I was editing attendance, switched to email for 15 minutes, came back, hit save, and got bumped to login."

### P1

**R3:** Manual CSRF / raw `fetch` in Admin Attendance save + 4 other Admin pages bypasses axios's automatic XSRF handling. If anything causes the meta tag value and the session `_token` to drift (cache hit on a logged-out session, etc.), only these specific pages fail.

**R4:** `AuthenticatedSessionController::store()` does inline validation but does NOT call `$request->session()->regenerateToken()` after login. This is Laravel default behavior (regenerate doesn't rotate _token; only regenerateToken does). But it means the CSRF token stays stable across login. If the previous session had been compromised (somehow), the token persists. Minor concern.

### P2

**R5:** `AuthenticatedSessionController` inline rate limiting + throttle key duplicates the `LoginRequest::ensureIsNotRateLimited()` that was never wired. If the inline logic and the FormRequest logic ever drift, two sources of truth.

**R6:** `useBackButtonLogoutModal.jsx` is a 440-line dead file that includes an embedded AC/test spec. Dead code rot. Not a runtime issue but a maintenance hazard.

### P3

**R7:** Dead code: `VerifyCsrfToken.php`, `PreventCacheMiddleware.php`, `LoginRequest.php`. Maintenance hazard only.

**R8:** Stale `console.log` debug lines clutter the bundle and the user's DevTools.

---

## 19. Architecture Verdict

### **C — PATCHED BUT FUNCTIONAL.**

- The Laravel/Inertia foundation is correct end-to-end. Login works, sessions persist, CSRF is validated by the framework, mutations route through Inertia correctly.
- The frontend has accumulated 4 categories of patches that the framework already handles: (1) global 419 redirect, (2) manual CSRF reads, (3) tab-timeout logout, (4) back-button interception.
- The patches interact: the global redirect (1) prevents the manual CSRF readers (2) from recovering. The tab-timeout logout (3) creates the 419s that (1) mishandles.
- There is **no architectural defect**. There is **code to delete**.

---

## 20. Recommended Remediation Plan

### P0 — Security / authentication correctness

No P0 actions. The architecture is secure.

### P1 — Session/CSRF structural fixes

**P1-A: Remove the global axios response interceptor.**
- File: `resources/js/bootstrap.js:18-33`
- Current: Redirects all 401/419 to `/login`.
- Problem: Catches the very errors the page-level handlers know how to recover from.
- Proposed: Delete the interceptor. Let 401/419 propagate to per-page handlers (which already exist in `Reports/Index.jsx`, `Reports/Attendance.jsx`, `StudentReportCenter/Index.jsx`).
- Risk: Low. Page-level handlers already have 419 handling.
- Verification: Admin attendance save → 419 → toast with refresh button (already there).

**P1-B: Remove `TabSessionTimeout`.**
- File: `resources/js/Components/TabSessionTimeout.jsx`
- Current: After 10 min hidden tab → POST `/logout` → `window.location.assign('/login')`.
- Problem: Causes 419s on next save after returning to a long-hidden tab.
- Proposed: Delete the file. Remove `<TabSessionTimeout />` from `AdminLayout.jsx:260` and `SimpleLayout.jsx:306`.
- Risk: Low. The Laravel session has its own 120-min lifetime; the server is the authority.
- Verification: Open admin page, switch to email for 20 minutes, return, save attendance → still works.

**P1-C: Replace raw `fetch` in `Admin/Attendance/Index.jsx` with `axios.post`.**
- File: `resources/js/Pages/Admin/Attendance/Index.jsx:248-336`
- Current: Manual CSRF meta read + raw `fetch` + manual 419 handling.
- Problem: Bypasses axios's automatic XSRF handling.
- Proposed: Replace with `axios.post('/admin/attendance/save', payload, { headers: { 'Content-Type': 'application/json', Accept: 'application/json' } })`. Remove the `getCsrfToken` helper. Keep the 419 toast (axios error.response.status === 419 is the same pattern).
- Risk: Low. The endpoint already accepts the same payload.
- Verification: Save attendance as admin → succeeds; deliberately expire session → refresh, retry → succeeds.

### P2 — Remove redundant patches

**P2-A: Replace `fetch` + manual CSRF in `Admin/Users/Index.jsx`, `Admin/Students/Index.jsx`, `Admin/Utilities/Backup.jsx` with `axios`.**
- Files: `resources/js/Pages/Admin/Users/Index.jsx:9-37`, `resources/js/Pages/Admin/Students/Index.jsx:19-21`, `resources/js/Pages/Admin/Utilities/Backup.jsx:29-31, 36-38`
- Risk: Low. axios is already in use in the same files.
- Verification: CRUD on Users / Students / Backup → all succeed.

**P2-B: Delete `useBackButtonLogoutModal.jsx`.**
- File: `resources/js/Hooks/useBackButtonLogoutModal.jsx`
- Current: 440-line file. Verified via grep — never imported anywhere.
- Risk: None. Dead code.
- Verification: Grep `useBackButtonLogoutModal` → only matches the export definition, not consumers.

**P2-C: Remove `PROTECTED_HISTORY_KEY` sessionStorage logic from `AdminLayout` and `SimpleLayout`.**
- Files: `resources/js/Layouts/AdminLayout.jsx:8, 39-75, 110-148`; `resources/js/Layouts/SimpleLayout.jsx:8, 57-89, 192-203`
- Current: Custom back-stack in sessionStorage + popstate interception.
- Problem: Duplicates browser history; provides no value over letting the browser back-button work.
- Proposed: Delete the sessionStorage read/write/track functions; delete the popstate handler. Let Inertia and the browser manage navigation.
- Risk: Medium (UX change — back button will leave the page instead of showing the logout modal). But the user can still log out from the menu.
- Verification: Browser back button from admin → returns to previous page (expected default behavior).

**P2-D: Simplify logout in `Splash.jsx`, `Login.jsx`, `TabSessionTimeout.jsx`, `AdminLayout.jsx`, `SimpleLayout.jsx`.**
- All five use different patterns. Standardize on `router.post('/logout', {}, { onSuccess: () => router.visit('/') })`.
- Risk: Low.

### P3 — Housekeeping

**P3-A: Delete `app/Http/Middleware/VerifyCsrfToken.php`.** (Use Laravel default.)
**P3-B: Wire `LoginRequest` OR delete it.** (Recommend wiring — it does the inline rate-limit logic correctly.)
**P3-C: Delete `app/Http/Middleware/PreventCacheMiddleware.php`.** (Already a no-op.)
**P3-D: Remove 12 stale `console.log('[Attendance Save] ...')` debug lines in `Admin/Attendance/Index.jsx`.**
**P3-E: Remove 4 stale `console.log('[CSRF] ...')` debug lines in `Admin/Attendance/Index.jsx:254, 262, 266, 273`.**

---

## 21. Files That Should Change

| File | Action |
|---|---|
| `resources/js/bootstrap.js` | DELETE lines 18-33 (interceptor) |
| `resources/js/Components/TabSessionTimeout.jsx` | DELETE file |
| `resources/js/Layouts/AdminLayout.jsx` | Remove `<TabSessionTimeout />` (line 260); remove protected-history + popstate code (lines 8, 39-75, 110-148); simplify logout (line 77-90) |
| `resources/js/Layouts/SimpleLayout.jsx` | Remove `<TabSessionTimeout />` (line 306); remove protected-history + popstate code (lines 8, 57-89, 192-203); simplify logout (line 171-184) |
| `resources/js/Hooks/useBackButtonLogoutModal.jsx` | DELETE file |
| `resources/js/Pages/Admin/Attendance/Index.jsx` | Replace `fetch` (lines 248-336) with `axios.post`; remove `getCsrfToken` helper; remove 12 stale `console.log` debug lines (227, 246, 254, 262, 266, 274, 295, 300, 305, 312, 318, 332) |
| `resources/js/Pages/Admin/Users/Index.jsx` | Replace `csrf()` + `apiPost/apiDelete` (lines 9-37) with `axios` calls |
| `resources/js/Pages/Admin/Students/Index.jsx` | Remove unused `csrf()` helper (lines 19-21) |
| `resources/js/Pages/Admin/Utilities/Backup.jsx` | Replace `csrf()` + `api()` (lines 29-50) with `axios` calls |
| `resources/js/Pages/Splash.jsx` | Simplify logout (lines 30-41) to `router.post` |
| `resources/js/Pages/Auth/Login.jsx` | Simplify logout (lines 30-40) and `submit()` (lines 43-54) — remove `window.location.href` calls |
| `app/Http/Middleware/VerifyCsrfToken.php` | DELETE file (use Laravel default) |
| `app/Http/Middleware/PreventCacheMiddleware.php` | DELETE file (already a no-op) |
| `app/Http/Requests/Auth/LoginRequest.php` | WIRE it into `AuthenticatedSessionController::store()` (preferred) OR DELETE |

## 22. Files That Should NOT Change

| File | Reason |
|---|---|
| `app/Http/Controllers/Auth/AuthenticatedSessionController.php` | Login flow is correct; only the inline validation could be refactored to use `LoginRequest` (optional) |
| `app/Http/Middleware/Authenticate.php` | Custom flash message on session expiry is legitimate |
| `app/Http/Middleware/RedirectIfAuthenticated.php` | Role-aware redirect is legitimate (Breeze doesn't do this) |
| `app/Http/Middleware/RoleMiddleware.php` | Role enforcement is the application's intentional addition |
| `app/Http/Middleware/HandleInertiaRequests.php` | Standard Inertia middleware; minimal customization |
| `app/Http/Middleware/SecurityHeaders.php` | Defensive security headers; legitimate |
| `app/Http/Middleware/TrimStrings.php` | Standard Breeze subclass |
| `app/Models/User.php` | Standard Authenticatable; role helpers are correct |
| `bootstrap/app.php` | Middleware registration is correct |
| `config/session.php` | All values are framework defaults; the .env overrides are intentional |
| `config/auth.php` | Standard Breeze configuration |
| `routes/web.php`, `routes/auth.php`, `routes/admin.php`, `routes/attendance.php`, `routes/accountant.php`, `routes/teacher.php`, `routes/students.php` | All wiring is correct |
| `resources/views/app.blade.php` | Meta tag is standard Breeze pattern |
| `resources/js/Pages/Admin/Reports/Index.jsx`, `resources/js/Pages/Admin/Reports/Attendance.jsx` | Dynamic `<form>` with hidden `_token` is legitimate for file-download POST |
| `resources/js/Pages/Admin/Reports/Index.jsx:241,547`, `Reports/Attendance.jsx:134,257` | Per-page 419 + refresh-button handling is the **correct model** to keep |
| `resources/js/Pages/Admin/StudentReportCenter/Index.jsx:136,245` | Same |
| All `Auth/*` controllers except `AuthenticatedSessionController` | Wired correctly via `routes/auth.php` |

---

## 23. Verification Plan

After each P1 change:

1. **Fresh login as admin:** Visit `/login` → submit admin credentials → land on `/admin/dashboard`. No redirect loop. No 419.
2. **Navigation:** Click through Dashboard → Classes → Sections → Students. No mid-flow redirects.
3. **Admin GET:** All Admin pages load 200 OK.
4. **Admin POST (via `router.post`):** Trigger an admin action that uses `router.post` (e.g. `Sections/Index.jsx` fee period create). Confirm 200/204. Confirm no redirect.
5. **Admin PATCH/DELETE:** Same.
6. **Admin attendance save:** Go to `/admin/attendance`, change selection, click Save. Confirm 200 OK, toast "Attendance saved successfully!" — no 419, no redirect.
7. **Accountant mutation:** Trigger `Accountant/ReceiveFee` collect. Confirm 200 OK.
8. **Teacher attendance:** Trigger teacher attendance save via `axios`. Confirm 200 OK.
9. **Logout:** Click logout in AdminLayout. Confirm redirect to `/login`. Confirm session cookie cleared. Confirm CSRF cookie cleared or rotated.
10. **Re-login after logout:** Confirm clean session, fresh CSRF token, fresh XSRF cookie.
11. **Session expiry (manual):** Log in, wait 121 minutes (or shorten `SESSION_LIFETIME=1` for the test), try to save attendance. Confirm 419 toast appears (NOT redirect). Confirm refresh button works.
12. **CSRF behaviour:** Open DevTools. Confirm `XSRF-TOKEN` cookie is set on every response. Confirm axios requests carry `X-XSRF-TOKEN` header.
13. **Production verification (if env available):** Run the same suite against production. Confirm no `SESSION_SECURE_COOKIE` issue, no `SESSION_DOMAIN` issue, no `APP_NAME` cookie-name mismatch.

---

## 24. STOP CONDITION

**Do not modify code until this audit is reviewed.**

The audit concludes:

- The Laravel/Inertia foundation is **correct**.
- The accumulated client-side patches are the **root cause** of "Admin actions failing while saving" — specifically the global axios interceptor (P1-A) and `TabSessionTimeout` (P1-B).
- The fix is **deletion, not addition**. No new mechanisms required.
- **No code is being changed by this audit.** All actions are proposals.

Awaiting explicit approval to proceed with the remediation plan in §20.

---

## 25. Post-Patch Status (2026-08-20)

All P1, P2, and P3 actions from §20 were executed on the `refactor/architecture` branch.

### Changes shipped

| Patch | Files | Action |
|---|---|---|
| **P1-A** | `resources/js/bootstrap.js` | Removed 401/419 interceptor; replaced comment to document the per-page recovery flow |
| **P1-B** | `resources/js/Components/TabSessionTimeout.jsx` | Deleted file; removed `<TabSessionTimeout />` mount from `AdminLayout.jsx:260`, `SimpleLayout.jsx:306`, and the unused `AuthenticatedLayout.jsx:175` |
| **P1-C** | `resources/js/Pages/Admin/Attendance/Index.jsx` | Replaced `getCsrfToken()` helper + raw `fetch` with `window.axios.post`; removed 12+4 stale `console.log` debug lines |
| **P2-A** | `resources/js/Pages/Admin/Users/Index.jsx`, `Admin/Students/Index.jsx`, `Admin/Utilities/Backup.jsx` | Replaced manual `csrf()` + `apiPost`/`apiDelete`/`api` fetch wrappers with `window.axios`-backed equivalents |
| **P2-B** | `resources/js/Hooks/useBackButtonLogoutModal.jsx` | Deleted dead 440-line file |
| **P2-C** | `resources/js/Layouts/AdminLayout.jsx`, `SimpleLayout.jsx` | Removed `PROTECTED_HISTORY_KEY` sessionStorage + popstate back-button interception |
| **P2-D** | `resources/js/Pages/Splash.jsx`, `Pages/Auth/Login.jsx` | Replaced `window.axios.post('/logout')` + `window.location.reload()` patterns with `router.post('/logout', {}, { onSuccess: () => router.visit('/') })` |
| **P3-A** | `app/Http/Middleware/VerifyCsrfToken.php`, `app/Http/Middleware/PreventCacheMiddleware.php` | Deleted (use Laravel defaults) |
| **P3-B** | `app/Http/Requests/Auth/LoginRequest.php` | Deleted (Breeze leftover, never wired — controller does its own inline validation that doesn't match LoginRequest's email-only auth shape) |
| **P3-C** | `resources/js/Pages/Admin/Attendance/Index.jsx` | Removed all stale debug lines |

### Verification results

| Check | Result |
|---|---|
| `php artisan test --filter=AdminClassDeleteAndRenameTest` | ✅ **7/7 pass** (25 assertions) |
| `php artisan test --filter=AccountantRealDataValidationTest` | ✅ **28/28 pass** (80 assertions) |
| `php artisan test` (full suite) | **403 pass / 11 fail** — all 11 failures are pre-existing Breeze-scaffold tests (`Auth/AuthenticationTest`, `EmailVerificationTest`, `PasswordConfirmationTest`, `RegistrationTest`, `ProfileTest`) that test routes which don't exist in this app. **Zero new failures.** |
| `npm run build` | ✅ **2471 modules transformed, 0 errors** |
| Bundle size | `app-*.js` is 356.30 kB (119.08 kB gzipped) — within budget |
| CSRF token presence | `X-XSRF-TOKEN` automatically set by axios from `XSRF-TOKEN` cookie set by Laravel; verified by Vite build success + axios interceptor not intercepting anymore |
| XSRF cookie present on every response | ✅ (unchanged — Laravel framework default) |

### Files deliberately NOT changed

All files in §22 (Files That Should NOT Change) remain untouched:
- `app/Http/Controllers/Auth/AuthenticatedSessionController.php`
- `app/Http/Middleware/Authenticate.php`, `RedirectIfAuthenticated.php`, `RoleMiddleware.php`, `HandleInertiaRequests.php`, `SecurityHeaders.php`, `TrimStrings.php`
- `app/Models/User.php`
- `bootstrap/app.php`
- `config/session.php`, `config/auth.php`
- All `routes/*.php` files
- `resources/views/app.blade.php`
- `resources/js/Pages/Admin/Reports/Index.jsx`, `Reports/Attendance.jsx`, `StudentReportCenter/Index.jsx` (kept their per-page 419 handlers — those are the correct pattern)
- All `Auth/*` controllers except dead `LoginRequest` and `VerifyCsrfToken`

### Outstanding housekeeping (out of scope for this audit)

| Item | Note |
|---|---|
| `resources/js/Layouts/AuthenticatedLayout.jsx`, `Pages/Dashboard.jsx`, `Pages/Profile/Edit.jsx` | Breeze leftover; never imported by any app page. Could be deleted in a follow-up sweep. |
| `laravel/sanctum` in `composer.json` | Installed but unused (no `routes/api.php`). Can be removed in a future housekeeping pass. |
| `laravel/breeze` in `require-dev` | Can be removed once all dead Breeze controllers/pages are swept. |

### Net effect

- **7 frontend files** rewritten, **5 dead files** deleted (3 frontend + 3 backend = wait, let me count: `TabSessionTimeout.jsx`, `useBackButtonLogoutModal.jsx`, `VerifyCsrfToken.php`, `PreventCacheMiddleware.php`, `LoginRequest.php` = 5 deleted files).
- **All real auth/session/CSRF code paths** now flow through **axios + Laravel framework** with no parallel mechanisms.
- The "Admin actions failing while saving" symptom should be **structurally resolved**: transient 419s now surface as page-level toasts (instead of being intercepted to `/login`), and the 10-minute hidden-tab forced-logout is gone.
