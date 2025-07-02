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
        fetchData({ isInitialLoad: true });
    } else if (!currentUserProfile && !pageLoading){
        setPageLoading(false); 
        setIsDataLoading(false);
        setUsers([]);
    }
  }, [currentUserProfile?.org_id, fetchData, pageLoading]);

  const refreshUsersData = () => {
    fetchData({ isInitialLoad: false });
  };

  const handleOpenModal = (user: UserProfile | null = null) => {
    setEditingUser(user);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingUser(null);
  };

  const handleSaveUser = async (
    userData: Partial<UserProfile> & { passwordInput?: string; confirmPassword?: string; role_name?: string | null; parent_user_id?: string | null },
    isNew: boolean
  ) => {
    if (!currentUserProfile?.org_id) {
        throw new Error("Cannot save user: current user organization ID is missing.");
    }
    setIsDataLoading(true);
    try {
      if (isNew) {
        const { email, passwordInput, full_name, role, role_name, parent_user_id } = userData;
        if (!email || !passwordInput || !full_name || !role) {
            throw new Error("Missing required fields for new user (email, password, full name, role).");
        }
        await userService.addUser({ 
            email, 
            passwordInput, 
            full_name, 
            role, 
            role_name: role_name || null, 
            parent_user_id: parent_user_id || null 
        }, currentUserProfile.org_id);
      } else if (editingUser?.id && editingUser?.auth_user_id) { 
        const { full_name, role, role_name, parent_user_id, passwordInput } = userData;
        const updatePayload: Partial<{ full_name: string; role: Role; role_name: string | null; parent_user_id: string | null }> = {};
        
        if (full_name !== undefined && full_name !== editingUser.full_name) updatePayload.full_name = full_name;
        if (role !== undefined && role !== editingUser.role) updatePayload.role = role;
        if (userData.hasOwnProperty('role_name') && role_name !== editingUser.role_name) updatePayload.role_name = role_name || null;
        if (userData.hasOwnProperty('parent_user_id') && parent_user_id !== editingUser.parent_user_id) updatePayload.parent_user_id = parent_user_id || null;
        
        if (Object.keys(updatePayload).length > 0 || passwordInput) {
            await userService.updateUser(editingUser.id, updatePayload, editingUser.auth_user_id, passwordInput);
        } else {
            console.info("No changes detected in user profile.");
        }

      } else {
        throw new Error("Invalid operation: No user context for saving, or auth_user_id missing for update.");
      }
      refreshUsersData(); 
      handleCloseModal(); 
    } catch (error) {
      console.error("Error saving user (UsersPage):", error);
      setIsDataLoading(false); 
      throw error; 
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
    if (userToDelete.manages_users_count && userToDelete.manages_users_count > 0) { 
        alert(`This user manages ${userToDelete.manages_users_count} other user(s). Please reassign their direct reports before deleting this user.`);
        return;
    }

    if (window.confirm(`Are you sure you want to delete user ${userToDelete.full_name}? This action will delete their profile. Deleting their authentication record requires a backend function with admin privileges and is not handled client-side.`)) {
        setIsDataLoading(true);
        try {
            await userService.deleteUser(userToDelete.id, userToDelete.auth_user_id);
            refreshUsersData(); 
        } catch (error: any) {
            console.error("Error deleting user:", error);
            alert(`Failed to delete user profile: ${error.message}. Auth user may still exist.`);
        } finally {
            setIsDataLoading(false);
        }
    }
  };

  if (pageLoading) {
    return <div className="flex justify-center items-center h-screen"><Spinner size="lg" /></div>;
  }


  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
        <h1 className="text-2xl font-semibold text-secondary-900">User Management</h1>
        {hasRole(Role.ADMIN) && (
            <Button onClick={() => handleOpenModal()} leftIcon={<PlusIcon className="h-5 w-5" />} disabled={isDataLoading}>
            Add New User
            </Button>
        )}
      </div>

      <div className="bg-white shadow overflow-x-auto rounded-lg relative">
        {isDataLoading && users.length > 0 && (
            <div className="absolute inset-0 bg-white bg-opacity-75 flex justify-center items-center z-10">
                <Spinner />
            </div>
        )}
        <table className="min-w-full divide-y divide-secondary-200">
          <thead className="bg-secondary-50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">Full Name</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">Email</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">System Role</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">Custom Role Title</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">Reports To (Manager)</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">Manages Users</th>
              <th scope="col" className="relative px-6 py-3">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-secondary-200">
            {isDataLoading && users.length === 0 ? (
                 <tr><td colSpan={7} className="px-6 py-12 text-center"><Spinner /></td></tr>
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
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-secondary-500 text-center">{user.manages_users_count || 0}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                    {hasRole(Role.ADMIN) && (
                        <>
                        <Button variant="outline" size="sm" onClick={() => handleOpenModal(user)} aria-label={`Edit ${user.full_name}`}><EditIcon className="h-4 w-4" /></Button>
                        {user.id !== currentUserProfile?.id && 
                            <Button variant="danger" size="sm" onClick={() => handleDeleteUser(user)} aria-label={`Delete ${user.full_name}`}><DeleteIcon className="h-4 w-4" /></Button>
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