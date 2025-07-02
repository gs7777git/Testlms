
import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  wrapperClassName?: string;
}

export const Input: React.FC<InputProps> = ({ label, id, error, className = '', wrapperClassName = '', ...props }) => {
  const baseStyle = "block w-full px-3 py-2 border border-secondary-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm";
  const errorStyle = "border-red-500 focus:ring-red-500 focus:border-red-500";

  return (
    <div className={wrapperClassName}>
      {label && (
        <label htmlFor={id} className="block text-sm font-medium text-secondary-700 mb-1">
          {label}
        </label>
      )}
      <input
        id={id}
        className={`${baseStyle} ${error ? errorStyle : ''} ${className}`}
        aria-required={props.required}
        aria-invalid={!!error}
        {...props}
      />
      {error && <p className="mt-1 text-sm text-red-600" id={`${id}-error-message`}>{error}</p>}
    </div>
  );
};

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  wrapperClassName?: string;
}

export const Textarea: React.FC<TextareaProps> = ({ label, id, error, className = '', wrapperClassName = '', ...props }) => {
  const baseStyle = "block w-full px-3 py-2 border border-secondary-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm";
  const errorStyle = "border-red-500 focus:ring-red-500 focus:border-red-500";

  return (
    <div className={wrapperClassName}>
      {label && (
        <label htmlFor={id} className="block text-sm font-medium text-secondary-700 mb-1">
          {label}
        </label>
      )}
      <textarea
        id={id}
        className={`${baseStyle} ${error ? errorStyle : ''} ${className}`}
        rows={3}
        aria-required={props.required}
        aria-invalid={!!error}
        {...props}
      />
      {error && <p className="mt-1 text-sm text-red-600" id={`${id}-error-message`}>{error}</p>}
    </div>
  );
};