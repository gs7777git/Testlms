
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
}

const initialUserState: Partial<UserProfile> & { passwordInput?: string; confirmPassword?: string } = {
  full_name: '',
  email: '',
  role: Role.USER, 
  passwordInput: '',
  confirmPassword: '',
};

const MODAL_TITLE_ID = "user-modal-title";

export const UserModal: React.FC<UserModalProps> = ({ isOpen, onClose, userToEdit, onSave }) => {
  const [formData, setFormData] = useState(initialUserState);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [showPasswordFields, setShowPasswordFields] = useState(false);
  const { profile: currentUserProfile } = useAuth(); 

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
    setFormData(prev => ({ ...prev, [name]: value }));
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

    if (!formData.role) newErrors.role = 'Role is required.';

    if (isNewUser || showPasswordFields) {
      if (!formData.passwordInput?.trim()) {
        if (isNewUser) newErrors.passwordInput = 'Password is required.';
        // For existing users, password is optional if showPasswordFields is true but no input
      } else if (formData.passwordInput.length < 6) {
        newErrors.passwordInput = 'Password must be at least 6 characters.';
      }
      if (formData.passwordInput && formData.passwordInput !== formData.confirmPassword) { // Only validate confirm if password is being set
        newErrors.confirmPassword = 'Passwords do not match.';
      }
    }
    
    if (isEditingSelf && userToEdit?.role === Role.ADMIN && formData.role !== Role.ADMIN) {
        newErrors.role = "An admin cannot change their own role to a non-admin role.";
    }


    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsLoading(true);
    const dataToSave: Partial<UserProfile> & { passwordInput?: string; confirmPassword?: string } = {
      id: formData.id, // Will be undefined for new user
      auth_user_id: formData.auth_user_id, // Will be undefined for new user
      full_name: formData.full_name,
      email: formData.email, // Email is only set for new user; for edit, it's read-only in form
      role: formData.role,
      org_id: formData.org_id || currentUserProfile?.org_id, 
    };

    if (isNewUser || (showPasswordFields && formData.passwordInput)) {
      dataToSave.passwordInput = formData.passwordInput;
    }
    
    try {
        await onSave(dataToSave, isNewUser);
        // Parent (UsersPage) will handle closing modal on success and data refresh
    } catch (error: any) {
        setErrors(prev => ({ ...prev, form: error.message || 'Failed to save user. Please try again.' }));
    } finally {
        setIsLoading(false);
    }
  };
  
  const handleClose = () => {
    setFormData(initialUserState);
    setErrors({});
    setShowPasswordFields(false);
    onClose(); 
  };

  const roleOptions = USER_ROLE_OPTIONS.map(role => ({ value: role, label: role.charAt(0).toUpperCase() + role.slice(1) }));
  const modalTitle = isNewUser ? 'Add New User' : `Edit User: ${userToEdit?.full_name}`;

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={modalTitle} titleId={MODAL_TITLE_ID} size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Full Name"
          id="full_name"
          name="full_name"
          value={formData.full_name || ''}
          onChange={handleChange}
          error={errors.full_name}
          required
          disabled={isLoading}
        />
        <Input
          label="Email"
          id="email"
          name="email"
          type="email"
          value={formData.email || ''}
          onChange={handleChange}
          error={errors.email}
          required={isNewUser} 
          disabled={isLoading || !isNewUser} 
          aria-readonly={!isNewUser} 
        />
        <Select
          label="Role"
          id="role"
          name="role"
          value={formData.role || ''}
          onChange={handleChange}
          options={roleOptions}
          error={errors.role}
          required
          disabled={isLoading || (isEditingSelf && currentUserProfile?.role === Role.ADMIN && formData.role !== Role.ADMIN)}
        />

        {!isNewUser && (
          <div className="my-4">
            <label className="flex items-center">
              <input
                type="checkbox"
                className="form-checkbox h-5 w-5 text-primary-600 rounded border-secondary-300 focus:ring-primary-500"
                checked={showPasswordFields}
                onChange={(e) => setShowPasswordFields(e.target.checked)}
                disabled={isLoading}
                aria-controls="password-fields-group"
              />
              <span className="ml-2 text-sm text-secondary-700">Change Password</span>
            </label>
          </div>
        )}

        {(isNewUser || showPasswordFields) && (
          <div id="password-fields-group" className="space-y-4">
            <Input
              label={isNewUser ? "Password" : "New Password"}
              id="passwordInput"
              name="passwordInput"
              type="password"
              value={formData.passwordInput || ''}
              onChange={handleChange}
              error={errors.passwordInput}
              required={isNewUser} 
              disabled={isLoading}
              autoComplete="new-password"
            />
            <Input
              label={isNewUser ? "Confirm Password" : "Confirm New Password"}
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              value={formData.confirmPassword || ''}
              onChange={handleChange}
              error={errors.confirmPassword}
              required={isNewUser && !!formData.passwordInput} 
              disabled={isLoading}
              autoComplete="new-password"
            />
          </div>
        )}
        
        {errors.form && <p className="mt-2 text-sm text-red-600" role="alert">{errors.form}</p>}
        
        <div className="pt-5">
          <div className="flex justify-end space-x-3">
            <Button type="button" variant="outline" onClick={handleClose} disabled={isLoading}>
              Cancel
            </Button>
            <Button type="submit" isLoading={isLoading} disabled={isLoading}>
              {isNewUser ? 'Create User' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
};