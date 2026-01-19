import { useEffect, useRef, useState } from "react";

export default function EditableCell({
  initialValue,
  rowIndex,
  columnId,
  updateCell,
  focusTarget,
  clearFocusTarget,
  placeholder,
}) {
  const ref = useRef(null);
  const [value, setValue] = useState(initialValue ?? "");

  // Sync only when row truly changes
  useEffect(() => {
    setValue(initialValue ?? "");
  }, [initialValue]);

  // Controlled autofocus (ONE TIME)
  useEffect(() => {
    if (
      focusTarget &&
      focusTarget.rowIndex === rowIndex &&
      focusTarget.columnId === columnId
    ) {
      requestAnimationFrame(() => {
        ref.current?.focus();
        ref.current?.select();
        clearFocusTarget();
      });
    }
  }, [focusTarget]);

  const commit = () => {
    updateCell(rowIndex, columnId, value);
  };

  return (
    <input
      ref={ref}
      defaultValue={initialValue ?? ""}
      value={value}
      placeholder={placeholder}
      onChange={(e) => setValue(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          ref.current.blur();
        }
      }}
      className="w-full px-2 py-1 border rounded text-sm focus:outline-none focus:ring-1 focus:ring-gray-400"
    />
  );
}
