import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Button } from '@/components/common/Button';
import { DealModal } from '@/components/deals/DealModal';
import { Deal, DealStatus, Role, UserProfile, Lead, DealPageReportData, ChartDataPoint } from '@/types';
import { dealService, userService, reportService, leadService } from '@/services/api';
import { PlusIcon, EyeIcon, DeleteIcon } from '@/components/common/Icons';
import { Spinner } from '@/components/common/Spinner';
import { useAuth } from '@/contexts/AuthContext';
import { Input } from '@/components/common/Input';
import { Select } from '@/components/common/Select';
import { DEAL_STATUS_OPTIONS } from '@/constants';
import { BarChartPlaceholder, StatCard } from './ReportsPage'; 
import { Link } from 'react-router-dom';


export const DealsPage: React.FC = () => {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]); 
  const [reportData, setReportData] = useState<Partial<DealPageReportData>>({});
  
  const [pageLoading, setPageLoading] = useState(true);
  const [isDataLoading, setIsDataLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDeal, setEditingDeal] = useState<Deal | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState<{ status: string; createdBy: string }>({
    status: '', createdBy: ''
  });

  const { profile: currentUserProfile, hasRole } = useAuth();

  const fetchData = useCallback(async (options?: { isInitialLoad?: boolean }) => {
    const { isInitialLoad = false } = options || {};
    if (!currentUserProfile?.org_id || !currentUserProfile.id || !currentUserProfile.role) {
      if (isInitialLoad) setPageLoading(false);
      setIsDataLoading(false);
      setDeals([]); 
      if(isInitialLoad) {setUsers([]); setReportData({}); setLeads([]);}
      return;
    }
    
    if (isInitialLoad) {
        setPageLoading(true);
    } else {
        setIsDataLoading(true);
    }

    try {
      const promises: (Promise<Deal[]> | Promise<UserProfile[]> | Promise<DealPageReportData> | Promise<Lead[]>)[] = [
        dealService.getDeals(currentUserProfile.org_id, currentUserProfile.id, currentUserProfile.role),
        reportService.getDealPageReportData(currentUserProfile.org_id, currentUserProfile.id, currentUserProfile.role)
      ];
      if (isInitialLoad) {
        promises.push(userService.getUsers(currentUserProfile.org_id));
        promises.push(leadService.getLeads(currentUserProfile.org_id)); 
      }
      
      const results = await Promise.all(promises);
      setDeals(results[0] as Deal[] || []);
      setReportData(results[1] as DealPageReportData || {});

      if (isInitialLoad) {
        if (results.length > 2 && results[2]) setUsers(results[2] as UserProfile[] || []);
        if (results.length > 3 && results[3]) setLeads(results[3] as Lead[] || []);
      }
    } catch (error) {
      console.error("Failed to fetch deals or related data:", error);
      setDeals([]); 
      setReportData({});
      if(isInitialLoad) {setUsers([]); setLeads([]);}
      alert(`Error fetching data: ${(error as Error).message}`);
    } finally {
      if(isInitialLoad) {
        setPageLoading(false);
      }
      setIsDataLoading(false);
    }
  }, [currentUserProfile]);

  useEffect(() => {
    if (currentUserProfile) {
        fetchData({ isInitialLoad: true });
    } else {
        setPageLoading(false);
        setIsDataLoading(false);
        setDeals([]); setUsers([]); setReportData({}); setLeads([]);
    }
  }, [currentUserProfile, fetchData]);

  const refreshDealsData = () => {
    fetchData({ isInitialLoad: false });
  };

  const handleOpenModal = (deal: Deal | null = null) => {
    setEditingDeal(deal);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingDeal(null);
    refreshDealsData();
  };
  
  const handleDeleteDeal = async (dealId: string) => {
    if (window.confirm('Are you sure you want to delete this deal? This will also delete all its items.')) {
      setIsDataLoading(true);
      try {
        await dealService.deleteDeal(dealId);
        refreshDealsData();
      } catch (error) {
        console.error("Failed to delete deal:", error);
        alert(`Error deleting deal: ${(error as Error).message}`);
      } finally {
        setIsDataLoading(false);
      }
    }
  };

  const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFilters({ ...filters, [e.target.name]: e.target.value });
  };

  const filteredDeals = useMemo(() => {
    return deals.filter(deal => {
        const searchTermLower = searchTerm.toLowerCase();
        const searchMatch = 
            deal.deal_name.toLowerCase().includes(searchTermLower) ||
            (deal.lead_name && deal.lead_name.toLowerCase().includes(searchTermLower)) ||
            (deal.company_name && deal.company_name.toLowerCase().includes(searchTermLower)) ||
            (deal.created_by_user_name && deal.created_by_user_name.toLowerCase().includes(searchTermLower));
        
        const statusMatch = filters.status ? deal.status === filters.status : true;
        const creatorMatch = filters.createdBy ? deal.created_by_user_id === filters.createdBy : true;
        
        return searchMatch && statusMatch && creatorMatch;
    });
  }, [deals, searchTerm, filters]);
  
  const statusOptions = [{value: '', label: 'All Statuses'}, ...DEAL_STATUS_OPTIONS.map(s => ({value: s, label: s}))];
  const userOptionsForFilter = [{value: '', label: 'All Creators'}, ...users.map(u => ({value: u.id, label: u.full_name}))];
  
  const getStatusColorClasses = (status: DealStatus) => {
    switch (status) {
      case DealStatus.WON: return 'bg-green-100 text-green-800';
      case DealStatus.LOST: case DealStatus.CANCELLED: return 'bg-red-100 text-red-800';
      case DealStatus.NEGOTIATION: case DealStatus.PRESENTED: return 'bg-yellow-100 text-yellow-800';
      case DealStatus.DRAFT: return 'bg-indigo-100 text-indigo-800';
      default: return 'bg-secondary-100 text-secondary-800';
    }
  };
  
  const dealsByStatusChartData: ChartDataPoint[] | undefined = reportData.dealsByStatus?.map(s => ({name: s.status, value: s.count, total_value: s.total_value}));


  if (pageLoading) { 
    return <div className="flex justify-center items-center h-screen"><Spinner size="lg" /></div>;
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
        <h1 className="text-3xl font-bold text-secondary-900">Deals / Quotations</h1>
        {(hasRole([Role.ADMIN, Role.USER])) && 
            <Button onClick={() => handleOpenModal()} leftIcon={<PlusIcon className="h-5 w-5" />} disabled={isDataLoading || leads.length === 0}>
            Add New Deal
            </Button>
        }
      </div>
      {leads.length === 0 && !pageLoading && !isDataLoading && (
         <p className="mb-4 p-3 bg-yellow-50 border border-yellow-200 text-yellow-700 rounded-md text-sm">
            Please add leads first to be able to associate deals. <Link to="/leads" className="font-semibold hover:underline">Go to Leads</Link>.
        </p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard title="Total Deals" value={isDataLoading && reportData.totalDealsCount === undefined ? <Spinner size="sm"/> : reportData.totalDealsCount} subtext={currentUserProfile?.role !== Role.ADMIN ? "My Deals" : "Org-wide"} />
        <StatCard title="Open Deals Value" value={isDataLoading && reportData.openDealsValue === undefined ? <Spinner size="sm"/> : reportData.openDealsValue} formatAsCurrency />
        <StatCard title="Won Deals Value" value={isDataLoading && reportData.wonDealsValue === undefined ? <Spinner size="sm"/> : reportData.wonDealsValue} formatAsCurrency />
        <StatCard title="Avg. Won Deal Size" value={isDataLoading && reportData.avgWonDealSize === undefined ? <Spinner size="sm"/> : reportData.avgWonDealSize} formatAsCurrency />
      </div>

      <div className="mb-6 p-4 bg-white shadow rounded-lg">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input 
                placeholder="Search deals..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                aria-label="Search deals"
            />
             <Select
                label="Filter by Status"
                id="deal-status-filter"
                name="status"
                value={filters.status}
                onChange={handleFilterChange}
                options={statusOptions}
            />
            <Select
                label="Filter by Creator"
                id="deal-creator-filter"
                name="createdBy"
                value={filters.createdBy}
                onChange={handleFilterChange}
                options={userOptionsForFilter}
                disabled={users.length === 0}
            />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="lg:col-span-2 bg-white shadow overflow-x-auto rounded-lg">
            <table className="min-w-full divide-y divide-secondary-200" aria-label="Deals Table">
          <thead className="bg-secondary-50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">Deal Name</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">Lead</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">Company</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">Total Value</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">Status</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">Created By</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">Created At</th>
              <th scope="col" className="relative px-6 py-3"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-secondary-200">
            {isDataLoading && deals.length > 0 ? (
                 <tr><td colSpan={8} className="px-6 py-12 text-center relative">
                    <div className="absolute inset-0 bg-white bg-opacity-50 flex justify-center items-center"><Spinner /></div>
                    Updating data...
                 </td></tr>
            ) : filteredDeals.length === 0 ? (
                <tr><td colSpan={8} className="px-6 py-12 text-center text-sm text-secondary-500">No deals found matching your criteria.</td></tr>
            ) : (
                filteredDeals.map((deal) => (
                <tr key={deal.id} className="hover:bg-secondary-50">
                  <td className="px-6 py-4 whitespace-normal text-sm font-medium text-secondary-900 max-w-xs break-words">{deal.deal_name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-secondary-500">{deal.lead_name || 'N/A'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-secondary-500">{deal.company_name || 'N/A'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-secondary-500">${deal.total_value.toFixed(2)}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColorClasses(deal.status)}`}>
                      {deal.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-secondary-500">{deal.created_by_user_name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-secondary-500">{new Date(deal.created_at).toLocaleDateString()}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                    <Button variant="outline" size="sm" onClick={() => handleOpenModal(deal)} aria-label={`View/Edit ${deal.deal_name}`}><EyeIcon className="h-4 w-4" /></Button>
                    {(hasRole(Role.ADMIN) || currentUserProfile?.id === deal.created_by_user_id) &&
                        <Button variant="danger" size="sm" onClick={() => handleDeleteDeal(deal.id)} aria-label={`Delete ${deal.deal_name}`}><DeleteIcon className="h-4 w-4" /></Button>
                    }
                  </td>
                </tr>
                ))
            )}
          </tbody>
        </table>
        </div>
        <div className="lg:col-span-1">
            <BarChartPlaceholder title="Deals by Status" data={dealsByStatusChartData} isLoading={isDataLoading && !dealsByStatusChartData} />
        </div>
      </div>

      {isModalOpen && currentUserProfile && (
        <DealModal
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          dealToEdit={editingDeal}
        />
      )}
    </div>
  );
};