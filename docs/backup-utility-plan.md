# Database Backup & Restore Utility — Implementation Plan

## Audit Summary

| Item | Finding |
|------|---------|
| **Framework** | Laravel 12 + Inertia.js 2 + React 18 |
| **Database** | MySQL (`gnjm_dharmic_school`), with SQLite fallback |
| **PHP** | ^8.2 |
| **mysqldump** | Unknown on target server — must not assume availability |
| **Roles** | `admin`, `accountant`, `teacher` — stored as string on `users.role` |
| **Existing backup** | None — no backup packages installed |
| **Storage disk** | `local` — filesystem configured, `storage/app/` available |
| **Compression** | No gzip/zip packages installed — use PHP native zlib/gzencode |
| **Auth** | Inertia-based with Sanctum |
| **Icons** | lucide-react ^0.562.0 available |

---

## Backend Strategy

### Export Method (Priority Order)

1. **Try `mysqldump`** — check if the binary exists via `shell_exec('which mysqldump')` or `command -v mysqldump`. If available, use:
   ```
   mysqldump --opt --single-transaction --routines --triggers \
     -h{host} -P{port} -u{user} -p{password} {database}
   ```
   Pipe output through `gzip` for compression.

2. **Fallback: PHP native export** — If `mysqldump` is unavailable, use a pure PHP approach:
   - `DB::select('SHOW TABLES')` to get all tables
   - For each table: `SHOW CREATE TABLE` for schema + `SELECT *` for data
   - Stream output to avoid memory exhaustion
   - Use prepared statements and chunked reads for large tables

3. **Third-party package option**: `spatie/db-dumper` (supports both MySQL and SQLite, auto-detects mysqldump availability) — lightweight, well-maintained.

### Recommended: Custom PHP Exporter

Since this is a school ERP, the hosting environment is unknown. A custom PHP exporter is the safest choice:
- Works on any PHP host (shared hosting, VPS, etc.)
- No external binary dependencies
- Supports MySQL + SQLite transparently
- Built-in gzip compression via `gzencode()`
- Generates valid SQL with `INSERT` statements
- Streams output to avoid memory issues with large databases

### Storage

**Path**: `storage/app/backups/`
- Outside `public/` — not web-accessible
- Covered by `.gitignore` pattern for `storage/app/`

**Naming**: `backup-YYYY-MM-DD-HHmmss.sql.gz`
- Example: `backup-2026-07-20-143052.sql.gz`
- Sortable, human-readable, unique

### Cleanup Strategy (Future V1.1)

- Configurable max backups (default: 30)
- Auto-delete oldest backups when limit exceeded
- Configurable retention days for daily/weekly/monthly

### Backup Metadata Table

```sql
CREATE TABLE backups (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    filename VARCHAR(255) NOT NULL,
    file_path VARCHAR(512) NOT NULL,
    file_size BIGINT UNSIGNED NOT NULL DEFAULT 0,
    db_size BIGINT UNSIGNED NOT NULL DEFAULT 0,
    checksum VARCHAR(64) NOT NULL,
    app_version VARCHAR(32) NULL,
    laravel_version VARCHAR(32) NULL,
    migration_count INT UNSIGNED NOT NULL DEFAULT 0,
    status ENUM('created', 'failed', 'restoring', 'restored', 'deleted') DEFAULT 'created',
    created_by BIGINT UNSIGNED NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);
```

### Implementation Strategy

The backend approach uses Inertia for the initial HTML/React render. The backup API endpoints use standard Laravel REST.

### Backend Routes

| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/admin/utilities/backup` | Render the React page |
| GET | `/admin/utilities/backup/overview` | Return overview stats (JSON) |
| GET | `/admin/utilities/backup/history` | Return backup list (JSON) |
| POST | `/admin/utilities/backup/create` | Trigger backup creation (streaming response for progress) |
| GET | `/admin/utilities/backup/{id}/download` | Download backup file |
| POST | `/admin/utilities/backup/{id}/restore` | Restore from backup |
| DELETE | `/admin/utilities/backup/{id}` | Delete backup file + record |

### Middleware / Permissions

All backup routes must be wrapped in:
```php
Route::middleware(['auth', 'can:manage-backups'])
```

Or more simply, since only `admin` role can access:
```php
->middleware(function ($request, $next) {
    if (auth()->user()?->role !== 'admin') abort(403);
    return $next($request);
});
```

### Logging

All backup and restore operations write to a dedicated log channel:
- Channel: `backup` (in `config/logging.php`)
- File: `storage/logs/backup.log`
- Events: backup created, downloaded, restored, deleted, failed

### Failure Handling

- If mysqldump fails and PHP fallback fails → record as `failed` in backups table, show error
- If restore fails mid-way → attempt rollback if possible, log error, show diagnostic info
- File system errors (disk full, permissions) → catch and display actionable message
- Never leave database in partial state during restore

### Safety Measures

- Unused for now
