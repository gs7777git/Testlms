
import React from 'react';

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  wrapperClassName?: string;
  options: { value: string | number; label: string }[];
  placeholder?: string;
}

export const Select: React.FC<SelectProps> = ({ label, id, error, options, className = '', wrapperClassName = '', placeholder, ...htmlSelectProps }) => {
  const baseStyle = "block w-full pl-3 pr-10 py-2 text-base border-secondary-300 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm rounded-md shadow-sm";
  const errorStyle = "border-red-500 focus:ring-red-500 focus:border-red-500";
  
  return (
    <div className={wrapperClassName}>
      {label && (
        <label htmlFor={id} className="block text-sm font-medium text-secondary-700 mb-1">
          {label}
        </label>
      )}
      <select
        id={id}
        className={`${baseStyle} ${error ? errorStyle : ''} ${className}`}
        aria-required={htmlSelectProps.required}
        aria-invalid={!!error}
        {...htmlSelectProps}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map(option => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error && <p className="mt-1 text-sm text-red-600" id={`${id}-error-message`}>{error}</p>}
    </div>
  );
};