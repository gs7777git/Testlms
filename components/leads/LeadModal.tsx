
import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { Input, Textarea } from '../common/Input';
import { Select } from '../common/Select';
import { Lead, LeadStatus, UserProfile, Role } from '../../types'; 
import { LEAD_STATUS_OPTIONS } from '../../constants';
import { userService } from '../../services/api'; 
import { Spinner } from '../common/Spinner';
import { useAuth } from '../../contexts/AuthContext';

interface LeadModalProps {
  isOpen: boolean;
  onClose: () => void;
  leadToEdit?: Lead | null;
  onSave: (lead: Omit<Lead, 'id' | 'created_at' | 'updated_at' | 'owner_name' | 'org_id'> | Lead) => void; 
  viewMode?: boolean;
}

const initialLeadState: Omit<Lead, 'id' | 'created_at' | 'updated_at' | 'owner_name' | 'org_id'> = {
  name: '',
  email: '',
  mobile: '',
  source: '',
  status: LeadStatus.NEW,
  stage: '', 
  owner_user_id: null, 
  notes: '',
};

const MODAL_TITLE_ID = "lead-modal-title";

export const LeadModal: React.FC<LeadModalProps> = ({ isOpen, onClose, leadToEdit, onSave, viewMode = false }) => {
  const [leadData, setLeadData] = useState<Omit<Lead, 'id' | 'created_at' | 'updated_at' | 'owner_name' | 'org_id'>>(initialLeadState);
  const [users, setUsers] = useState<UserProfile[]>([]); 
  const [isLoading, setIsLoading] = useState(false); 
  const [isUsersLoading, setIsUsersLoading] = useState(false); 
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { profile: currentUserProfile } = useAuth(); 

  useEffect(() => {
    if (isOpen && currentUserProfile?.org_id) { 
        setIsUsersLoading(true);
        const fetchUsers = async () => {
          try {
            const fetchedUsers = await userService.getUsers(currentUserProfile.org_id);
            setUsers(fetchedUsers);
          } catch (err) {
            console.error("Failed to fetch users:", err);
            setUsers([]);
          } finally {
            setIsUsersLoading(false);
          }
        };
        fetchUsers();

        if (leadToEdit) {
            setLeadData({
              name: leadToEdit.name,
              email: leadToEdit.email,
              mobile: leadToEdit.mobile,
              source: leadToEdit.source,
              status: leadToEdit.status,
              stage: leadToEdit.stage || '',
              owner_user_id: leadToEdit.owner_user_id,
              notes: leadToEdit.notes || '',
            });
        } else {
            setLeadData(initialLeadState);
        }
        setErrors({});
    }
  }, [leadToEdit, isOpen, currentUserProfile?.org_id]);


  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setLeadData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
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
    if (viewMode) return;
    if (!validate()) return;
    
    setIsLoading(true);
    try {
      const finalLeadData: any = { ...leadData };
      if (leadToEdit?.id) { 
        finalLeadData.id = leadToEdit.id;
      }
      onSave(finalLeadData); 
    } catch (error) {
      console.error("Error saving lead (in modal):", error);
      setErrors(prev => ({ ...prev, form: 'Failed to save lead. Please try again.' }));
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleClose = () => {
    if (isOpen) {
        setLeadData(initialLeadState);
        setErrors({});
    }
    onClose();
  };

  const userOptions = users.map(u => ({ value: u.id, label: u.full_name })); 
  const statusOptions = LEAD_STATUS_OPTIONS.map(status => ({ value: status, label: status }));

  const modalTitle = viewMode ? `Lead Details: ${leadToEdit?.name}` : (leadToEdit ? 'Edit Lead' : 'Add New Lead');
  
  const getStatusColorClasses = (status: LeadStatus) => {
    switch (status) {
      case LeadStatus.CONVERTED: return 'bg-primary-100 text-primary-800';
      case LeadStatus.LOST: return 'bg-red-100 text-red-800';
      case LeadStatus.QUALIFIED: return 'bg-yellow-100 text-yellow-800';
      case LeadStatus.CONTACTED: return 'bg-blue-100 text-blue-800';
      default: return 'bg-secondary-100 text-secondary-800';
    }
  };

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={modalTitle} titleId={MODAL_TITLE_ID} size={viewMode ? "md" : "xl"}>
      {isUsersLoading && (
        <div className="flex flex-col items-center justify-center p-4">
          <Spinner size="md" />
          <p className="mt-2 text-sm text-secondary-600">Loading users...</p>
        </div>
      )}
      {!isUsersLoading && viewMode && leadToEdit ? (
        <div className="space-y-3 text-sm">
          <p><strong>Name:</strong> {leadToEdit.name}</p>
          <p><strong>Email:</strong> {leadToEdit.email}</p>
          <p><strong>Mobile:</strong> {leadToEdit.mobile}</p>
          <p><strong>Source:</strong> {leadToEdit.source}</p>
          <p><strong>Status:</strong> <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColorClasses(leadToEdit.status)}`}>{leadToEdit.status}</span></p>
          {leadToEdit.stage && <p><strong>Stage:</strong> {leadToEdit.stage}</p>}
          <p><strong>Assigned To:</strong> {leadToEdit.owner_name || (users.find(u => u.id === leadToEdit.owner_user_id)?.full_name || 'Unassigned')}</p>
          <div className="max-h-28 overflow-y-auto"><strong className="block">Notes:</strong> {leadToEdit.notes ? <div className="whitespace-pre-wrap">{leadToEdit.notes}</div> : 'N/A'}</div>
          <p><strong>Created At:</strong> {new Date(leadToEdit.created_at).toLocaleString()}</p>
          <p><strong>Last Updated:</strong> {new Date(leadToEdit.updated_at).toLocaleString()}</p>
        </div>
      ) : !isUsersLoading && (
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input label="Name" id="name" name="name" value={leadData.name} onChange={handleChange} error={errors.name} required disabled={isLoading} />
          <Input label="Email" id="email" name="email" type="email" value={leadData.email} onChange={handleChange} error={errors.email} required disabled={isLoading} />
          <Input label="Mobile" id="mobile" name="mobile" type="tel" value={leadData.mobile} onChange={handleChange} error={errors.mobile} required disabled={isLoading} />
          <Input label="Source" id="source" name="source" value={leadData.source} onChange={handleChange} error={errors.source} required disabled={isLoading} />
          <Select label="Status" id="status" name="status" value={leadData.status} onChange={handleChange} options={statusOptions} error={errors.status} required disabled={isLoading} />
          <Input label="Stage (Optional)" id="stage" name="stage" value={leadData.stage || ''} onChange={handleChange} error={errors.stage} disabled={isLoading} />
          <Select
            label="Assigned To"
            id="owner_user_id" 
            name="owner_user_id" 
            value={leadData.owner_user_id || ''}
            onChange={handleChange}
            options={[{ value: '', label: 'Unassigned' }, ...userOptions]}
            error={errors.owner_user_id}
            disabled={isLoading || isUsersLoading}
          />
          <Textarea label="Notes" id="notes" name="notes" value={leadData.notes || ''} onChange={handleChange} error={errors.notes} rows={4} disabled={isLoading} />
          
          {errors.form && <p className="mt-2 text-sm text-red-600" role="alert">{errors.form}</p>}
          
          <div className="pt-5">
            <div className="flex justify-end space-x-3">
              <Button type="button" variant="outline" onClick={handleClose} disabled={isLoading}> Cancel </Button>
              <Button type="submit" isLoading={isLoading} disabled={isLoading || isUsersLoading}>
                {leadToEdit ? 'Save Changes' : 'Create Lead'}
              </Button>
            </div>
          </div>
        </form>
      )}
    </Modal>
  );
};