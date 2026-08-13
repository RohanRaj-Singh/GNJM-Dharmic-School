/**
 * Small shared filter-bar primitives (Sprint 4.2).
 *
 * Filter panels across the app repeat two tiny blocks: a labelled field
 * wrapper and an "All X" <select>. These primitives own that markup so
 * pages keep only their data and layout. Every class is overridable so
 * each page's current output is preserved exactly.
 *
 * - `FilterField` → `<div><label>…</label>…</div>` (label classes match the
 *   app's standard `block text-xs text-gray-500 mb-1`). Omit `label` to get
 *   a plain wrapper div.
 * - `FilterSelect` → `<select>` with a leading "All X" option. `options` are
 *   `[{ value, label }]`; pages map their own data shapes (e.g. `{ id, name }`)
 *   onto that. `allValue` is the "All" option's value; `placeholder` its text.
 *
 * Not a rigid bar layout: panels differ too much (toolbar vs card grid vs
 * collapsible panel) for a shared shell to have a real responsibility.
 */

export function FilterField({ label, htmlFor, className, children }) {
  return (
    <div className={className}>
      {label ? (
        <label htmlFor={htmlFor} className="block text-xs text-gray-500 mb-1">
          {label}
        </label>
      ) : null}
      {children}
    </div>
  );
}

const SELECT_CLASS = "border rounded px-3 py-2 text-sm";

export function FilterSelect({
  value,
  onChange,
  options = [],
  placeholder = "All",
  allValue = "all",
  disabled,
  className = SELECT_CLASS,
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className={className}
    >
      <option value={allValue}>{placeholder}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
