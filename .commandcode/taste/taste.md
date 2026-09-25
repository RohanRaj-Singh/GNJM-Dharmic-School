# General Preferences

## Workflow / Data Management

- Prefers restoring app data from existing timestamped SQL backup snapshots (stored under `Downloads`, e.g. `backup-YYYY-MM-DD-HHMMSS.sql.gz`) rather than creating new synthetic users or credentials when data goes missing. Confidence: 0.85

## UI/UX Preferences

- Wants bulk-edit capability in admin utility pages: inline per-row editing controls that stay visible even when a row is collapsed, so many records can be adjusted at once rather than one-at-a-time. Confidence: 0.78
- Wants explicit visual change-highlighting on edited rows (e.g. an amber border + "Changed" badge) plus a review summary with a count and a "Review & Apply All" flow, so changes are auditable before being committed. Confidence: 0.82

## Coding Style

- Prefers removing hard data-guard "lock"/blocker conditions on admin edits (e.g. "locked after payments") and instead allowing the edit while clamping the value to a computed safe bound (e.g. the unpaid tail / months since the last paid month) server-side, rather than rejecting the request. Wants edge-case bounds checked even when honoring admin intent. Confidence: 0.82
