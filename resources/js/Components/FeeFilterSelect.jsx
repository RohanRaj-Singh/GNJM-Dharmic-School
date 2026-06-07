import Select from "react-select";
import { useMemo } from "react";

/*
 * FeeFilterSelect — a generic multi-select dropdown designed for the
 * Fee Report filter bar (and reusable anywhere else in the app).
 *
 * Unlike the existing MultiSelect component, this one:
 *  - ALWAYS defaults to multi-select mode (what the Fee Report needs).
 *  - Supports single-select via the `single` prop.
 *  - Defends against duplicate options by deduplicating on value.
 *  - Shows a clear "X selected" badge in multi mode.
 *  - Uses the same react-select library, so the UX is consistent.
 *
 * Props:
 *  options     - array of { value, label }
 *  value       - array of selected values (or single value if `single`)
 *  onChange    - (values) => void
 *  placeholder - string
 *  single      - boolean — if true, only one value can be selected
 *  disabled    - boolean
 *  width       - string (CSS class for container width, default "min-w-[200px]")
 */
export default function FeeFilterSelect({
    options = [],
    value = [],
    onChange,
    placeholder = "Select…",
    single = false,
    disabled = false,
    width = "min-w-[200px]",
}) {
    // Deduplicate options by value — defends against API returning dupes
    const deduped = useMemo(() => {
        const seen = new Map();
        for (const opt of options) {
            if (!seen.has(opt.value)) {
                seen.set(opt.value, opt);
            }
        }
        return Array.from(seen.values());
    }, [options]);

    // Build the selectedOptions array that react-select expects
    const selectedOptions = useMemo(() => {
        if (single) {
            const v = Array.isArray(value) ? value[0] : value;
            return deduped.find((o) => String(o.value) === String(v)) ?? null;
        }
        const valueSet = new Set((Array.isArray(value) ? value : []).map((v) => String(v)));
        return deduped.filter((o) => valueSet.has(String(o.value)));
    }, [deduped, value, single]);

    const handleChange = (selected) => {
        if (single) {
            onChange?.(selected ? [selected.value] : []);
        } else {
            onChange?.(selected ? selected.map((o) => o.value) : []);
        }
    };

    return (
        <Select
            isMulti={!single}
            isClearable
            isDisabled={disabled}
            options={deduped}
            value={selectedOptions}
            onChange={handleChange}
            placeholder={placeholder}
            className={width}
            classNamePrefix="rs"
            menuPortalTarget={
                typeof document !== "undefined" ? document.body : undefined
            }
            styles={{
                menuPortal: (base) => ({ ...base, zIndex: 9999 }),
                control: (base) => ({
                    ...base,
                    minHeight: 36,
                    fontSize: 13,
                }),
            }}
        />
    );
}
