import React, { useState, useEffect, useCallback } from 'react';
import { Modal } from '@/components/common/Modal';
import { Button } from '@/components/common/Button';
import { Input, Textarea } from '@/components/common/Input';
import { Select } from '@/components/common/Select';
import { Lead, LeadStatus, UserProfile, LeadActivity, LeadFollowUp, LeadFollowUpStatus, Deal, DealStatus, Company, Contact } from '@/types';
import { LEAD_STATUS_OPTIONS } from '@/constants';
import { userService, leadActivityService, leadFollowUpService, dealService, companyService, contactService } from '@/services/api';
import { Spinner } from '@/components/common/Spinner';
import { useAuth } from '@/contexts/AuthContext';
import { PlusIcon, EditIcon, DeleteIcon, EyeIcon } from '@/components/common/Icons';
import { DealModal } from '@/components/deals/DealModal'; 

interface LeadModalProps {
  isOpen: boolean;
  onClose: () => void;
  leadToEdit?: Lead | null;
  onSave: (lead: Omit<Lead, 'id' | 'created_at' | 'updated_at' | 'owner_name' | 'company_name' | 'contact_name' | 'org_id' | 'activities' | 'follow_ups' | 'deals'> | Lead) => void;
  viewMode?: boolean;
}

const initialLeadState: Omit<Lead, 'id' | 'created_at' | 'updated_at' | 'owner_name' | 'company_name' | 'contact_name' | 'org_id' | 'activities' | 'follow_ups' | 'deals'> = {
  name: '', email: '', mobile: '', source: '', status: LeadStatus.NEW, stage: '', owner_user_id: null, notes: '', company_id: null, contact_id: null
};

const MODAL_TITLE_ID = "lead-modal-title";
type ActiveLeadModalTab = 'details' | 'activities' | 'follow_ups' | 'deals_quotations';

export const LeadModal: React.FC<LeadModalProps> = ({ isOpen, onClose, leadToEdit, onSave, viewMode = false }) => {
  const [leadData, setLeadData] = useState<Omit<Lead, 'id' | 'created_at' | 'updated_at' | 'owner_name' | 'company_name' | 'contact_name' | 'org_id' | 'activities' | 'follow_ups' | 'deals'>>(initialLeadState);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [contactsForCompany, setContactsForCompany] = useState<Contact[]>([]);
  
  const [activities, setActivities] = useState<LeadActivity[]>([]);
  const [followUps, setFollowUps] = useState<LeadFollowUp[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);

  const [isLoading, setIsLoading] = useState(false); 
  const [isRelatedDataLoading, setIsRelatedDataLoading] = useState(false); 
  const [isSubmittingRelated, setIsSubmittingRelated] = useState(false);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const { profile: currentUserProfile } = useAuth();
  const [activeTab, setActiveTab] = useState<ActiveLeadModalTab>('details');

  const [newActivityType, setNewActivityType] = useState('note_added');
  const [newActivityDetails, setNewActivityDetails] = useState('');
  const [newFollowUpDueDate, setNewFollowUpDueDate] = useState('');
  const [newFollowUpNotes, setNewFollowUpNotes] = useState('');
  const [editingFollowUp, setEditingFollowUp] = useState<LeadFollowUp | null>(null);

  const [isDealModalOpen, setIsDealModalOpen] = useState(false);
  const [editingDeal, setEditingDeal] = useState<Deal | null>(null);


  const resetFormStates = useCallback(() => {
    setLeadData(initialLeadState);
    setErrors({});
    setActivities([]);
    setFollowUps([]);
    setDeals([]);
    setCompanies([]);
    setContactsForCompany([]);
    setActiveTab('details');
    setNewActivityType('note_added');
    setNewActivityDetails('');
    setNewFollowUpDueDate('');
    setNewFollowUpNotes('');
    setEditingFollowUp(null);
    setIsLoading(false);
    setIsRelatedDataLoading(false);
    setIsSubmittingRelated(false);
    setEditingDeal(null);
    setIsDealModalOpen(false);
  }, []);
  
  const fetchRelatedData = useCallback(async (leadId: string, orgId: string, tab: ActiveLeadModalTab) => {
    if (!leadId || !orgId) return;
    setIsRelatedDataLoading(true);
    setErrors(prev => ({...prev, relatedData: ''}));
    try {
      if (tab === 'activities') {
        const fetchedActivities = await leadActivityService.getActivitiesForLead(leadId, orgId);
        setActivities(fetchedActivities);
      } else if (tab === 'follow_ups') {
        const fetchedFollowUps = await leadFollowUpService.getFollowUpsForLead(leadId, orgId);
        setFollowUps(fetchedFollowUps);
      } else if (tab === 'deals_quotations') {
        const fetchedDeals = await dealService.getDealsForLead(leadId, orgId);
        setDeals(fetchedDeals);
      }
    } catch (err) {
      console.error(`Failed to fetch data for tab ${tab}:`, err);
      setErrors(prev => ({ ...prev, relatedData: `Could not load ${tab.replace('_', ' ')}.` }));
    } finally {
      setIsRelatedDataLoading(false);
    }
  }, []);

  // Fetch users and companies on modal open
  useEffect(() => {
    if (isOpen && currentUserProfile?.org_id) {
        userService.getUsers(currentUserProfile.org_id)
            .then(setUsers)
            .catch(err => console.error("Failed to fetch users:", err));
        companyService.getCompanies(currentUserProfile.org_id)
            .then(setCompanies)
            .catch(err => console.error("Failed to fetch companies:", err));
    }
  }, [isOpen, currentUserProfile?.org_id]);


  // Populate form if editing, or set defaults for new lead
  useEffect(() => {
    if (isOpen) {
        if (leadToEdit) {
            setLeadData({
                name: leadToEdit.name, email: leadToEdit.email, mobile: leadToEdit.mobile,
                source: leadToEdit.source, status: leadToEdit.status, stage: leadToEdit.stage || '',
                owner_user_id: leadToEdit.owner_user_id, notes: leadToEdit.notes || '',
                company_id: leadToEdit.company_id || null,
                contact_id: leadToEdit.contact_id || null,
            });
            if (leadToEdit.id && currentUserProfile?.org_id) {
                 if (activeTab !== 'details') {
                    fetchRelatedData(leadToEdit.id, currentUserProfile.org_id, activeTab);
                }
            }
            // If editing and company_id exists, fetch contacts for that company
            if (leadToEdit.company_id && currentUserProfile?.org_id) {
                contactService.getContactsForCompany(leadToEdit.company_id, currentUserProfile.org_id)
                    .then(setContactsForCompany)
                    .catch(err => console.error("Failed to fetch contacts for company:", err));
            } else {
                setContactsForCompany([]);
            }

        } else {
            setLeadData({ ...initialLeadState, owner_user_id: currentUserProfile?.id || null });
            setContactsForCompany([]);
        }
    } else {
        resetFormStates(); 
    }
  }, [leadToEdit, isOpen, currentUserProfile?.org_id, currentUserProfile?.id, viewMode, fetchRelatedData, resetFormStates, activeTab]);

  // Fetch contacts when selected company changes
  useEffect(() => {
    if (isOpen && leadData.company_id && currentUserProfile?.org_id) {
        contactService.getContactsForCompany(leadData.company_id, currentUserProfile.org_id)
            .then(fetchedContacts => {
                setContactsForCompany(fetchedContacts);
                // Check if current contact_id is still valid for the new company
                const currentContactIsValid = fetchedContacts.some(c => c.id === leadData.contact_id);
                if (!currentContactIsValid) {
                    setLeadData(prev => ({ ...prev, contact_id: null })); // Reset contact if not valid
                }
            })
            .catch(err => {
                console.error("Failed to fetch contacts for selected company:", err);
                setContactsForCompany([]);
                setLeadData(prev => ({ ...prev, contact_id: null })); // Reset on error
            });
    } else if (!leadData.company_id) {
        setContactsForCompany([]); // Clear contacts if no company selected
         setLeadData(prev => ({ ...prev, contact_id: null })); // Reset contact_id
    }
  }, [leadData.company_id, isOpen, currentUserProfile?.org_id]);


  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    
    let processedValue: string | null = value;
    if ((name === 'owner_user_id' || name === 'company_id' || name === 'contact_id') && value === '') {
        processedValue = null;
    }

    setLeadData(prev => ({ ...prev, [name]: processedValue }));

    if (name === 'company_id') { // If company changes, reset contact
        setLeadData(prev => ({ ...prev, contact_id: null }));
    }
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }));
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!leadData.name.trim()) newErrors.name = 'Name is required.';
    if (!leadData.email.trim()) newErrors.email = 'Email is required.';
    else if (!/\S+@\S+\.\S+/.test(leadData.email)) newErrors.email = 'Email is invalid.';
    if (!leadData.mobile.trim()) newErrors.mobile = 'Mobile number is required.';
    else if (!/^[0-9+\-() ]{7,}$/.test(leadData.mobile)) newErrors.mobile = 'Mobile number is invalid.';
    if (!leadData.source.trim()) newErrors.source = 'Source is required.';
    if (!leadData.status) newErrors.status = 'Status is required.';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (viewMode && activeTab === 'details') return; 
    if (!validate()) return;

    setIsLoading(true);
    try {
      const finalLeadData: any = { ...leadData };
      if (leadToEdit?.id) finalLeadData.id = leadToEdit.id;
      // Ensure company_id and contact_id are null if empty string (or not selected)
      finalLeadData.company_id = finalLeadData.company_id || null;
      finalLeadData.contact_id = finalLeadData.contact_id || null;
      
      await onSave(finalLeadData); 
    } catch (error) {
      console.error("Error saving lead (in modal):", error);
      setErrors(prev => ({ ...prev, form: 'Failed to save lead. Please try again.' }));
    } finally {
      setIsLoading(false);
    }
  };

  // ... (handleAddActivity, handleSaveFollowUp, handleToggleFollowUpStatus, handleEditFollowUp, handleDeleteFollowUp, handleOpenDealModal, handleCloseDealModal, handleDeleteDeal remain the same) ...
   const handleAddActivity = async () => {
    if (!leadToEdit || !currentUserProfile || !newActivityDetails.trim()) return;
    setIsSubmittingRelated(true);
    setErrors(prev => ({...prev, activityForm: ''}));
    try {
      await leadActivityService.addActivity({
        lead_id: leadToEdit.id,
        user_id: currentUserProfile.id, 
        type: newActivityType,
        details: newActivityDetails,
      }, currentUserProfile.org_id);
      setNewActivityDetails('');
      setNewActivityType('note_added');
      if (leadToEdit.id && currentUserProfile.org_id) {
        fetchRelatedData(leadToEdit.id, currentUserProfile.org_id, 'activities'); 
      }
    } catch (error) {
      console.error("Failed to add activity:", error);
      setErrors(prev => ({ ...prev, activityForm: 'Failed to add activity.' }));
    } finally {
      setIsSubmittingRelated(false);
    }
  };
  
  const handleSaveFollowUp = async () => {
    if (!leadToEdit || !currentUserProfile || !newFollowUpDueDate) return;
    setIsSubmittingRelated(true);
    setErrors(prev => ({...prev, followUpForm: ''}));
    try {
      const followUpPayloadBase = {
        due_date: new Date(newFollowUpDueDate).toISOString(), 
        notes: newFollowUpNotes,
        user_id: currentUserProfile.id, 
      };

      if (editingFollowUp) {
        await leadFollowUpService.updateFollowUp(editingFollowUp.id, {
            ...followUpPayloadBase,
            status: editingFollowUp.status, 
        });
      } else {
        await leadFollowUpService.addFollowUp({
            ...followUpPayloadBase,
            lead_id: leadToEdit.id,
            status: LeadFollowUpStatus.PENDING,
        }, currentUserProfile.org_id);
      }
      
      setNewFollowUpDueDate('');
      setNewFollowUpNotes('');
      setEditingFollowUp(null);
      if (leadToEdit.id && currentUserProfile.org_id) {
        fetchRelatedData(leadToEdit.id, currentUserProfile.org_id, 'follow_ups'); 
      }
    } catch (error) {
      console.error("Failed to save follow-up:", error);
      setErrors(prev => ({ ...prev, followUpForm: 'Failed to save follow-up.' }));
    } finally {
      setIsSubmittingRelated(false);
    }
  };

  const handleToggleFollowUpStatus = async (fu: LeadFollowUp) => {
    if (!leadToEdit || !currentUserProfile) return;
    setIsSubmittingRelated(true);
    try {
        const newStatus = fu.status === LeadFollowUpStatus.PENDING ? LeadFollowUpStatus.COMPLETED : LeadFollowUpStatus.PENDING;
        await leadFollowUpService.updateFollowUp(fu.id, { 
            status: newStatus,
        });
        if (leadToEdit.id && currentUserProfile.org_id) {
            fetchRelatedData(leadToEdit.id, currentUserProfile.org_id, 'follow_ups');
        }
    } catch (error) {
        console.error("Failed to update follow-up status:", error);
    } finally {
        setIsSubmittingRelated(false);
    }
  };

  const handleEditFollowUp = (fu: LeadFollowUp) => {
    setEditingFollowUp(fu);
    setNewFollowUpDueDate(new Date(fu.due_date).toISOString().substring(0,10)); 
    setNewFollowUpNotes(fu.notes || '');
  };
  
  const handleDeleteFollowUp = async (followUpId: string) => {
    if (!leadToEdit || !currentUserProfile || !window.confirm("Are you sure you want to delete this follow-up?")) return;
    setIsSubmittingRelated(true);
    try {
        await leadFollowUpService.deleteFollowUp(followUpId);
        if (leadToEdit.id && currentUserProfile.org_id) {
            fetchRelatedData(leadToEdit.id, currentUserProfile.org_id, 'follow_ups');
        }
    } catch (error) {
        console.error("Failed to delete follow-up:", error);
    } finally {
        setIsSubmittingRelated(false);
    }
  };

  const handleOpenDealModal = (deal: Deal | null = null) => {
    setEditingDeal(deal);
    setIsDealModalOpen(true);
  };

  const handleCloseDealModal = () => {
    setIsDealModalOpen(false);
    setEditingDeal(null);
    if (leadToEdit && currentUserProfile?.org_id) { 
        fetchRelatedData(leadToEdit.id, currentUserProfile.org_id, 'deals_quotations');
    }
  };
  
  const handleDeleteDeal = async (dealId: string) => {
    if (!leadToEdit || !currentUserProfile || !window.confirm("Are you sure you want to delete this deal/quotation?")) return;
    setIsSubmittingRelated(true);
    try {
      await dealService.deleteDeal(dealId);
      if (leadToEdit.id && currentUserProfile.org_id) {
        fetchRelatedData(leadToEdit.id, currentUserProfile.org_id, 'deals_quotations');
      }
    } catch (error) {
      console.error("Error deleting deal:", error);
      alert(`Failed to delete deal: ${(error as Error).message}`);
    } finally {
      setIsSubmittingRelated(false);
    }
  };

  const userOptions = users.map(u => ({ value: u.id, label: u.full_name }));
  const companyOptions = companies.map(c => ({ value: c.id, label: c.name }));
  const contactOptionsForCompany = contactsForCompany.map(c => ({ value: c.id, label: `${c.first_name} ${c.last_name}`}));

  const statusOptions = LEAD_STATUS_OPTIONS.map(status => ({ value: status, label: status }));
  const modalTitle = viewMode ? `Lead: ${leadToEdit?.name}` : (leadToEdit ? 'Edit Lead' : 'Add New Lead');
  const activityTypeOptions = [
    { value: 'note_added', label: 'Note' }, { value: 'call', label: 'Call' },
    { value: 'email', label: 'Email' }, { value: 'meeting', label: 'Meeting' },
  ];
  
  const getStatusBadgeClasses = (status: LeadStatus | LeadFollowUpStatus | DealStatus) => {
    switch (status) {
      case LeadStatus.CONVERTED: case LeadFollowUpStatus.COMPLETED: case DealStatus.WON: 
        return 'bg-green-100 text-green-800';
      case LeadStatus.LOST: case LeadFollowUpStatus.CANCELLED: case DealStatus.LOST: case DealStatus.CANCELLED:
        return 'bg-red-100 text-red-800';
      case LeadStatus.QUALIFIED: case LeadFollowUpStatus.PENDING: case DealStatus.NEGOTIATION: case DealStatus.PRESENTED:
        return 'bg-yellow-100 text-yellow-800';
      case LeadStatus.CONTACTED: 
        return 'bg-blue-100 text-blue-800';
      case DealStatus.DRAFT:
        return 'bg-indigo-100 text-indigo-800';
      default: 
        return 'bg-secondary-100 text-secondary-800';
    }
  };


  if (!isOpen) return null;

  const renderDetailsTab = () => (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input label="Lead Name / Title" id="name" name="name" value={leadData.name} onChange={handleChange} error={errors.name} required disabled={isLoading || viewMode} />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input label="Email" id="email" name="email" type="email" value={leadData.email} onChange={handleChange} error={errors.email} required disabled={isLoading || viewMode} />
        <Input label="Mobile" id="mobile" name="mobile" type="tel" value={leadData.mobile} onChange={handleChange} error={errors.mobile} required disabled={isLoading || viewMode} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input label="Source" id="source" name="source" value={leadData.source} onChange={handleChange} error={errors.source} required disabled={isLoading || viewMode} />
        <Select label="Status" id="status" name="status" value={leadData.status} onChange={handleChange} options={statusOptions} error={errors.status} required disabled={isLoading || viewMode} />
      </div>
       <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Select 
            label="Company" 
            id="company_id" 
            name="company_id" 
            value={leadData.company_id || ''} 
            onChange={handleChange}
            options={[{value: '', label: '-- Select Company --'}, ...companyOptions]} 
            error={errors.company_id} 
            disabled={isLoading || viewMode || companies.length === 0}
            placeholder="-- Select Company --"
        />
        <Select 
            label="Contact" 
            id="contact_id" 
            name="contact_id" 
            value={leadData.contact_id || ''} 
            onChange={handleChange}
            options={[{value: '', label: '-- Select Contact --'}, ...contactOptionsForCompany]} 
            error={errors.contact_id} 
            disabled={isLoading || viewMode || !leadData.company_id || contactsForCompany.length === 0}
            placeholder="-- Select Contact --"
        />
      </div>
      <Input label="Stage (Optional)" id="stage" name="stage" value={leadData.stage || ''} onChange={handleChange} error={errors.stage} disabled={isLoading || viewMode} />
      <Select label="Assigned To" id="owner_user_id" name="owner_user_id" value={leadData.owner_user_id || ''} onChange={handleChange}
        options={[{ value: '', label: 'Unassigned' }, ...userOptions]} error={errors.owner_user_id} disabled={isLoading || viewMode || users.length === 0} 
        placeholder="Unassigned"
      />
      <Textarea label="Notes" id="notes" name="notes" value={leadData.notes || ''} onChange={handleChange} error={errors.notes} rows={4} disabled={isLoading || viewMode} />
      {errors.form && <p className="mt-2 text-sm text-red-600" role="alert">{errors.form}</p>}
      {!viewMode && (
        <div className="pt-5 flex justify-end space-x-3">
          <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>Cancel</Button>
          <Button type="submit" isLoading={isLoading} disabled={isLoading}>{leadToEdit ? 'Save Changes' : 'Create Lead'}</Button>
        </div>
      )}
    </form>
  );

  const renderActivitiesTab = () => (
    <div>
      <h4 className="text-md font-semibold text-secondary-700 mb-3">Log New Activity</h4>
      <div className="space-y-3 mb-6 p-3 border rounded-md bg-secondary-50">
        <Select label="Activity Type" id="newActivityType" name="newActivityType" value={newActivityType}
          onChange={(e) => setNewActivityType(e.target.value)} options={activityTypeOptions} disabled={isSubmittingRelated} />
        <Textarea label="Details" id="newActivityDetails" name="newActivityDetails" value={newActivityDetails}
          onChange={(e) => setNewActivityDetails(e.target.value)} rows={3} disabled={isSubmittingRelated} required />
        {errors.activityForm && <p className="text-sm text-red-600">{errors.activityForm}</p>}
        <Button onClick={handleAddActivity} isLoading={isSubmittingRelated} disabled={isSubmittingRelated || !newActivityDetails.trim()} size="sm" leftIcon={<PlusIcon className="h-4 w-4"/>}>Add Activity</Button>
      </div>

      <h4 className="text-md font-semibold text-secondary-700 mb-2">Activity Log</h4>
      {isRelatedDataLoading ? <Spinner /> : (
        activities.length > 0 ? (
          <ul className="space-y-3 max-h-60 overflow-y-auto p-1">
            {activities.map(act => (
              <li key={act.id} className="p-3 border rounded-md bg-white shadow-sm">
                <p className="text-sm font-medium text-secondary-800 capitalize">{act.type.replace('_', ' ')} by {act.user_full_name || 'System'}</p>
                <p className="text-xs text-secondary-500">{new Date(act.created_at).toLocaleString()}</p>
                <p className="mt-1 text-sm text-secondary-700 whitespace-pre-wrap">{act.details}</p>
              </li>
            ))}
          </ul>
        ) : <p className="text-sm text-secondary-500">No activities logged yet.</p>
      )}
    </div>
  );

 const renderFollowUpsTab = () => (
    <div>
        <h4 className="text-md font-semibold text-secondary-700 mb-3">{editingFollowUp ? 'Edit Follow-up' : 'Schedule New Follow-up'}</h4>
        <div className="space-y-3 mb-6 p-3 border rounded-md bg-secondary-50">
            <Input type="date" label="Due Date" id="newFollowUpDueDate" name="newFollowUpDueDate"
                value={newFollowUpDueDate} onChange={(e) => setNewFollowUpDueDate(e.target.value)}
                disabled={isSubmittingRelated} required 
            />
            <Textarea label="Notes" id="newFollowUpNotes" name="newFollowUpNotes"
                value={newFollowUpNotes} onChange={(e) => setNewFollowUpNotes(e.target.value)}
                rows={2} disabled={isSubmittingRelated}
            />
            {errors.followUpForm && <p className="text-sm text-red-600">{errors.followUpForm}</p>}
            <div className="flex space-x-2">
                <Button onClick={handleSaveFollowUp} isLoading={isSubmittingRelated} disabled={isSubmittingRelated || !newFollowUpDueDate} size="sm" leftIcon={<PlusIcon className="h-4 w-4"/>}>
                    {editingFollowUp ? 'Save Changes' : 'Schedule Follow-up'}
                </Button>
                {editingFollowUp && (
                    <Button variant="outline" onClick={() => { setEditingFollowUp(null); setNewFollowUpDueDate(''); setNewFollowUpNotes('');}} size="sm" disabled={isSubmittingRelated}>
                        Cancel Edit
                    </Button>
                )}
            </div>
        </div>

        <h4 className="text-md font-semibold text-secondary-700 mb-2">Scheduled Follow-ups</h4>
        {isRelatedDataLoading ? <Spinner /> : (
            followUps.length > 0 ? (
                <ul className="space-y-3 max-h-60 overflow-y-auto p-1">
                    {followUps.map(fu => (
                        <li key={fu.id} className="p-3 border rounded-md bg-white shadow-sm">
                            <div className="flex justify-between items-start">
                                <div>
                                    <p className={`text-sm font-medium ${fu.status === LeadFollowUpStatus.COMPLETED ? 'line-through text-secondary-500' : 'text-secondary-800'}`}>
                                        {fu.notes || 'Follow-up'}
                                    </p>
                                    <p className="text-xs text-secondary-500">
                                        Due: {new Date(fu.due_date).toLocaleDateString()} | By: {fu.user_full_name}
                                    </p>
                                     <p className="text-xs text-secondary-500">
                                        Status: <span className={`px-1.5 py-0.5 text-xs font-semibold rounded-full ${getStatusBadgeClasses(fu.status)}`}>{fu.status}</span>
                                        {fu.status === LeadFollowUpStatus.COMPLETED && fu.completed_at && ` on ${new Date(fu.completed_at).toLocaleDateString()}`}
                                    </p>
                                </div>
                                <div className="flex space-x-1 flex-shrink-0 ml-2 items-center">
                                   {fu.status === LeadFollowUpStatus.PENDING && (
                                        <Button variant="outline" size="sm" onClick={() => handleToggleFollowUpStatus(fu)} isLoading={isSubmittingRelated} className="p-1 !h-7 !w-7" aria-label="Mark as complete"><span className="text-base">✓</span></Button>
                                    )}
                                    {fu.status === LeadFollowUpStatus.COMPLETED && (
                                        <Button variant="outline" size="sm" onClick={() => handleToggleFollowUpStatus(fu)} isLoading={isSubmittingRelated} className="p-1 !h-7 !w-7" aria-label="Mark as pending"><span className="text-base">↶</span></Button>
                                    )}
                                    <Button variant="outline" size="sm" onClick={() => handleEditFollowUp(fu)} isLoading={isSubmittingRelated} className="p-1 !h-7 !w-7" aria-label="Edit follow up"><EditIcon className="h-3.5 w-3.5"/></Button>
                                    <Button variant="danger" size="sm" onClick={() => handleDeleteFollowUp(fu.id)} isLoading={isSubmittingRelated} className="p-1 !h-7 !w-7" aria-label="Delete follow up"><DeleteIcon className="h-3.5 w-3.5"/></Button>
                                </div>
                            </div>
                        </li>
                    ))}
                </ul>
            ) : <p className="text-sm text-secondary-500">No follow-ups scheduled.</p>
        )}
    </div>
);

  const renderDealsQuotationsTab = () => (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h4 className="text-md font-semibold text-secondary-700">Deals / Quotations</h4>
        <Button
          onClick={() => handleOpenDealModal()}
          leftIcon={<PlusIcon className="h-4 w-4" />}
          size="sm"
          disabled={isSubmittingRelated || !leadToEdit}
        >
          New Deal
        </Button>
      </div>
      {isRelatedDataLoading ? <Spinner /> : (
        deals.length > 0 ? (
          <ul className="space-y-3 max-h-80 overflow-y-auto p-1">
            {deals.map(deal => (
              <li key={deal.id} className="p-3 border rounded-md bg-white shadow-sm hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start">
                  <div>
                    <h5 className="text-md font-semibold text-primary-700 hover:underline cursor-pointer" onClick={() => handleOpenDealModal(deal)}>
                      {deal.deal_name || `Deal ${deal.id.substring(0, 8)}`}
                    </h5>
                    <p className="text-sm text-secondary-600">
                      Value: <span className="font-medium">${deal.total_value.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                    </p>
                    <p className="text-xs text-secondary-500">
                      Status: <span className={`px-1.5 py-0.5 text-xs font-semibold rounded-full ${getStatusBadgeClasses(deal.status)}`}>{deal.status}</span>
                       | By: {deal.created_by_user_name} on {new Date(deal.created_at).toLocaleDateString()}
                    </p>
                     {deal.company_name && <p className="text-xs text-secondary-500">Company: {deal.company_name}</p>}
                     {deal.contact_name && <p className="text-xs text-secondary-500">Contact: {deal.contact_name}</p>}
                  </div>
                  <div className="flex space-x-1 flex-shrink-0 ml-2 items-center">
                    <Button variant="outline" size="sm" onClick={() => handleOpenDealModal(deal)} className="p-1 !h-7 !w-7" aria-label="View/Edit Deal"><EyeIcon className="h-3.5 w-3.5"/></Button>
                    <Button variant="danger" size="sm" onClick={() => handleDeleteDeal(deal.id)} isLoading={isSubmittingRelated} className="p-1 !h-7 !w-7" aria-label="Delete Deal"><DeleteIcon className="h-3.5 w-3.5"/></Button>
                  </div>
                </div>
                 {deal.items && deal.items.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-secondary-100">
                        <p className="text-xs font-medium text-secondary-500 mb-1">Items ({deal.items.length}):</p>
                        <ul className="list-disc list-inside pl-1 space-y-0.5 max-h-20 overflow-y-auto">
                            {deal.items.map(item => (
                                <li key={item.id} className="text-xs text-secondary-600">
                                    {item.product_name} (Qty: {item.quantity}, Price: ${item.unit_price.toFixed(2)})
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
              </li>
            ))}
          </ul>
        ) : <p className="text-sm text-secondary-500">No deals or quotations created for this lead yet.</p>
      )}
      {leadToEdit && currentUserProfile && (
         <DealModal
            isOpen={isDealModalOpen}
            onClose={handleCloseDealModal}
            lead={leadToEdit} // Pass the full lead object, which now might include company/contact info
            dealToEdit={editingDeal}
        />
      )}
    </div>
  );


  const TABS: { name: ActiveLeadModalTab, label: string }[] = [
    { name: 'details', label: 'Details' },
    { name: 'activities', label: 'Activities' },
    { name: 'follow_ups', label: 'Follow-ups' },
    { name: 'deals_quotations', label: 'Deals / Quotations' }
  ];


  return (
    <Modal isOpen={isOpen} onClose={onClose} title={modalTitle} titleId={MODAL_TITLE_ID} size="xl">
      { (viewMode || leadToEdit) && ( 
        <div className="border-b border-secondary-200 mb-4">
          <nav className="-mb-px flex space-x-4 sm:space-x-6 overflow-x-auto" aria-label="Tabs">
            {TABS.map((tabInfo) => (
              <button
                key={tabInfo.name}
                onClick={() => {
                    setActiveTab(tabInfo.name);
                    if (leadToEdit && currentUserProfile?.org_id && tabInfo.name !== 'details') { 
                        fetchRelatedData(leadToEdit.id, currentUserProfile.org_id, tabInfo.name);
                    }
                }}
                className={`${
                  activeTab === tabInfo.name
                    ? 'border-primary-500 text-primary-600'
                    : 'border-transparent text-secondary-500 hover:text-secondary-700 hover:border-secondary-300'
                } whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm capitalize focus:outline-none`}
                aria-current={activeTab === tabInfo.name ? 'page' : undefined}
              >
                {tabInfo.label}
              </button>
            ))}
          </nav>
        </div>
      )}

      {isRelatedDataLoading && (activeTab !== 'details') && <div className="my-4 flex justify-center"><Spinner /></div>}
      
      {activeTab === 'details' && renderDetailsTab()}
      {activeTab === 'activities' && leadToEdit && renderActivitiesTab()}
      {activeTab === 'follow_ups' && leadToEdit && renderFollowUpsTab()}
      {activeTab === 'deals_quotations' && leadToEdit && renderDealsQuotationsTab()}
      
       {errors.relatedData && activeTab !== 'details' && <p className="mt-2 text-sm text-red-600" role="alert">{errors.relatedData}</p>}
       
       {viewMode && activeTab === 'details' && (
          <div className="pt-5 flex justify-end">
            <Button variant="outline" onClick={onClose}>Close</Button>
          </div>
        )}
    </Modal>
  );
};