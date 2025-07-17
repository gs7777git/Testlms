
import React from 'react';
import { Link } from 'react-router-dom';

export const StatCard: React.FC<{ title: string; value: string | number | undefined | React.ReactNode; subtext?: string; formatAsCurrency?: boolean; icon?: React.ReactNode; color?: string; linkTo?: string; linkState?: any; }> = ({ title, value, subtext, formatAsCurrency = false, icon, color = 'text-primary-700', linkTo, linkState }) => {
    let displayValue: string | number | React.ReactNode;

    if (React.isValidElement(value)) {
        displayValue = value;
    } else if (value === undefined) {
        displayValue = '--';
    } else if (value === null) {
        displayValue = '--';
    } else {
        if (formatAsCurrency && typeof value === 'number') {
            displayValue = `$${value.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
        } else {
            displayValue = value.toString();
        }
    }


    const content = (
      <>
        <div className="flex items-center justify-between">
          <h4 className="text-md font-semibold text-secondary-600 truncate" title={title}>{title}</h4>
          {icon && <div className={`text-3xl opacity-70 ${color}`}>{icon}</div>}
        </div>
        <p className={`text-3xl font-bold ${color} mt-1 truncate`} title={typeof displayValue === 'string' ? displayValue : undefined}>{displayValue}</p>
        {subtext && <p className="text-xs text-secondary-500 mt-1">{subtext}</p>}
      </>
    );

    return (
      <div className="bg-white shadow-lg rounded-xl p-6 transform hover:scale-105 transition-transform duration-200">
        {linkTo ? (
          <Link to={linkTo} state={linkState} className="block hover:bg-secondary-50 -m-1 p-1 rounded-md">
            {content}
          </Link>
        ) : (
          content
        )}
      </div>
    );
};
