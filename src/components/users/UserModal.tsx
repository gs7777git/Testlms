
import React, { useState, useEffect } from 'react';
import { Modal } from '@/components/common/Modal';
import { Button } from '@/components/common/Button';
import { Input } from '@/components/common/Input';
import { Select } from '@/components/common/Select';
import { UserProfile, Role } from '@/types'; 
import { USER_ROLE_OPTIONS } from '@/constants';
import { useAuth } from '@/contexts/AuthContext'; 

interface UserModalProps {
  isOpen: boolean;
  onClose: () => void;
  userToEdit?: UserProfile | null; 
  onSave: (userData: Partial<UserProfile> & { passwordInput?: string; confirmPassword?: string }, isNew: boolean) => Promise<void>;
  allUsers: UserProfile[]; 
}

const initialUserState: Partial<UserProfile> & { passwordInput?: string; confirmPassword?: string } = {
  full_name: '',
  email: '',
  role: Role.USER, 
  role_name: '',
  parent_user_id: null,
  passwordInput: '',
  confirmPassword: '',
};

const MODAL_TITLE_ID = "user-modal-title";

export const UserModal: React.FC<UserModalProps> = ({ isOpen, onClose, userToEdit, onSave, allUsers }) => {
  const [formData, setFormData] = useState(initialUserState);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [showPasswordFields, setShowPasswordFields] = useState(false);
  const { profile: currentUserProfile } = useAuth(); 
  
  const potentialManagers = allUsers.filter(u => u.id !== userToEdit?.id); 

  const isNewUser = !userToEdit;
  const isEditingSelf = currentUserProfile?.id === userToEdit?.id;

  useEffect(() => {
    if (isOpen) {
      if (userToEdit) {
        setFormData({
          id: userToEdit.id,
          auth_user_id: userToEdit.auth_user_id, 
          full_name: userToEdit.full_name,
          email: userToEdit.email,
          role: userToEdit.role,
          role_name: userToEdit.role_name || '',
          parent_user_id: userToEdit.parent_user_id || null,
          org_id: userToEdit.org_id,
          passwordInput: '', 
          confirmPassword: '',
        });
        setShowPasswordFields(false); 
      } else {
        setFormData({...initialUserState, org_id: currentUserProfile?.org_id }); 
        setShowPasswordFields(true); 
      }
      setErrors({});
      setIsLoading(false);
    }
  }, [userToEdit, isOpen, currentUserProfile]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    let processedValue: string | null = value;
    if ((name === 'parent_user_id' || name === 'role_name') && value === '') { 
        processedValue = null;
    }
    setFormData(prev => ({ ...prev, [name]: processedValue }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!formData.full_name?.trim()) newErrors.full_name = 'Full name is required.';
    
    if (isNewUser) {
      if (!formData.email?.trim()) newErrors.email = 'Email is required.';
      else if (!/\S+@\S+\.\S+/.test(formData.email)) newErrors.email = 'Email is invalid.';
    }

    if (!formData.role) newErrors.role = 'System Role is required.';

    if (isNewUser || showPasswordFields) {
      if (!formData.passwordInput?.trim()) {
        if (isNewUser) newErrors.passwordInput = 'Password is required.';
      } else if (formData.passwordInput.length < 6) {
        newErrors.passwordInput = 'Password must be at least 6 characters.';
      }
      if (formData.passwordInput && formData.passwordInput !== formData.confirmPassword) {
        newErrors.confirmPassword = 'Passwords do not match.';
      }
    }
    
    if (isEditingSelf && userToEdit?.role === Role.ADMIN && formData.role !== Role.ADMIN) {
        newErrors.role = "An admin cannot change their own System Role to a non-admin role.";
    }
    if (formData.parent_user_id && formData.parent_user_id === userToEdit?.id) { 
        newErrors.parent_user_id = "A user cannot report to themselves.";
    }


    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsLoading(true);
    const dataToSave: Partial<UserProfile> & { passwordInput?: string; confirmPassword?: string } = {
      id: formData.id, 
      auth_user_id: formData.auth_user_id, 
      full_name: formData.full_name,
      email: formData.email, 
      role: formData.role,
      role_name: formData.role_name?.trim() || null, 
      parent_user_id: formData.parent_user_id || null, 
      org_id: formData.org_id || currentUserProfile?.org_id, 
    };

    if (isNewUser || (showPasswordFields && formData.passwordInput)) {
      dataToSave.passwordInput = formData.passwordInput;
    }
    
    try {
        await onSave(dataToSave, isNewUser);
    } catch (error: any) {
        setErrors(prev => ({ ...prev, form: error.message || 'Failed to save user. Please try again.' }));
        setIsLoading(false); // Ensure loading is stopped on error from onSave
    } 
  };
  
  const handleClose = () => {
    setFormData(initialUserState);
    setErrors({});
    setShowPasswordFields(false);
    onClose(); 
  };

  const roleOptions = USER_ROLE_OPTIONS.map(role => ({ value: role, label: role.charAt(0).toUpperCase() + role.slice(1) }));
  const managerOptions = [{value: '', label: 'None (No Manager)'}, ...potentialManagers.map(u => ({value: u.id, label: u.full_name}))];
  const modalTitle = isNewUser ? 'Add New User' : `Edit User: ${userToEdit?.full_name}`;

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={modalTitle} titleId={MODAL_TITLE_ID} size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label="Full Name" id="full_name" name="full_name" value={formData.full_name || ''} onChange={handleChange} error={errors.full_name} required disabled={isLoading} />
        <Input label="Email" id="email" name="email" type="email" value={formData.email || ''} onChange={handleChange} error={errors.email} required={isNewUser} disabled={isLoading || !isNewUser} aria-readonly={!isNewUser} />
        <Select label="System Role" id="role" name="role" value={formData.role || ''} onChange={handleChange} options={roleOptions} error={errors.role} required disabled={isLoading || (isEditingSelf && currentUserProfile?.role === Role.ADMIN && formData.role !== Role.ADMIN)} />
        <Input label="Custom Role Title (e.g., Sales Manager)" id="role_name" name="role_name" value={formData.role_name || ''} onChange={handleChange} error={errors.role_name} disabled={isLoading} placeholder="e.g., Sales Manager, Support Lead" />
        <Select label="Reports To (Manager)" id="parent_user_id" name="parent_user_id" value={formData.parent_user_id || ''} onChange={handleChange} options={managerOptions} error={errors.parent_user_id} disabled={isLoading || isEditingSelf} placeholder="None (No Manager)" />

        {!isNewUser && (
          <div className="my-4">
            <label className="flex items-center">
              <input type="checkbox" className="form-checkbox h-5 w-5 text-primary-600 rounded border-secondary-300 focus:ring-primary-500" checked={showPasswordFields} onChange={(e) => setShowPasswordFields(e.target.checked)} disabled={isLoading} aria-controls="password-fields-group" />
              <span className="ml-2 text-sm text-secondary-700">Change Password</span>
            </label>
          </div>
        )}

        {(isNewUser || showPasswordFields) && (
          <div id="password-fields-group" className="space-y-4">
            <Input label={isNewUser ? "Password" : "New Password"} id="passwordInput" name="passwordInput" type="password" value={formData.passwordInput || ''} onChange={handleChange} error={errors.passwordInput} required={isNewUser} disabled={isLoading} autoComplete="new-password" />
            <Input label={isNewUser ? "Confirm Password" : "Confirm New Password"} id="confirmPassword" name="confirmPassword" type="password" value={formData.confirmPassword || ''} onChange={handleChange} error={errors.confirmPassword} required={isNewUser && !!formData.passwordInput} disabled={isLoading} autoComplete="new-password" />
          </div>
        )}
        
        {errors.form && <p className="mt-2 text-sm text-red-600" role="alert">{errors.form}</p>}
        
        <div className="pt-5">
          <div className="flex justify-end space-x-3">
            <Button type="button" variant="outline" onClick={handleClose} disabled={isLoading}>Cancel</Button>
            <Button type="submit" isLoading={isLoading} disabled={isLoading}>{isNewUser ? 'Create User' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
};
