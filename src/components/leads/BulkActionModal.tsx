
import React, { useState, useEffect } from 'react';
import { Modal } from '@/components/common/Modal';
import { Button } from '@/components/common/Button';
import { Select } from '@/components/common/Select';
import { LeadStatus, UserProfile, Role } from '@/types';
import { LEAD_STATUS_OPTIONS } from '@/constants';

interface BulkActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedLeadIds: string[];
  actionType: 'status' | 'owner';
  onConfirm: (leadIds: string[], updates: Partial<{ status: LeadStatus; owner_user_id: string | null }>) => Promise<void>;
  usersForAssignment?: UserProfile[]; // Only needed for 'owner' action
}

export const BulkActionModal: React.FC<BulkActionModalProps> = ({
  isOpen,
  onClose,
  selectedLeadIds,
  actionType,
  onConfirm,
  usersForAssignment = [],
}) => {
  const [selectedValue, setSelectedValue] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setSelectedValue('');
      setError(null);
    }
  }, [isOpen]);

  const handleSubmit = async () => {
    if (!selectedValue) {
      setError(`Please select a new ${actionType}.`);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const updates: Partial<{ status: LeadStatus; owner_user_id: string | null }> = {};
      if (actionType === 'status') {
        updates.status = selectedValue as LeadStatus;
      } else if (actionType === 'owner') {
        updates.owner_user_id = selectedValue === 'unassign' ? null : selectedValue;
      }
      await onConfirm(selectedLeadIds, updates);
      onClose();
    } catch (err: any) {
      setError(err.message || `Failed to update ${actionType}.`);
    } finally {
      setIsLoading(false);
    }
  };

  const title = actionType === 'status' ? 'Change Status for Selected Leads' : 'Reassign Selected Leads';
  const label = actionType === 'status' ? 'New Status' : 'New Owner';
  
  let options = [];
  if (actionType === 'status') {
    options = LEAD_STATUS_OPTIONS.map(status => ({ value: status, label: status }));
  } else if (actionType === 'owner') {
    options = [
      { value: 'unassign', label: 'Unassign' },
      ...usersForAssignment.map(user => ({ value: user.id, label: user.full_name }))
    ];
  }

  if (selectedLeadIds.length === 0) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="md">
      <div className="space-y-4">
        <p className="text-sm text-secondary-600">
          You are about to update <span className="font-semibold">{selectedLeadIds.length}</span> lead(s).
        </p>
        <Select
          label={label}
          id="bulk-action-value"
          value={selectedValue}
          onChange={(e) => setSelectedValue(e.target.value)}
          options={[{ value: '', label: `-- Select ${label} --` }, ...options]}
          error={error && !selectedValue ? error : undefined}
          disabled={isLoading}
        />
        {error && selectedValue && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end space-x-3 pt-4">
          <Button variant="outline" onClick={onClose} disabled={isLoading}>Cancel</Button>
          <Button onClick={handleSubmit} isLoading={isLoading} disabled={!selectedValue || isLoading}>
            Confirm Update
          </Button>
        </div>
      </div>
    </Modal>
  );
};
