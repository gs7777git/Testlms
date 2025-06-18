
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Button } from '@/components/common/Button';
import { LeadModal } from '@/components/leads/LeadModal';
import { Lead, LeadStatus, Role, UserProfile } from '@/types'; 
import { leadService, userService } from '@/services/api';
import { PlusIcon, EditIcon, EyeIcon, DeleteIcon } from '@/components/common/Icons';
import { Spinner } from '@/components/common/Spinner';
import { useAuth } from '@/contexts/AuthContext';
import { Input } from '@/components/common/Input';
import { Select } from '@/components/common/Select';
import { LEAD_STATUS_OPTIONS, DEFAULT_FILTERS } from '@/constants';

export const LeadsPage: React.FC = () => {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]); 
  const [pageLoading, setPageLoading] = useState(true); 
  const [isDataLoading, setIsDataLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [isViewMode, setIsViewMode] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const { profile: currentUser, hasRole } = useAuth();

  const fetchData = useCallback(async () => {
    if (!currentUser?.org_id) {
        setIsDataLoading(false);
        setPageLoading(false);
        return;
    }
    setIsDataLoading(true); 
    setPageLoading(true); 
    try {
      const [fetchedLeads, fetchedUsers] = await Promise.all([
        leadService.getLeads(currentUser.org_id),
        userService.getUsers(currentUser.org_id) 
      ]);
      setLeads(fetchedLeads || []);
      setUsers(fetchedUsers || []);
    } catch (error) {
      console.error("Failed to fetch leads or users:", error);
      setLeads([]);
      setUsers([]);
      alert(`Error fetching data: ${(error as Error).message}`);
    } finally {
      setIsDataLoading(false);
      setPageLoading(false);
    }
  }, [currentUser?.org_id]);

  useEffect(() => {
     if (currentUser?.org_id) {
        fetchData();
    } else if (!currentUser && isDataLoading === false) { 
        setPageLoading(false); 
    }
  }, [fetchData, currentUser, isDataLoading]);


  const handleOpenModal = (lead: Lead | null = null, view: boolean = false) => {
    setEditingLead(lead);
    setIsViewMode(view);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingLead(null);
    setIsViewMode(false);
  };

  const handleSaveLead = async (leadFormData: Omit<Lead, 'id' | 'created_at' | 'updated_at' | 'owner_name' | 'org_id'> | Lead) => {
    if (!currentUser?.org_id) {
        alert("Cannot save lead: Organization context is missing.");
        return;
    }
    try {
      if ('id' in leadFormData && leadFormData.id) { 
        const { id, org_id, created_at, updated_at, owner_name, ...dataToUpdate } = leadFormData as Lead;
        await leadService.updateLead(id, dataToUpdate);
      } else { 
        await leadService.addLead(leadFormData as Omit<Lead, 'id' | 'created_at' | 'updated_at' | 'owner_name' | 'org_id'>, currentUser.org_id);
      }
      await fetchData(); 
      handleCloseModal();
    } catch (error) {
      console.error("Failed to save lead:", error);
      alert(`Error saving lead: ${(error as Error).message}`);
    }
  };

  const handleDeleteLead = async (leadId: string) => {
    if (window.confirm('Are you sure you want to delete this lead?')) {
      setPageLoading(true);
      try {
        await leadService.deleteLead(leadId);
        await fetchData(); 
      } catch (error) {
        console.error("Failed to delete lead:", error);
        alert(`Error deleting lead: ${(error as Error).message}`);
        setPageLoading(false);
      }
    }
  };
  
  const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFilters({ ...filters, [e.target.name]: e.target.value });
  };

  const filteredLeads = useMemo(() => {
    return leads.filter(lead => {
        const searchTermLower = searchTerm.toLowerCase();
        const searchMatch = 
            lead.name.toLowerCase().includes(searchTermLower) ||
            lead.email.toLowerCase().includes(searchTermLower) ||
            (lead.owner_name && lead.owner_name.toLowerCase().includes(searchTermLower)) ||
            lead.mobile.toLowerCase().includes(searchTermLower) ||
            (lead.stage && lead.stage.toLowerCase().includes(searchTermLower));
        
        const statusMatch = filters.status ? lead.status === filters.status : true;
        const sourceMatch = filters.source ? lead.source.toLowerCase().includes(filters.source.toLowerCase()) : true;
        
        return searchMatch && statusMatch && sourceMatch;
    });
  }, [leads, searchTerm, filters]);
  
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
  
  if (isDataLoading && leads.length === 0 && pageLoading) { 
    return <div className="flex justify-center items-center h-64"><Spinner size="lg" /></div>;
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
        <h1 className="text-2xl font-semibold text-secondary-900">Leads Management</h1>
        { (hasRole([Role.ADMIN, Role.USER])) && 
            <Button onClick={() => handleOpenModal()} leftIcon={<PlusIcon className="h-5 w-5" />} disabled={pageLoading || isDataLoading}>
            Add New Lead
            </Button>
        }
      </div>

      <div className="mb-6 p-4 bg-white shadow rounded-lg">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input 
                placeholder="Search leads..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="md:col-span-1"
            />
             <Select
                name="status"
                value={filters.status}
                onChange={handleFilterChange}
                options={leadStatusOptions}
                wrapperClassName="md:col-span-1"
                placeholder="All Statuses" 
            />
            <Input
                name="source"
                placeholder="Filter by source..."
                value={filters.source}
                onChange={handleFilterChange}
                wrapperClassName="md:col-span-1"
            />
        </div>
      </div>

      {pageLoading && <div className="my-4 flex justify-center"><Spinner /></div>}

      <div className="bg-white shadow overflow-x-auto rounded-lg">
        <table className="min-w-full divide-y divide-secondary-200">
          <thead className="bg-secondary-50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">Name</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">Email</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">Mobile</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">Status</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">Stage</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">Source</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">Assigned To</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">Last Updated</th>
              <th scope="col" className="relative px-6 py-3"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-secondary-200">
            {filteredLeads.length === 0 && !isDataLoading && !pageLoading ? (
                <tr><td colSpan={9} className="px-6 py-12 text-center text-sm text-secondary-500">No leads found matching your criteria.</td></tr>
            ) : (
                filteredLeads.map((lead) => (
                <tr key={lead.id} className="hover:bg-secondary-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-secondary-900">{lead.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-secondary-500">{lead.email}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-secondary-500">{lead.mobile}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColorClasses(lead.status)}`}>
                        {lead.status}
                        </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-secondary-500">{lead.stage || 'N/A'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-secondary-500">{lead.source}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-secondary-500">{lead.owner_name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-secondary-500">{new Date(lead.updated_at).toLocaleDateString()}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                      <Button variant="outline" size="sm" onClick={() => handleOpenModal(lead, true)} aria-label={`View ${lead.name}`} disabled={pageLoading || isDataLoading}>
                          <EyeIcon className="h-4 w-4" />
                      </Button>
                      {(hasRole(Role.ADMIN) || (hasRole(Role.USER) && lead.owner_user_id === currentUser?.id)) &&
                          <Button variant="outline" size="sm" onClick={() => handleOpenModal(lead)} aria-label={`Edit ${lead.name}`} disabled={pageLoading || isDataLoading}>
                          <EditIcon className="h-4 w-4" />
                          </Button>
                      }
                      {hasRole(Role.ADMIN) &&
                          <Button variant="danger" size="sm" onClick={() => handleDeleteLead(lead.id)} aria-label={`Delete ${lead.name}`} disabled={pageLoading || isDataLoading}>
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
        />
      )}
    </div>
  );
};