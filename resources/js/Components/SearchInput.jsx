import { useRef } from 'react';

/**
 * SearchInput - Simple search input that doesn't interfere with focus
 * 
 * @param {string} value - Current input value
 * @param {Function} onChange - Callback when value changes
 * @param {string} placeholder - Placeholder text
 * @param {string} className - Additional CSS classes
 */
export default function SearchInput({ value, onChange, placeholder, className }) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={className}
    />
  );
}