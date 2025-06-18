
import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { reportService } from '@/services/api';
import { Spinner } from '@/components/common/Spinner';
import { LeadStatus, SalesReportData, LeadsByStatusReportItem, LeadsBySourceReportItem, DealsByStatusReportItem, DealStatus, ChartDataPoint } from '@/types';

export const ReportsPage: React.FC = () => {
  const { profile } = useAuth();
  const [reportData, setReportData] = useState<Partial<SalesReportData>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (profile?.org_id) {
      setIsLoading(true);
      setError(null);
      reportService.getLeadStats(profile.org_id)
        .then(processedData => {
            setReportData(processedData);
        })
        .catch(err => {
          console.error("Failed to fetch report data:", err);
          setError("Could not load report data. Please try again.");
        })
        .finally(() => setIsLoading(false));
    } else {
        setIsLoading(false);
        if (!profile) setError("User profile not available."); 
    }
  }, [profile]);

  if (isLoading) {
    return <div className="flex justify-center items-center h-64"><Spinner size="lg" /></div>;
  }

  if (error) {
    return <div className="p-4 bg-red-100 text-red-700 rounded-md" role="alert">{error}</div>;
  }

  const StatCard: React.FC<{ title: string; value: string | number | undefined; subtext?: string; formatAsCurrency?: boolean }> = ({ title, value, subtext, formatAsCurrency = false }) => {
    let displayValue = '--';
    if (value !== undefined) {
        if (formatAsCurrency && typeof value === 'number') {
            displayValue = `$${value.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
        } else {
            displayValue = value.toString();
        }
    }

    return (
    <div className="bg-white shadow-lg rounded-xl p-6">
      <h4 className="text-md font-semibold text-secondary-600">{title}</h4>
      <p className="text-3xl font-bold text-primary-700 mt-1">{displayValue}</p>
      {subtext && <p className="text-xs text-secondary-500 mt-1">{subtext}</p>}
    </div>
  )};

  const BarChartPlaceholder: React.FC<{ title: string; data?: ChartDataPoint[] }> = ({ title, data }) => {
    return (
      <div className="bg-white shadow-xl rounded-xl p-6">
        <h2 className="text-xl font-semibold text-secondary-800 mb-4">{title}</h2>
        {data && data.length > 0 ? (
          <ul className="space-y-2">
            {data.map((item, index) => (
              <li key={index} className="flex justify-between items-center py-2 border-b border-secondary-200 last:border-b-0">
                <span className="text-secondary-700">{item.name}</span>
                <div className="flex items-center">
                 {item.total_value !== undefined && <span className="text-sm text-green-600 mr-2">(${item.total_value.toLocaleString()})</span>}
                  <span className="font-semibold text-primary-600">{item.value}</span>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-secondary-500">No data available for this chart.</p>
        )}
      </div>
    );
  };

  // Prepare data for charts
  const leadsByStatusChartData: ChartDataPoint[] | undefined = reportData.leadsByStatus?.map(s => ({name: s.status, value: s.count}));
  const leadsBySourceChartData: ChartDataPoint[] | undefined = reportData.leadsBySource?.map(s => ({name: s.source, value: s.count}));
  const dealsByStatusChartData: ChartDataPoint[] | undefined = reportData.dealsByStatus?.map(s => ({name: s.status, value: s.count, total_value: s.total_value}));


  return (
    <div>
      <h1 className="text-3xl font-bold text-secondary-900 mb-6">Sales & Deals Reports</h1>
      
      <h2 className="text-2xl font-semibold text-secondary-800 mt-8 mb-4">Lead Statistics</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard title="Total Leads" value={reportData.totalLeads} />
        <StatCard title="Converted Leads" value={reportData.convertedLeadsCount} />
        <StatCard title="Lost Leads" value={reportData.lostLeadsCount} />
        <StatCard title="Conversion Rate" value={reportData.conversionRate !== undefined ? `${reportData.conversionRate}%` : '--'} subtext="Converted / (Total - New)" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        <BarChartPlaceholder title="Leads by Status" data={leadsByStatusChartData} />
        <BarChartPlaceholder title="Leads by Source" data={leadsBySourceChartData} />
      </div>

      <h2 className="text-2xl font-semibold text-secondary-800 mt-10 mb-4">Deal Statistics</h2>
       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard title="Total Deals" value={reportData.totalDeals} />
        <StatCard title="Value of Won Deals" value={reportData.totalWonDealsValue} formatAsCurrency={true} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-1 gap-8">
         <BarChartPlaceholder title="Deals by Status (Count & Value)" data={dealsByStatusChartData} />
      </div>


    </div>
  );
};