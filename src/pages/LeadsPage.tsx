
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { GoogleGenAI } from "@google/genai";
import { Button } from '@/components/common/Button';
import { LeadModal } from '@/components/leads/LeadModal';
import { BulkUploadModal } from '@/components/leads/BulkUploadModal';
import { BulkActionModal } from '@/components/leads/BulkActionModal';
import { Lead, LeadStatus, Role, UserProfile } from '@/types'; 
import { leadService, userService } from '@/services/api';
import { PlusIcon, EditIcon, EyeIcon, DeleteIcon, UploadIcon, TableCellsIcon, UsersIcon, SparklesIcon } from '@/components/common/Icons';
import { Spinner } from '@/components/common/Spinner';
import { useAuth } from '@/contexts/AuthContext';
import { Input } from '@/components/common/Input';
import { Select } from '@/components/common/Select';
import { Modal } from '@/components/common/Modal';
import { LEAD_STATUS_OPTIONS, DEFAULT_FILTERS } from '@/constants';

type ActiveLeadModalTab = 'details' | 'activities' | 'follow_ups' | 'deals_quotations';

export const LeadsPage: React.FC = () => {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [pageLoading, setPageLoading] = useState(true); 
  const [isDataLoading, setIsDataLoading] = useState(false); 

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [isViewMode, setIsViewMode] = useState(false);
  const [initialModalTab, setInitialModalTab] = useState<ActiveLeadModalTab | undefined>();
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const { profile: currentUserProfile, hasRole } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [isBulkUploadModalOpen, setIsBulkUploadModalOpen] = useState(false);
  const [isBulkActionModalOpen, setIsBulkActionModalOpen] = useState(false);
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);
  const [bulkActionType, setBulkActionType] = useState<'status' | 'owner' | null>(null);

  // State for Smart Summary
  const [isSummaryModalOpen, setIsSummaryModalOpen] = useState(false);
  const [isSummaryLoading, setIsSummaryLoading] = useState(false);
  const [summaryResult, setSummaryResult] = useState('');
  const [summaryError, setSummaryError] = useState<string | null>(null);

  const fetchData = useCallback(async (options?: { isInitialLoad?: boolean }) => {
    const { isInitialLoad = false } = options || {};
    if (!currentUserProfile?.org_id) {
        if (isInitialLoad) setPageLoading(false);
        setIsDataLoading(false);
        setLeads([]);
        if (isInitialLoad) setUsers([]); 
        return;
    }
    
    if (isInitialLoad) {
        setPageLoading(true);
    } else {
        setIsDataLoading(true);
    }

    try {
      const promises: (Promise<Lead[]> | Promise<UserProfile[]>)[] = [
        leadService.getLeads(currentUserProfile.org_id),
      ];
      if (isInitialLoad) { 
        promises.push(userService.getUsers(currentUserProfile.org_id));
      }

      const results = await Promise.all(promises);
      setLeads(results[0] as Lead[] || []);
      if (isInitialLoad && results.length > 1 && results[1]) {
        setUsers(results[1] as UserProfile[] || []);
      }
    } catch (error) {
      console.error("Failed to fetch leads or users:", error);
      setLeads([]);
      if (isInitialLoad) setUsers([]);
      alert(`Error fetching data: ${(error as Error).message}`);
    } finally {
      if (isInitialLoad) {
        setPageLoading(false);
      }
      setIsDataLoading(false);
    }
  }, [currentUserProfile?.org_id]);

  useEffect(() => {
    if (currentUserProfile?.org_id) {
      fetchData({ isInitialLoad: true });
    } else if (!currentUserProfile) {
      setPageLoading(false);
      setIsDataLoading(false);
      setLeads([]);
      setUsers([]);
    }
  }, [currentUserProfile, fetchData]);

  const handleOpenModal = useCallback((lead: Lead | null = null, view: boolean = false, tab?: ActiveLeadModalTab) => {
    setEditingLead(lead);
    setIsViewMode(view);
    setInitialModalTab(tab);
    setIsModalOpen(true);
  }, []);

  useEffect(() => {
    if (leads.length > 0 && location.state) {
        const { preselectLeadId, viewMode, initialTab } = location.state as { preselectLeadId?: string, viewMode?: boolean, initialTab?: ActiveLeadModalTab };
        if (preselectLeadId) {
            const leadToOpen = leads.find(l => l.id === preselectLeadId);
            if (leadToOpen) {
                handleOpenModal(leadToOpen, viewMode || false, initialTab);
                navigate(location.pathname, { replace: true, state: null });
            }
        }
    }
  }, [leads, location, navigate, handleOpenModal]);


  const refreshLeadsData = () => {
    fetchData({ isInitialLoad: false });
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingLead(null);
    setIsViewMode(false);
    setInitialModalTab(undefined);
  };

  const handleSaveLead = async (leadFormData: Omit<Lead, 'id' | 'created_at' | 'updated_at' | 'owner_name' | 'org_id' | 'company_name' | 'contact_name' | 'activities' | 'follow_ups' | 'deals'> | Lead) => {
    if (!currentUserProfile?.org_id) {
        alert("Cannot save lead: Organization context is missing.");
        return;
    }
    setIsDataLoading(true);
    try {
      if ('id' in leadFormData && leadFormData.id) { 
        const { id, org_id, created_at, updated_at, owner_name, company_name, contact_name, activities, follow_ups, deals, ...dataToUpdate } = leadFormData as Lead;
        await leadService.updateLead(id, dataToUpdate);
      } else { 
        await leadService.addLead(leadFormData as Omit<Lead, 'id' | 'created_at' | 'updated_at' | 'owner_name' | 'org_id' | 'company_name' | 'contact_name' | 'activities' | 'follow_ups' | 'deals'>, currentUserProfile.org_id);
      }
      refreshLeadsData(); 
      handleCloseModal();
    } catch (error) {
      console.error("Failed to save lead:", error);
      alert(`Error saving lead: ${(error as Error).message}`);
    } finally {
        setIsDataLoading(false);
    }
  };

  const handleDeleteLead = async (leadId: string) => {
    if (window.confirm('Are you sure you want to delete this lead?')) {
      setIsDataLoading(true);
      try {
        await leadService.deleteLead(leadId);
        refreshLeadsData(); 
        setSelectedLeadIds(prev => prev.filter(id => id !== leadId));
      } catch (error) {
        console.error("Failed to delete lead:", error);
        alert(`Error deleting lead: ${(error as Error).message}`);
      } finally {
        setIsDataLoading(false);
      }
    }
  };
  
  const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFilters({ ...filters, [e.target.name]: e.target.value });
    setSelectedLeadIds([]);
  };

  const handleGenerateSummary = async () => {
    if (filteredLeads.length === 0) {
      alert("No leads to summarize.");
      return;
    }
    setIsSummaryModalOpen(true);
    setIsSummaryLoading(true);
    setSummaryResult('');
    setSummaryError(null);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
      
      const leadsForSummary = filteredLeads.map(({ status, source, owner_name, company_name }) => ({
        status,
        source,
        owner: owner_name || 'Unassigned',
        company: company_name || 'N/A',
      }));

      const prompt = `
          Analyze the following list of ${filteredLeads.length} sales leads and provide a concise executive summary for a sales manager.

          Lead Data Snippet:
          ${JSON.stringify(leadsForSummary.slice(0, 20), null, 2)}
          ...(data for ${Math.max(0, leadsForSummary.length - 20)} more leads not shown)

          Your summary should be well-structured and easy to read. Please highlight:
          1.  **Overview**: A brief summary of the total leads and their distribution across different statuses (e.g., New, Contacted, Qualified).
          2.  **Key Insights**: Identify any notable trends, such as the most effective lead sources, or if any sales representative is handling a disproportionate number of leads.
          3.  **Actionable Recommendations**: Suggest 1-2 concrete next steps. For example, "Focus on converting the high number of 'Qualified' leads," or "Investigate why 'Referral' leads are performing well."
          
          Format the output using markdown for clarity (e.g., use headings, bold text, and bullet points). Do not just repeat the input data.
      `;

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
      });
      
      setSummaryResult(response.text);

    } catch (e: any) {
      console.error("Error generating summary:", e);
      setSummaryError(e.message || "An error occurred while generating the summary.");
    } finally {
      setIsSummaryLoading(false);
    }
  };

  const filteredLeads = useMemo(() => {
    return leads.filter(lead => {
        const searchTermLower = searchTerm.toLowerCase();
        const searchMatch = 
            lead.name.toLowerCase().includes(searchTermLower) ||
            lead.email.toLowerCase().includes(searchTermLower) ||
            (lead.owner_name && lead.owner_name.toLowerCase().includes(searchTermLower)) ||
            lead.mobile.toLowerCase().includes(searchTermLower) ||
            (lead.company_name && lead.company_name.toLowerCase().includes(searchTermLower)) ||
            (lead.stage && lead.stage.toLowerCase().includes(searchTermLower));
        
        const statusMatch = filters.status ? lead.status === filters.status : true;
        const sourceMatch = filters.source ? lead.source.toLowerCase().includes(filters.source.toLowerCase()) : true;
        
        return searchMatch && statusMatch && sourceMatch;
    });
  }, [leads, searchTerm, filters]);
  
  const handleSelectLead = (leadId: string) => {
    setSelectedLeadIds(prev =>
      prev.includes(leadId) ? prev.filter(id => id !== leadId) : [...prev, leadId]
    );
  };

  const handleSelectAllLeads = () => {
    if (selectedLeadIds.length === filteredLeads.length) {
      setSelectedLeadIds([]);
    } else {
      setSelectedLeadIds(filteredLeads.map(lead => lead.id));
    }
  };
  
  const isAllSelected = filteredLeads.length > 0 && selectedLeadIds.length === filteredLeads.length;
  const isIndeterminate = selectedLeadIds.length > 0 && selectedLeadIds.length < filteredLeads.length;

  const handleOpenBulkUploadModal = () => setIsBulkUploadModalOpen(true);
  const handleCloseBulkUploadModal = () => setIsBulkUploadModalOpen(false);
  const handleImportComplete = () => {
    refreshLeadsData();
    handleCloseBulkUploadModal();
  };

  const handleOpenBulkActionModal = (action: 'status' | 'owner') => {
    if (selectedLeadIds.length === 0) {
        alert("Please select at least one lead to perform this action.");
        return;
    }
    setBulkActionType(action);
    setIsBulkActionModalOpen(true);
  };
  const handleCloseBulkActionModal = () => {
    setIsBulkActionModalOpen(false);
    setBulkActionType(null);
  };

  const handleConfirmBulkAction = async (leadIds: string[], updates: Partial<{ status: LeadStatus; owner_user_id: string | null }>) => {
    setIsDataLoading(true);
    try {
      await leadService.bulkUpdateLeadDetails(leadIds, updates, currentUserProfile?.org_id || '');
      refreshLeadsData();
      setSelectedLeadIds([]);
      handleCloseBulkActionModal();
    } catch (error) {
      console.error("Bulk action failed:", error);
      alert(`Bulk action failed: ${(error as Error).message}`);
    } finally {
      setIsDataLoading(false);
    }
  };

  const leadStatusOptions = [{value: '', label: 'All Statuses'}, ...LEAD_STATUS_OPTIONS.map(s => ({value: s, label: s}))];

  const getStatusColorClasses = (status: LeadStatus) => {
    switch (status) {
      case LeadStatus.CONVERTED: return 'bg-primary-100 text-primary-800';
      case LeadStatus.LOST: return 'bg-red-100 text-red-800';
      case LeadStatus.QUALIFIED: return 'bg-yellow-100 text-yellow-800'; 
      case LeadStatus.CONTACTED: return 'bg-blue-100 text-blue-800'; 
      default: return 'bg-secondary-100 text-secondary-800';
    }
  };
  
  if (pageLoading) { 
    return <div className="flex justify-center items-center h-screen"><Spinner size="lg" /></div>;
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
        <h1 className="text-2xl font-semibold text-secondary-900">Leads Management</h1>
        <div className="flex flex-wrap gap-2">
            <Button onClick={handleGenerateSummary} leftIcon={<SparklesIcon className="h-5 w-5" />} disabled={isDataLoading || filteredLeads.length === 0}>
                Smart Summary
            </Button>
            { (hasRole([Role.ADMIN])) && 
                <Button onClick={handleOpenBulkUploadModal} leftIcon={<UploadIcon className="h-5 w-5" />} disabled={isDataLoading}>
                    Import Leads (CSV)
                </Button>
            }
            <Button onClick={() => handleOpenModal()} leftIcon={<PlusIcon className="h-5 w-5" />} disabled={isDataLoading}>
            Add New Lead
            </Button>
        </div>
      </div>

      <div className="mb-6 p-4 bg-white shadow rounded-lg">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input 
                placeholder="Search leads..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="md:col-span-1"
                aria-label="Search leads"
            />
             <Select
                label="Filter by Status"
                id="lead-status-filter"
                name="status"
                value={filters.status}
                onChange={handleFilterChange}
                options={leadStatusOptions}
                wrapperClassName="md:col-span-1"
            />
            <Input
                name="source"
                label="Filter by Source"
                id="lead-source-filter"
                placeholder="Enter source..."
                value={filters.source}
                onChange={handleFilterChange}
                wrapperClassName="md:col-span-1"
            />
        </div>
      </div>
      {selectedLeadIds.length > 0 && hasRole(Role.ADMIN) && (
         <div className="mb-4 p-3 bg-primary-50 border border-primary-200 rounded-md flex flex-col sm:flex-row items-center gap-3">
            <p className="text-sm font-medium text-primary-700">{selectedLeadIds.length} lead(s) selected.</p>
            <div className="flex gap-2 flex-wrap">
                <Button onClick={() => handleOpenBulkActionModal('status')} leftIcon={<TableCellsIcon className="h-4 w-4"/>} size="sm" variant="outline">Change Status</Button>
                <Button onClick={() => handleOpenBulkActionModal('owner')} leftIcon={<UsersIcon className="h-4 w-4"/>} size="sm" variant="outline">Change Owner</Button>
            </div>
         </div>
      )}

      <div className="bg-white shadow overflow-x-auto rounded-lg relative">
        {isDataLoading && leads.length > 0 && (
            <div className="absolute inset-0 bg-white bg-opacity-75 flex justify-center items-center z-10">
                <Spinner />
            </div>
        )}
        <table className="min-w-full divide-y divide-secondary-200" aria-label="Leads Table">
          <thead className="bg-secondary-50">
            <tr>
              <th scope="col" className="px-4 py-3 text-left">
                <input
                    type="checkbox"
                    className="form-checkbox h-4 w-4 text-primary-600 border-secondary-300 rounded focus:ring-primary-500"
                    checked={isAllSelected}
                    ref={input => { 
                        if (input) input.indeterminate = isIndeterminate;
                    }}
                    onChange={handleSelectAllLeads}
                    aria-label="Select all leads"
                    disabled={filteredLeads.length === 0 || isDataLoading}
                />
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">Name</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">Email</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">Mobile</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">Status</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">Company</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">Assigned To</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">Last Updated</th>
              <th scope="col" className="relative px-6 py-3"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-secondary-200">
           {isDataLoading && leads.length === 0 ? (
                <tr><td colSpan={9} className="px-6 py-12 text-center"><Spinner /></td></tr>
            ) : filteredLeads.length === 0 ? (
                <tr><td colSpan={9} className="px-6 py-12 text-center text-sm text-secondary-500">No leads found matching your criteria.</td></tr>
            ) : (
                filteredLeads.map((lead) => (
                <tr key={lead.id} className={`hover:bg-secondary-50 ${selectedLeadIds.includes(lead.id) ? 'bg-primary-50' : ''}`}>
                     <td className="px-4 py-4">
                        <input
                            type="checkbox"
                            className="form-checkbox h-4 w-4 text-primary-600 border-secondary-300 rounded focus:ring-primary-500"
                            checked={selectedLeadIds.includes(lead.id)}
                            onChange={() => handleSelectLead(lead.id)}
                            aria-label={`Select lead ${lead.name}`}
                            disabled={isDataLoading}
                        />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-secondary-900">{lead.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-secondary-500">{lead.email}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-secondary-500">{lead.mobile}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColorClasses(lead.status)}`}>
                        {lead.status}
                        </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-secondary-500">{lead.company_name || 'N/A'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-secondary-500">{lead.owner_name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-secondary-500">{new Date(lead.updated_at).toLocaleDateString()}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                      <Button variant="outline" size="sm" onClick={() => handleOpenModal(lead, true)} aria-label={`View ${lead.name}`} disabled={isDataLoading}>
                          <EyeIcon className="h-4 w-4" />
                      </Button>
                      {(hasRole(Role.ADMIN) || (hasRole(Role.USER) && lead.owner_user_id === currentUserProfile?.id)) &&
                          <Button variant="outline" size="sm" onClick={() => handleOpenModal(lead)} aria-label={`Edit ${lead.name}`} disabled={isDataLoading}>
                          <EditIcon className="h-4 w-4" />
                          </Button>
                      }
                      {hasRole(Role.ADMIN) &&
                          <Button variant="danger" size="sm" onClick={() => handleDeleteLead(lead.id)} aria-label={`Delete ${lead.name}`} disabled={isDataLoading}>
                          <DeleteIcon className="h-4 w-4" />
                          </Button>
                      }
                    </td>
                </tr>
                ))
            )}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <LeadModal
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          leadToEdit={editingLead}
          onSave={handleSaveLead}
          viewMode={isViewMode}
          initialTab={initialModalTab}
        />
      )}
      {isBulkUploadModalOpen && currentUserProfile && (
        <BulkUploadModal 
            isOpen={isBulkUploadModalOpen}
            onClose={handleCloseBulkUploadModal}
            onImportComplete={handleImportComplete}
        />
      )}
      {isBulkActionModalOpen && currentUserProfile && bulkActionType && (
        <BulkActionModal
            isOpen={isBulkActionModalOpen}
            onClose={handleCloseBulkActionModal}
            selectedLeadIds={selectedLeadIds}
            actionType={bulkActionType}
            onConfirm={handleConfirmBulkAction}
            usersForAssignment={users}
        />
      )}
       <Modal isOpen={isSummaryModalOpen} onClose={() => setIsSummaryModalOpen(false)} title="AI-Powered Leads Summary" size="lg">
            <div className="p-2">
                {isSummaryLoading ? (
                    <div className="flex flex-col items-center justify-center h-48">
                        <Spinner size="lg" />
                        <p className="mt-4 text-secondary-600">Generating insights from your leads...</p>
                    </div>
                ) : summaryError ? (
                    <div className="p-4 bg-red-50 text-red-700 rounded-md" role="alert">
                        <h4 className="font-bold">Error Generating Summary</h4>
                        <p>{summaryError}</p>
                    </div>
                ) : (
                    <div className="text-secondary-700 space-y-4 max-h-[60vh] overflow-y-auto">
                        <pre className="whitespace-pre-wrap font-sans text-sm bg-secondary-50 p-4 rounded-md">{summaryResult}</pre>
                    </div>
                )}
            </div>
        </Modal>
    </div>
  );
};
