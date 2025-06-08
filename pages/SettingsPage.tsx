
import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { userService, organizationService } from '@/services/api'; 
import { Input } from '@/components/common/Input';
import { Button } from '@/components/common/Button';
import { Spinner } from '@/components/common/Spinner';
import { Organization, Role, UserProfile } from '@/types'; 

export const SettingsPage: React.FC = () => {
  const { profile: currentProfile, isLoading: authLoading, hasRole, setProfile: setAuthContextProfile } = useAuth();
  
  const [fullName, setFullName] = useState(currentProfile?.full_name || '');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  
  const [profileMessage, setProfileMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [passwordMessage, setPasswordMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [orgLoading, setOrgLoading] = useState(false);

  useEffect(() => {
    if (currentProfile) {
      setFullName(currentProfile.full_name);
      if (hasRole(Role.ADMIN) && currentProfile.org_id) {
        setOrgLoading(true);
        organizationService.getOrganizationDetails(currentProfile.org_id)
          .then(setOrganization)
          .catch(err => console.error("Failed to load org details", err))
          .finally(() => setOrgLoading(false));
      }
    }
  }, [currentProfile, hasRole]);

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentProfile || !currentProfile.auth_user_id) return;
    if (fullName.trim() === currentProfile.full_name) {
        setProfileMessage({type: 'error', text: 'No changes detected in full name.'});
        return;
    }

    setIsUpdatingProfile(true);
    setProfileMessage(null);
    try {
      const updatedProfile = await userService.updateCurrentAuthUser(currentProfile.auth_user_id, { full_name: fullName.trim() });
      
      setProfileMessage({ type: 'success', text: 'Profile updated successfully! Changes should reflect across the app shortly.' });
      setFullName(updatedProfile.full_name); 

      // Update the profile in AuthContext so PageShell and other components reflect the change immediately.
      if (setAuthContextProfile) {
        setAuthContextProfile(updatedProfile);
      }

    } catch (error: any) {
      setProfileMessage({ type: 'error', text: error.message || 'Failed to update profile.' });
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  const handlePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentProfile || !currentProfile.auth_user_id) return;

    if (!newPassword || !confirmNewPassword) {
      setPasswordMessage({ type: 'error', text: 'New password fields are required.' });
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setPasswordMessage({ type: 'error', text: 'New passwords do not match.' });
      return;
    }
    if (newPassword.length < 6) {
      setPasswordMessage({ type: 'error', text: 'New password must be at least 6 characters.' });
      return;
    }

    setIsUpdatingPassword(true);
    setPasswordMessage(null);
    try {
      await userService.updateCurrentAuthUser(currentProfile.auth_user_id, { passwordInput: newPassword });
      setPasswordMessage({ type: 'success', text: 'Password updated successfully. Please use your new password next time you log in.' });
      setNewPassword('');
      setConfirmNewPassword('');
    } catch (error: any) {
      setPasswordMessage({ type: 'error', text: error.message || 'Failed to update password.' });
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  if (authLoading && !currentProfile) { 
    return <div className="flex justify-center items-center h-64"><Spinner size="lg" /></div>;
  }

  return (
    <div>
      <h1 className="text-3xl font-bold text-secondary-900 mb-8">Settings</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* User Profile Section */}
        <div className="bg-white shadow-xl rounded-xl p-6 md:p-8">
          <h2 className="text-xl font-semibold text-secondary-800 mb-6">My Profile</h2>
          <form onSubmit={handleProfileUpdate} className="space-y-4">
            <Input
              label="Email Address"
              id="email"
              type="email"
              value={currentProfile?.email || ''}
              disabled
              className="bg-secondary-100 cursor-not-allowed"
              aria-readonly="true"
            />
            <Input
              label="Full Name"
              id="fullName"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              disabled={isUpdatingProfile || authLoading}
            />
            {profileMessage && (
              <p className={`text-sm ${profileMessage.type === 'success' ? 'text-green-600' : 'text-red-600'}`} role="alert">
                {profileMessage.text}
              </p>
            )}
            <div>
              <Button type="submit" isLoading={isUpdatingProfile} disabled={isUpdatingProfile || authLoading || fullName.trim() === currentProfile?.full_name}>
                Save Profile Changes
              </Button>
            </div>
          </form>

          <hr className="my-8 border-secondary-200" />

          <h3 className="text-lg font-medium text-secondary-800 mb-4">Change Password</h3>
          <form onSubmit={handlePasswordUpdate} className="space-y-4">
            <Input
              label="New Password"
              id="newPassword"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              disabled={isUpdatingPassword || authLoading}
              autoComplete="new-password"
            />
            <Input
              label="Confirm New Password"
              id="confirmNewPassword"
              type="password"
              value={confirmNewPassword}
              onChange={(e) => setConfirmNewPassword(e.target.value)}
              required
              disabled={isUpdatingPassword || authLoading}
              autoComplete="new-password"
            />
            {passwordMessage && (
              <p className={`text-sm ${passwordMessage.type === 'success' ? 'text-green-600' : 'text-red-600'}`} role="alert">
                {passwordMessage.text}
              </p>
            )}
            <div>
              <Button type="submit" isLoading={isUpdatingPassword} disabled={isUpdatingPassword || authLoading}>
                Update Password
              </Button>
            </div>
          </form>
        </div>

        {/* Organization Settings Section (Admin Only) */}
        {hasRole(Role.ADMIN) && (
          <div className="bg-white shadow-xl rounded-xl p-6 md:p-8">
            <h2 className="text-xl font-semibold text-secondary-800 mb-6">Organization Settings</h2>
            {orgLoading ? <Spinner /> : organization ? (
              <div className="space-y-3">
                <div>
                    <label className="block text-sm font-medium text-secondary-700">Organization Name</label>
                    <p className="mt-1 text-lg text-secondary-900">{organization.name}</p>
                </div>
                 <div>
                    <label className="block text-sm font-medium text-secondary-700">Organization ID</label>
                    <p className="mt-1 text-sm text-secondary-500 bg-secondary-100 p-2 rounded inline-block">{organization.id}</p>
                </div>
                 <div>
                    <label className="block text-sm font-medium text-secondary-700">Created On</label>
                    <p className="mt-1 text-sm text-secondary-900">{new Date(organization.created_at).toLocaleDateString()}</p>
                </div>
                 <p className="mt-4 text-xs text-secondary-400">Organization settings modifications are typically handled via backend processes or dedicated admin interfaces.</p>
              </div>
            ) : <p className="text-secondary-500">Could not load organization details.</p>}
          </div>
        )}
      </div>
    </div>
  );
};