
import React from 'react';
import { useAuth } from '../contexts/AuthContext';

export const DashboardPage: React.FC = () => {
  const { profile } = useAuth(); // Use 'profile' which contains full_name from Supabase

  return (
    <div>
      <h1 className="text-2xl font-semibold text-secondary-900">Dashboard</h1>
      <div className="mt-4 p-6 bg-white shadow rounded-lg">
        <h2 className="text-xl font-medium text-secondary-800">Welcome, {profile?.full_name || 'User'}!</h2>
        <p className="mt-2 text-secondary-600">
          This is your CRM dashboard. KPIs and summaries for your organization (Org ID: {profile?.org_id || 'N/A'}) will be displayed here.
        </p>
        {/* TODO: Fetch and display actual data from Supabase based on profile.org_id */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="bg-primary-50 p-4 rounded-lg shadow">
            <h3 className="text-lg font-medium text-primary-700">Total Leads</h3>
            <p className="text-3xl font-bold text-primary-900">--</p> {/* Placeholder */}
          </div>
          <div className="bg-green-50 p-4 rounded-lg shadow">
            <h3 className="text-lg font-medium text-green-700">Converted Leads</h3>
            <p className="text-3xl font-bold text-green-900">--</p> {/* Placeholder */}
          </div>
          <div className="bg-yellow-100 p-4 rounded-lg shadow">
            <h3 className="text-lg font-medium text-yellow-700">Active Deals</h3>
            <p className="text-3xl font-bold text-yellow-900">--</p> {/* Placeholder */}
          </div>
        </div>
         <div className="mt-8">
            <h3 className="text-lg font-medium text-secondary-800">Recent Activities</h3>
            <p className="text-sm text-secondary-500">Activity feed will appear here (e.g., from 'lead_activities' table).</p>
            {/* Placeholder for activity feed */}
            <div className="mt-4 border-2 border-dashed border-secondary-200 rounded-lg p-4 h-48">
                 <p className="text-secondary-400">No recent activities.</p>
            </div>
        </div>
      </div>
    </div>
  );
};