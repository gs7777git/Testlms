
import React, { Fragment } from 'react';
import { XMarkIcon } from './Icons';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  titleId?: string; // For aria-labelledby
  contentId?: string; // For aria-describedby
}

export const Modal: React.FC<ModalProps> = ({ 
  isOpen, 
  onClose, 
  title, 
  children, 
  size = 'md',
  titleId = 'modal-title',
  contentId = 'modal-content'
}) => {
  if (!isOpen) return null;

  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black bg-opacity-50 transition-opacity duration-300"
      onClick={onClose}
      role="dialog" // Added ARIA role
      aria-modal="true" // Added ARIA attribute
      aria-labelledby={title ? titleId : undefined}
      aria-describedby={contentId} 
    >
      <div
        className={`relative bg-white rounded-lg shadow-xl p-6 m-4 w-full ${sizeClasses[size]} transform transition-all duration-300 ease-out`}
        onClick={(e) => e.stopPropagation()} // Prevent click inside modal from closing it
      >
        {title && (
          <div className="flex items-center justify-between pb-3 border-b border-secondary-200">
            <h3 className="text-lg font-medium leading-6 text-secondary-900" id={titleId}>{title}</h3>
            <button
              onClick={onClose}
              className="text-secondary-400 hover:text-secondary-500 focus:outline-none"
              aria-label="Close modal"
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>
        )}
        {!title && (
             <button
              onClick={onClose}
              className="absolute top-4 right-4 text-secondary-400 hover:text-secondary-500 focus:outline-none"
              aria-label="Close modal"
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
        )}
        <div className="mt-4" id={contentId}>
          {children}
        </div>
      </div>
    </div>
  );
};