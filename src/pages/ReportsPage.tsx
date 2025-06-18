
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { reportService } from '@/services/api';
import { Spinner } from '@/components/common/Spinner';
import { SalesReportData, ChartDataPoint } from '@/types';

export const StatCard: React.FC<{ title: string; value: string | number | undefined | React.ReactNode; subtext?: string; formatAsCurrency?: boolean; icon?: React.ReactNode; color?: string; linkTo?: string; linkState?: any; }> = ({ title, value, subtext, formatAsCurrency = false, icon, color = 'text-primary-700', linkTo, linkState }) => {
    let displayValue: string | number | React.ReactNode = '--';
    if (React.isValidElement(value)) {
        displayValue = value;
    } else if (value !== undefined && value !== null) {
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
          {icon && <div className={`text-3xl ${color}`}>{icon}</div>}
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

export const BarChartPlaceholder: React.FC<{ title: string; data?: ChartDataPoint[]; isLoading?: boolean }> = ({ title, data, isLoading }) => {
    return (
      <div className="bg-white shadow-xl rounded-xl p-6 min-h-[200px]"> {/* Added min-h for consistent height during load */}
        <h2 className="text-xl font-semibold text-secondary-800 mb-4">{title}</h2>
        {isLoading ? (
          <div className="flex justify-center items-center h-full">
            <Spinner />
          </div>
        ) : data && data.length > 0 ? (
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
    } else if (profile === null) { // Explicitly check for null if profile might not be loaded yet by AuthContext
        setIsLoading(false);
        setError("User profile not available."); 
    }
  }, [profile]);

  if (isLoading) {
    return <div className="flex justify-center items-center h-64"><Spinner size="lg" /></div>;
  }

  if (error) {
    return <div className="p-4 bg-red-100 text-red-700 rounded-md" role="alert">{error}</div>;
  }

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
        <BarChartPlaceholder title="Leads by Status" data={leadsByStatusChartData} isLoading={isLoading && !leadsByStatusChartData}/>
        <BarChartPlaceholder title="Leads by Source" data={leadsBySourceChartData} isLoading={isLoading && !leadsBySourceChartData} />
      </div>

      <h2 className="text-2xl font-semibold text-secondary-800 mt-10 mb-4">Deal Statistics</h2>
       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard title="Total Deals" value={reportData.totalDeals} />
        <StatCard title="Value of Won Deals" value={reportData.totalWonDealsValue} formatAsCurrency={true} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-1 gap-8">
         <BarChartPlaceholder title="Deals by Status (Count & Value)" data={dealsByStatusChartData} isLoading={isLoading && !dealsByStatusChartData} />
      </div>


    </div>
  );
};