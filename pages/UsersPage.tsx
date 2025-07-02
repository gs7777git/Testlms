
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
  const [pageLoading, setPageLoading] = useState(false); 
  const [isDataLoading, setIsDataLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const { profile: currentUser, hasRole } = useAuth();

  const fetchUsers = useCallback(async () => {
    if (!currentUser?.org_id) {
        setIsDataLoading(false);
        setPageLoading(false);
        return;
    }
    setIsDataLoading(true);
    setPageLoading(true); 
    try {
      const fetchedUsers = await userService.getUsers(currentUser.org_id);
      setUsers(fetchedUsers || []);
    } catch (error) {
      console.error("Failed to fetch users:", error);
      setUsers([]);
      alert(`Failed to fetch users: ${(error as Error).message}`);
    } finally {
      setIsDataLoading(false);
      setPageLoading(false);
    }
  }, [currentUser?.org_id]);

  useEffect(() => {
    if (currentUser?.org_id) { 
        fetchUsers();
    } else if (!currentUser && isDataLoading === false) { 
        setPageLoading(false); 
    }
  }, [fetchUsers, currentUser, isDataLoading]);

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
    if (!currentUser?.org_id) {
        throw new Error("Cannot save user: current user organization ID is missing.");
    }
    try {
      if (isNew) {
        const { email, passwordInput, full_name, role } = userData;
        if (!email || !passwordInput || !full_name || !role) {
            throw new Error("Missing required fields for new user (email, password, full name, role).");
        }
        await userService.addUser({ email, passwordInput, full_name, role }, currentUser.org_id);
      } else if (editingUser?.id && editingUser?.auth_user_id) { 
        const { full_name, role, passwordInput } = userData;
        const updatePayload: Partial<{ full_name: string; role: Role }> = {};
        if (full_name) updatePayload.full_name = full_name;
        if (role) updatePayload.role = role;
        
        await userService.updateUser(editingUser.id, updatePayload, editingUser.auth_user_id, passwordInput);
      } else {
        throw new Error("Invalid operation: No user context for saving, or auth_user_id missing for update.");
      }
      await fetchUsers(); 
      handleCloseModal(); 
    } catch (error) {
      console.error("Error saving user (UsersPage):", error);
      throw error; 
    }
  };
  
  const handleDeleteUser = async (userToDelete: UserProfile) => {
    if (!userToDelete.id || !userToDelete.auth_user_id) {
        alert("User data is incomplete (missing ID or Auth User ID), cannot delete.");
        return;
    }
    if (currentUser && userToDelete.id === currentUser.id) {
      alert("You cannot delete yourself.");
      return;
    }
    if (window.confirm(`Are you sure you want to delete user ${userToDelete.full_name}? This action will delete their profile. Deleting their authentication record requires a backend function with admin privileges and is not handled client-side.`)) {
        setPageLoading(true);
        try {
            await userService.deleteUser(userToDelete.id, userToDelete.auth_user_id);
            await fetchUsers(); 
        } catch (error) {
            console.error("Error deleting user:", error);
            alert(`Failed to delete user profile: ${(error as Error).message}. Auth user may still exist.`);
            setPageLoading(false); 
        }
    }
  };

  if (isDataLoading && users.length === 0 && pageLoading) {
    return <div className="flex justify-center items-center h-64"><Spinner size="lg" /></div>;
  }


  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
        <h1 className="text-2xl font-semibold text-secondary-900">User Management</h1>
        {hasRole(Role.ADMIN) && (
            <Button onClick={() => handleOpenModal()} leftIcon={<PlusIcon className="h-5 w-5" />} disabled={pageLoading || isDataLoading}>
            Add New User
            </Button>
        )}
      </div>

      {pageLoading && <div className="my-4 flex justify-center"><Spinner /></div>}

      <div className="bg-white shadow overflow-x-auto rounded-lg">
        <table className="min-w-full divide-y divide-secondary-200">
          <thead className="bg-secondary-50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">Full Name</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">Email</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">Role</th>
              <th scope="col" className="relative px-6 py-3">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-secondary-200">
            {users.length === 0 && !isDataLoading && !pageLoading ? (
                <tr><td colSpan={4} className="px-6 py-12 text-center text-sm text-secondary-500">No users found in your organization.</td></tr>
            ) : (
                users.map((user) => (
                <tr key={user.id} className="hover:bg-secondary-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-secondary-900">{user.full_name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-secondary-500">{user.email}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-secondary-500 capitalize">{user.role}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                    {hasRole(Role.ADMIN) && (
                        <>
                        <Button variant="outline" size="sm" onClick={() => handleOpenModal(user)} aria-label={`Edit ${user.full_name}`} disabled={pageLoading || isDataLoading}>
                            <EditIcon className="h-4 w-4" />
                        </Button>
                        {user.id !== currentUser?.id && 
                            <Button variant="danger" size="sm" onClick={() => handleDeleteUser(user)} aria-label={`Delete ${user.full_name}`} disabled={pageLoading || isDataLoading}>
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
        />
      )}
    </div>
  );
};