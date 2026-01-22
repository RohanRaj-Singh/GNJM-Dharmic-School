import Select from "react-select";
import { useMemo } from "react";

export default function MultiSelect({
  options = [],
  value = [],
  onChange,
  placeholder = "Select…",
}) {
  /**
   * IMPORTANT:
   * - options must be stable
   * - value must be derived ONCE per change
   */

  const selectedOptions = useMemo(() => {
    const valueSet = new Set(value.map(String));
    return options.filter(o => valueSet.has(String(o.value)));
  }, [options, value]);

  return (
    <Select
      isMulti
      options={options}
      value={selectedOptions}
      onChange={(selected) =>
        onChange(selected ? selected.map(o => o.value) : [])
      }
      placeholder={placeholder}
      className="min-w-[220px]"
      classNamePrefix="rs"
      menuPortalTarget={document.body}
      styles={{
        menuPortal: base => ({ ...base, zIndex: 9999 }),
      }}
    />
  );
}
