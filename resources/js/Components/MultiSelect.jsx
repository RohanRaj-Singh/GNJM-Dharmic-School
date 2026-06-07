import Select from "react-select";
import { useMemo } from "react";

/*
 * Drop-in wrapper around react-select that honours a `single` flag.
 *
 * Modes:
 *  - default (no `single`): multi-select, returns an array of values.
 *  - `single`: behaves like a single dropdown. The user can:
 *      - click an option to select it
 *      - click the same option again to deselect it (toggle)
 *      - click the × on the right of the control to clear
 *      - the dropdown is `isMulti={false}` so the chip UI doesn't show
 *        a removable token; the displayed text is the option label
 *
 * `clearable` (default true) controls whether the × clear button is
 * shown. Set to false to make selection mandatory.
 *
 * `value` is always an array on the way in (we coerce to/from the
 * underlying react-select contract).
 */
export default function MultiSelect({
  options = [],
  value = [],
  onChange,
  placeholder = "Select…",
  isMulti = false,
  single = false,
  clearable = true,
  isDisabled = false,
  menuPortalTarget,
  styles,
}) {
  const isSingleMode = single || !isMulti;

  const selectedOptions = useMemo(() => {
    const valueSet = new Set((value || []).map((v) => String(v)));
    return options.filter((o) => valueSet.has(String(o.value)));
  }, [options, value]);

  const handleChange = (selected) => {
    if (isSingleMode) {
      // react-select (single mode) returns the selected option object, or null when cleared.
      // We coerce to an array to keep the parent's value contract uniform.
      if (!selected) {
        onChange?.([]);
        return;
      }
      const newValue = selected.value;
      const currentValue = (value || [])[0];
      // Toggle: clicking the already-selected option deselects it.
      if (String(newValue) === String(currentValue)) {
        onChange?.([]);
        return;
      }
      onChange?.([newValue]);
      return;
    }

    // Multi mode.
    onChange?.(selected ? selected.map((o) => o.value) : []);
  };

  const handleChangeMulti = (selected) => {
    // Same logic as handleChange but in multi mode: react-select returns an array.
    if (isSingleMode) {
      if (!selected) {
        onChange?.([]);
        return;
      }
      const newValue = selected.value;
      const currentValue = (value || [])[0];
      if (String(newValue) === String(currentValue)) {
        onChange?.([]);
        return;
      }
      onChange?.([newValue]);
      return;
    }
    onChange?.(selected ? selected.map((o) => o.value) : []);
  };

  return (
    <Select
      isMulti={!isSingleMode}
      isClearable={clearable}
      isDisabled={isDisabled}
      options={options}
      value={isSingleMode ? selectedOptions[0] || null : selectedOptions}
      onChange={isSingleMode ? handleChange : handleChangeMulti}
      placeholder={placeholder}
      className="min-w-[220px]"
      classNamePrefix="rs"
      menuPortalTarget={menuPortalTarget || (typeof document !== "undefined" ? document.body : undefined)}
      styles={{
        menuPortal: (base) => ({ ...base, zIndex: 9999 }),
        ...(styles || {}),
      }}
    />
  );
}
