
import React, { useState, useEffect, useCallback } from 'react';
import { UserProfile, Role } from '@/types'; 
import { userService } from '@/services/api';
import { Spinner } from '@/components/common/Spinner';
import { Button } from '@/components/common/Button';
import { PlusIcon, EditIcon, DeleteIcon } from '@/components/common/Icons';
import { UserModal } from '@/components/users/UserModal';
import { useAuth } from '@/contexts/AuthContext';

export const UsersPage: React.FC = () => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [pageLoading, setPageLoading] = useState(true); 
  const [isDataLoading, setIsDataLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const { profile: currentUserProfile, hasRole } = useAuth();

  const fetchData = useCallback(async (options?: { isInitialLoad?: boolean }) => {
    const { isInitialLoad = false } = options || {};
    if (!currentUserProfile?.org_id) {
        if(isInitialLoad) setPageLoading(false);
        setIsDataLoading(false);
        setUsers([]);
        return;
    }
    
    if(isInitialLoad) {
        setPageLoading(true);
    } else {
        setIsDataLoading(true);
    }
    
    try {
      const fetchedUsers = await userService.getUsers(currentUserProfile.org_id);
      setUsers(fetchedUsers || []);
    } catch (error) {
      console.error("Failed to fetch users:", error);
      setUsers([]);
      alert(`Failed to fetch users: ${(error as Error).message}`);
    } finally {
      setIsDataLoading(false);
      if(isInitialLoad) {
        setPageLoading(false);
      }
    }
  }, [currentUserProfile?.org_id]);

  useEffect(() => {
    if (currentUserProfile?.org_id) { 
        fetchData({isInitialLoad: true});
    } else if (!currentUserProfile && isDataLoading === false) { 
        setPageLoading(false); 
    }
  }, [fetchData, currentUserProfile, isDataLoading]);

  const handleOpenModal = (user: UserProfile | null = null) => {
    setEditingUser(user);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingUser(null);
  };

  const handleSaveUser = async (
    userData: Partial<UserProfile> & { passwordInput?: string; confirmPassword?: string },
    isNew: boolean
  ) => {
    if (!currentUserProfile?.org_id) {
        throw new Error("Cannot save user: current user organization ID is missing.");
    }
    setIsDataLoading(true); // Show loading state on the page
    try {
      if (isNew) {
        const { email, passwordInput, full_name, role, role_name, parent_user_id } = userData;
        if (!email || !passwordInput || !full_name || !role) {
            throw new Error("Missing required fields for new user (email, password, full name, role).");
        }
        await userService.addUser({ email, passwordInput, full_name, role, role_name, parent_user_id }, currentUserProfile.org_id);
      } else if (editingUser?.id && editingUser?.auth_user_id) { 
        const { full_name, role, passwordInput, role_name, parent_user_id } = userData;
        const updatePayload: Partial<{ full_name: string; role: Role, role_name: string | null, parent_user_id: string | null }> = {};
        if (full_name) updatePayload.full_name = full_name;
        if (role) updatePayload.role = role;
        if (role_name !== undefined) updatePayload.role_name = role_name;
        if (parent_user_id !== undefined) updatePayload.parent_user_id = parent_user_id;
        
        await userService.updateUser(editingUser.id, updatePayload, editingUser.auth_user_id, passwordInput);
      } else {
        throw new Error("Invalid operation: No user context for saving, or auth_user_id missing for update.");
      }
      await fetchData({isInitialLoad: false}); 
      handleCloseModal(); 
    } catch (error) {
      console.error("Error saving user (UsersPage):", error);
      setIsDataLoading(false); // Stop loading on error
      throw error; // Re-throw to be caught in modal
    }
  };
  
  const handleDeleteUser = async (userToDelete: UserProfile) => {
    if (!userToDelete.id || !userToDelete.auth_user_id) {
        alert("User data is incomplete (missing ID or Auth User ID), cannot delete.");
        return;
    }
    if (currentUserProfile && userToDelete.id === currentUserProfile.id) {
      alert("You cannot delete yourself.");
      return;
    }
    if (window.confirm(`Are you sure you want to delete user ${userToDelete.full_name}? This will also un-assign any users that report to them.`)) {
        setIsDataLoading(true);
        try {
            await userService.deleteUser(userToDelete.id, userToDelete.auth_user_id);
            await fetchData({isInitialLoad: false}); 
        } catch (error) {
            console.error("Error deleting user:", error);
            alert(`Failed to delete user profile: ${(error as Error).message}. Auth user may still exist.`);
        } finally {
            setIsDataLoading(false); 
        }
    }
  };

  if (pageLoading) {
    return <div className="flex justify-center items-center h-screen"><Spinner size="lg" /></div>;
  }
  
  if (!hasRole(Role.ADMIN)) {
    return <p className="text-red-500 p-4 bg-red-50 rounded-md">You do not have permission to view this page.</p>;
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
        <h1 className="text-2xl font-semibold text-secondary-900">User Management</h1>
        <Button onClick={() => handleOpenModal()} leftIcon={<PlusIcon className="h-5 w-5" />} disabled={pageLoading || isDataLoading}>
        Add New User
        </Button>
      </div>

      <div className="bg-white shadow overflow-x-auto rounded-lg relative">
        {isDataLoading && (
            <div className="absolute inset-0 bg-white bg-opacity-75 flex justify-center items-center z-10">
                <Spinner />
            </div>
        )}
        <table className="min-w-full divide-y divide-secondary-200" aria-label="Users table">
          <thead className="bg-secondary-50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">Full Name</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">Email</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">System Role</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">Custom Role</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">Manager</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">Direct Reports</th>
              <th scope="col" className="relative px-6 py-3">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-secondary-200">
            {isDataLoading && users.length === 0 ? (
                <tr><td colSpan={7} className="px-6 py-12 text-center"><Spinner/></td></tr>
            ) : users.length === 0 ? (
                <tr><td colSpan={7} className="px-6 py-12 text-center text-sm text-secondary-500">No users found in your organization.</td></tr>
            ) : (
                users.map((user) => (
                <tr key={user.id} className="hover:bg-secondary-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-secondary-900">{user.full_name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-secondary-500">{user.email}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-secondary-500 capitalize">{user.role}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-secondary-500">{user.role_name || 'N/A'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-secondary-500">{user.manager_name || 'N/A'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-secondary-500">{user.manages_users_count || 0}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                    {hasRole(Role.ADMIN) && (
                        <>
                        <Button variant="outline" size="sm" onClick={() => handleOpenModal(user)} aria-label={`Edit ${user.full_name}`} disabled={isDataLoading}>
                            <EditIcon className="h-4 w-4" />
                        </Button>
                        {user.id !== currentUserProfile?.id && 
                            <Button variant="danger" size="sm" onClick={() => handleDeleteUser(user)} aria-label={`Delete ${user.full_name}`} disabled={isDataLoading}>
                                <DeleteIcon className="h-4 w-4" />
                            </Button>
                        }
                        </>
                    )}
                    </td>
                </tr>
                ))
            )}
          </tbody>
        </table>
      </div>
      
      {isModalOpen && (
        <UserModal
            isOpen={isModalOpen}
            onClose={handleCloseModal}
            userToEdit={editingUser}
            onSave={handleSaveUser}
            allUsers={users}
        />
      )}
    </div>
  );
};