import React from 'react';

export const ReportsPage: React.FC = () => {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-secondary-900">Sales Reports</h1>
      <div className="mt-4 p-6 bg-white shadow rounded-lg">
        <p className="text-secondary-600">
          Sales reports and charts, based on data from your organization in Supabase, will be displayed here. This section is under construction.
        </p>
        <div className="mt-6 border-2 border-dashed border-secondary-300 rounded-lg h-96 flex items-center justify-center">
            <p className="text-secondary-500">Chart Area Placeholder (Data from Supabase)</p>
        </div>
      </div>
    </div>
  );
};