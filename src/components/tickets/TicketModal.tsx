
import React, { useState, useEffect, useCallback } from 'react';
import { Modal } from '@/components/common/Modal';
import { Button } from '@/components/common/Button';
import { Input, Textarea } from '@/components/common/Input';
import { Select } from '@/components/common/Select';
import { Ticket, TicketStatus, TicketPriority, UserProfile, Role } from '@/types';
import { TICKET_STATUS_OPTIONS, TICKET_PRIORITY_OPTIONS } from '@/constants';
// import { ticketService } from '@/services/api'; // No longer directly used for saving
import { useAuth } from '@/contexts/AuthContext';

interface TicketModalProps {
  isOpen: boolean;
  onClose: () => void;
  ticketToEdit?: Ticket | null;
  onSave: (
    ticketData: Omit<Ticket, 'id' | 'ticket_uid' | 'created_at' | 'updated_at' | 'org_id' | 'created_by_user_id' | 'created_by_user_name' | 'assigned_to_user_name' | 'resolved_at' | 'closed_at'> | Ticket,
    isNew: boolean,
    originalTicket?: Ticket | null // Pass original ticket for update logic
  ) => Promise<void>;
  viewModeInitial?: boolean;
  allUsers: UserProfile[]; // For assignee dropdown
}

const initialTicketState: Omit<Ticket, 'id' | 'ticket_uid' | 'created_at' | 'updated_at' | 'org_id' | 'created_by_user_id' | 'created_by_user_name' | 'assigned_to_user_name' | 'resolved_at' | 'closed_at'> = {
  subject: '',
  description: '',
  status: TicketStatus.OPEN,
  priority: TicketPriority.MEDIUM,
  requester_info: '',
  assigned_to_user_id: null,
};

export const TicketModal: React.FC<TicketModalProps> = ({
  isOpen, onClose, ticketToEdit, onSave, viewModeInitial = false, allUsers
}) => {
  const [ticketData, setTicketData] = useState(initialTicketState);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isEditing, setIsEditing] = useState(!viewModeInitial);
  
  const { profile: currentUserProfile, hasRole } = useAuth();

  const resetForm = useCallback(() => {
    setTicketData(initialTicketState);
    setErrors({});
    setIsEditing(!viewModeInitial || !ticketToEdit);
  }, [viewModeInitial, ticketToEdit]);
  
  useEffect(() => {
    if (isOpen) {
      if (ticketToEdit) {
        setTicketData({
          subject: ticketToEdit.subject,
          description: ticketToEdit.description,
          status: ticketToEdit.status,
          priority: ticketToEdit.priority,
          requester_info: ticketToEdit.requester_info || '',
          assigned_to_user_id: ticketToEdit.assigned_to_user_id || null,
        });
        setIsEditing(!viewModeInitial); 
      } else {
        setTicketData({...initialTicketState, requester_info: currentUserProfile?.full_name || ''});
        setIsEditing(true); 
      }
    } else {
      resetForm();
    }
  }, [ticketToEdit, isOpen, viewModeInitial, resetForm, currentUserProfile]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    let processedValue: string | null = value;
     if (name === 'assigned_to_user_id' && value === '') {
        processedValue = null;
    }
    setTicketData(prev => ({ ...prev, [name]: processedValue }));
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }));
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!ticketData.subject.trim()) newErrors.subject = 'Subject is required.';
    if (!ticketData.description.trim()) newErrors.description = 'Description is required.';
    if (!ticketData.status) newErrors.status = 'Status is required.';
    if (!ticketData.priority) newErrors.priority = 'Priority is required.';
    if (!ticketData.requester_info?.trim()) newErrors.requester_info = 'Requester info is required.';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate() || !isEditing) return;

    setIsLoading(true);
    try {
      const payload: Omit<Ticket, 'id' | 'ticket_uid' | 'created_at' | 'updated_at' | 'org_id' | 'created_by_user_id' | 'created_by_user_name' | 'assigned_to_user_name' | 'resolved_at' | 'closed_at'> | Ticket = {
         ...ticketData,
      };
      if (ticketToEdit?.id) { // If editing, include the id
        (payload as Ticket).id = ticketToEdit.id;
      }

      await onSave(payload, !ticketToEdit, ticketToEdit);
      // onClose will be called by the parent (SupportPage) upon successful save
    } catch (error: any) {
      console.error("Error saving ticket:", error);
      setErrors(prev => ({ ...prev, form: error.message || 'Failed to save ticket.' }));
    } finally {
      setIsLoading(false);
    }
  };
  
  const userOptions = [{value: '', label: 'Unassigned'}, ...allUsers.map(u => ({ value: u.id, label: u.full_name }))];
  const statusOptions = TICKET_STATUS_OPTIONS.map(s => ({ value: s, label: s }));
  const priorityOptions = TICKET_PRIORITY_OPTIONS.map(p => ({ value: p, label: p }));

  const modalTitle = ticketToEdit 
    ? (isEditing ? `Edit Ticket: ${ticketData.subject || ticketToEdit.subject}` : `Ticket: ${ticketToEdit.ticket_uid} - ${ticketToEdit.subject}`) 
    : 'Create New Ticket';
  
  const canEditThisTicket = hasRole(Role.ADMIN) || 
                              (ticketToEdit && currentUserProfile?.id === ticketToEdit.created_by_user_id) ||
                              (ticketToEdit && currentUserProfile?.id === ticketToEdit.assigned_to_user_id) ||
                              !ticketToEdit;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={modalTitle} size="lg">
      <form onSubmit={handleSubmit} className="space-y-4" aria-labelledby="ticket-modal-title">
        {ticketToEdit && !isEditing && (
             <div className="mb-2 text-sm bg-secondary-50 p-3 rounded-md">
                <p><span className="font-semibold">Ticket ID:</span> {ticketToEdit.ticket_uid}</p>
                <p><span className="font-semibold">Created by:</span> {ticketToEdit.created_by_user_name} on {new Date(ticketToEdit.created_at).toLocaleDateString()}</p>
                {ticketToEdit.updated_at && <p><span className="font-semibold">Last Updated:</span> {new Date(ticketToEdit.updated_at).toLocaleString()}</p>}
             </div>
        )}
        <Input label="Subject" id="subject" name="subject" value={ticketData.subject} onChange={handleChange} error={errors.subject} required disabled={isLoading || !isEditing} aria-required="true" />
        <Textarea label="Description" id="description" name="description" value={ticketData.description} onChange={handleChange} error={errors.description} rows={4} required disabled={isLoading || !isEditing} aria-required="true" />
        <Input label="Requester Info (Name, Email, etc.)" id="requester_info" name="requester_info" value={ticketData.requester_info || ''} onChange={handleChange} error={errors.requester_info} required disabled={isLoading || !isEditing} aria-required="true" />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Select label="Status" id="status" name="status" value={ticketData.status} onChange={handleChange} options={statusOptions} error={errors.status} required disabled={isLoading || !isEditing} aria-required="true" />
          <Select label="Priority" id="priority" name="priority" value={ticketData.priority} onChange={handleChange} options={priorityOptions} error={errors.priority} required disabled={isLoading || !isEditing} aria-required="true" />
        </div>
        <Select label="Assigned To" id="assigned_to_user_id" name="assigned_to_user_id" value={ticketData.assigned_to_user_id || ''} onChange={handleChange} options={userOptions} error={errors.assigned_to_user_id} disabled={isLoading || !isEditing || userOptions.length <=1 } placeholder="Unassigned" />

        {errors.form && <p className="mt-2 text-sm text-red-600" role="alert">{errors.form}</p>}
        
        <div className="pt-5 flex justify-end space-x-3">
           {ticketToEdit && !isEditing && canEditThisTicket && (
             <Button type="button" variant="secondary" onClick={() => setIsEditing(true)} disabled={isLoading}>Edit Ticket</Button>
           )}
          <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>Cancel</Button>
          {isEditing && <Button type="submit" isLoading={isLoading} disabled={isLoading}>{ticketToEdit ? 'Save Changes' : 'Create Ticket'}</Button>}
        </div>
      </form>
    </Modal>
  );
};
