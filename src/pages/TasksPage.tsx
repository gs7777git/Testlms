import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Button } from '@/components/common/Button';
import { TaskModal } from '@/components/tasks/TaskModal';
import { Task, TaskStatus, Role, UserProfile, TaskPriority, Company, Contact, Lead } from '@/types';
import { taskService, userService, companyService, contactService, leadService } from '@/services/api';
import { PlusIcon, EditIcon, EyeIcon, DeleteIcon } from '@/components/common/Icons';
import { Spinner } from '@/components/common/Spinner';
import { useAuth } from '@/contexts/AuthContext';
import { Input } from '@/components/common/Input';
import { Select } from '@/components/common/Select';
import { TASK_STATUS_OPTIONS, TASK_PRIORITY_OPTIONS } from '@/constants';

export const TasksPage: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);

  const [pageLoading, setPageLoading] = useState(true);
  const [isDataLoading, setIsDataLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [isViewMode, setIsViewMode] = useState(false); 

  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState<{ status: string; priority: string; assignedTo: string }>({
    status: '', priority: '', assignedTo: ''
  });

  const { profile: currentUserProfile, hasRole } = useAuth();

  const fetchData = useCallback(async (options?: {isInitialLoad?: boolean}) => {
    const {isInitialLoad = false} = options || {};
    if (!currentUserProfile?.org_id || !currentUserProfile.id || !currentUserProfile.role) {
      if(isInitialLoad) setPageLoading(false);
      setIsDataLoading(false);
      setTasks([]); 
      if(isInitialLoad) {setUsers([]); setCompanies([]); setContacts([]); setLeads([]);}
      return;
    }
    
    if (isInitialLoad) {
        setPageLoading(true);
    } else {
        setIsDataLoading(true);
    }

    try {
      const fetchedUsers = await userService.getUsers(currentUserProfile.org_id); 
      setUsers(fetchedUsers || []); 

      const taskPromise = taskService.getTasks(currentUserProfile.org_id, currentUserProfile.id, currentUserProfile.role, fetchedUsers || []);
      
      let fetchedCompanies: Company[] = companies;
      let fetchedContacts: Contact[] = contacts;
      let fetchedLeads: Lead[] = leads;

      if (isInitialLoad) {
        const [companiesRes, contactsRes, leadsRes] = await Promise.all([
            companyService.getCompanies(currentUserProfile.org_id),
            contactService.getContacts(currentUserProfile.org_id),
            leadService.getLeads(currentUserProfile.org_id)
        ]);
        fetchedCompanies = companiesRes || [];
        fetchedContacts = contactsRes || [];
        fetchedLeads = leadsRes || [];
        setCompanies(fetchedCompanies);
        setContacts(fetchedContacts);
        setLeads(fetchedLeads);
      }
      
      const fetchedTasks = await taskPromise;
      setTasks(fetchedTasks || []);

    } catch (error) {
      console.error("Failed to fetch tasks or related data:", error);
      setTasks([]); 
      if(isInitialLoad) {
         setUsers([]); setCompanies([]); setContacts([]); setLeads([]);
      }
      alert(`Error fetching data: ${(error as Error).message}`);
    } finally {
      if(isInitialLoad) {
        setPageLoading(false);
      }
      setIsDataLoading(false);
    }
  }, [currentUserProfile]);

  useEffect(() => {
    if (currentUserProfile) {
        fetchData({isInitialLoad: true});
    } else if (!currentUserProfile) {
        setPageLoading(false);
        setIsDataLoading(false);
    }
  }, [currentUserProfile, fetchData]);


  const refreshTasksData = () => {
    fetchData({isInitialLoad: false});
  }

  const handleOpenModal = (task: Task | null = null, viewMode = false) => {
    setEditingTask(task);
    setIsViewMode(viewMode);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingTask(null);
    setIsViewMode(false);
  };

  const handleSaveTask = async (
    taskData: Omit<Task, 'id' | 'created_at' | 'updated_at' | 'org_id' | 'created_by_user_id' | 'created_by_user_name' | 'assigned_to_user_name' | 'comments' | 'related_lead_name' | 'related_company_name' | 'related_contact_name'> | Task,
    isNew: boolean
  ) => {
    if (!currentUserProfile?.org_id || !currentUserProfile.id) {
      alert("Cannot save task: Organization or User context is missing.");
      return;
    }
    setIsDataLoading(true);
    try {
      if (isNew) {
        await taskService.addTask(
            taskData as Omit<Task, 'id' | 'created_at' | 'updated_at' | 'org_id' | 'created_by_user_id' | 'created_by_user_name' | 'assigned_to_user_name' | 'comments'| 'related_lead_name' | 'related_company_name' | 'related_contact_name'>,
            currentUserProfile.org_id,
            currentUserProfile.id
        );
      } else if (editingTask?.id) {
        await taskService.updateTask(editingTask.id, taskData as Partial<Omit<Task, 'id' | 'created_at' | 'updated_at' | 'org_id' | 'created_by_user_id' | 'created_by_user_name' | 'assigned_to_user_name' | 'comments'| 'related_lead_name' | 'related_company_name' | 'related_contact_name'>>);
      }
      refreshTasksData(); 
      handleCloseModal();
    } catch (error) {
      console.error("Error saving task:", error);
      alert(`Error saving task: ${(error as Error).message}`);
      throw error;
    } finally {
        setIsDataLoading(false);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (window.confirm('Are you sure you want to delete this task?')) {
      setIsDataLoading(true);
      try {
        await taskService.deleteTask(taskId);
        refreshTasksData();
      } catch (error) {
        console.error("Failed to delete task:", error);
        alert(`Error deleting task: ${(error as Error).message}`);
      } finally {
        setIsDataLoading(false);
      }
    }
  };
  
  const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFilters({ ...filters, [e.target.name]: e.target.value });
  };

  const filteredTasks = useMemo(() => {
    return tasks.filter(task => {
      const searchTermLower = searchTerm.toLowerCase();
      const searchMatch =
        task.title.toLowerCase().includes(searchTermLower) ||
        (task.description && task.description.toLowerCase().includes(searchTermLower)) ||
        (task.assigned_to_user_name && task.assigned_to_user_name.toLowerCase().includes(searchTermLower)) ||
        (task.related_lead_name && task.related_lead_name.toLowerCase().includes(searchTermLower)) ||
        (task.related_company_name && task.related_company_name.toLowerCase().includes(searchTermLower)) ||
        (task.related_contact_name && task.related_contact_name.toLowerCase().includes(searchTermLower));

      const statusMatch = filters.status ? task.status === filters.status : true;
      const priorityMatch = filters.priority ? task.priority === filters.priority : true;
      const assigneeMatch = filters.assignedTo ? task.assigned_to_user_id === filters.assignedTo : true;
      
      return searchMatch && statusMatch && priorityMatch && assigneeMatch;
    });
  }, [tasks, searchTerm, filters]);

  const statusOptionsForFilter = [{ value: '', label: 'All Statuses' }, ...TASK_STATUS_OPTIONS.map(s => ({ value: s, label: s }))];
  const priorityOptionsForFilter = [{ value: '', label: 'All Priorities' }, ...TASK_PRIORITY_OPTIONS.map(p => ({ value: p, label: p }))];
  const userOptionsForFilter = [{value: '', label: 'All Users'}, ...users.map(u => ({value: u.id, label: u.full_name}))];

  const getStatusColor = (status: TaskStatus) => {
    switch (status) {
      case TaskStatus.DONE: return 'bg-green-100 text-green-800';
      case TaskStatus.IN_PROGRESS: return 'bg-blue-100 text-blue-800';
      case TaskStatus.BLOCKED: return 'bg-red-100 text-red-800';
      case TaskStatus.CANCELLED: return 'bg-secondary-100 text-secondary-700 line-through';
      default: return 'bg-yellow-100 text-yellow-800'; // To Do
    }
  };
  
  const getPriorityBadge = (priority: TaskPriority) => {
    let color = '';
    switch(priority) {
        case TaskPriority.URGENT: color = 'bg-red-500'; break;
        case TaskPriority.HIGH: color = 'bg-orange-500'; break;
        case TaskPriority.MEDIUM: color = 'bg-yellow-500'; break;
        case TaskPriority.LOW: color = 'bg-green-500'; break;
        default: color = 'bg-secondary-500';
    }
    return <span className={`inline-block h-3 w-3 rounded-full mr-1.5 ${color}`} title={`Priority: ${priority}`}></span>;
  };


  if (pageLoading) {
    return <div className="flex justify-center items-center h-screen"><Spinner size="lg" /></div>;
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
        <h1 className="text-3xl font-bold text-secondary-900">Task Management</h1>
        <Button onClick={() => handleOpenModal()} leftIcon={<PlusIcon className="h-5 w-5" />} disabled={isDataLoading}>
          Create New Task
        </Button>
      </div>

      <div className="mb-6 p-4 bg-white shadow rounded-lg">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Input 
                placeholder="Search tasks..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="lg:col-span-1"
                aria-label="Search tasks"
            />
             <Select
                label="Filter by Status"
                id="task-status-filter"
                name="status"
                value={filters.status}
                onChange={handleFilterChange}
                options={statusOptionsForFilter}
                wrapperClassName="lg:col-span-1"
            />
            <Select
                label="Filter by Priority"
                id="task-priority-filter"
                name="priority"
                value={filters.priority}
                onChange={handleFilterChange}
                options={priorityOptionsForFilter}
                wrapperClassName="lg:col-span-1"
            />
            <Select
                label="Filter by Assignee"
                id="task-assignee-filter"
                name="assignedTo"
                value={filters.assignedTo}
                onChange={handleFilterChange}
                options={userOptionsForFilter}
                wrapperClassName="lg:col-span-1"
                disabled={users.length === 0}
            />
        </div>
      </div>
      
      <div className="bg-white shadow overflow-x-auto rounded-lg relative">
        {isDataLoading && tasks.length > 0 && (
            <div className="absolute inset-0 bg-white bg-opacity-75 flex justify-center items-center z-10">
                <Spinner />
            </div>
        )}
        <table className="min-w-full divide-y divide-secondary-200" aria-label="Tasks Table">
          <thead className="bg-secondary-50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">Title</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">Assigned To</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">Status</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">Priority</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">Due Date</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">Related To</th>
              <th scope="col" className="relative px-6 py-3"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-secondary-200">
            {isDataLoading && tasks.length === 0 ? (
                 <tr><td colSpan={7} className="px-6 py-12 text-center"><Spinner /></td></tr>
            ) : filteredTasks.length === 0 ? (
              <tr><td colSpan={7} className="px-6 py-12 text-center text-sm text-secondary-500">No tasks found.</td></tr>
            ) : (
              filteredTasks.map((task) => (
                <tr key={task.id} className="hover:bg-secondary-50">
                  <td className="px-6 py-4 whitespace-normal text-sm font-medium text-secondary-900 max-w-xs break-words">{task.title}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-secondary-500">{task.assigned_to_user_name}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(task.status)}`}>
                      {task.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-secondary-500 flex items-center">
                    {getPriorityBadge(task.priority)} {task.priority}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-secondary-500">{task.due_date ? new Date(task.due_date).toLocaleDateString() : 'N/A'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-secondary-500">
                    {task.related_lead_name || task.related_company_name || task.related_contact_name || 'N/A'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                    <Button variant="outline" size="sm" onClick={() => handleOpenModal(task, true)} aria-label={`View ${task.title}`}><EyeIcon className="h-4 w-4" /></Button>
                    {(hasRole(Role.ADMIN) || currentUserProfile?.id === task.created_by_user_id || currentUserProfile?.id === task.assigned_to_user_id) && (
                      <Button variant="outline" size="sm" onClick={() => handleOpenModal(task)} aria-label={`Edit ${task.title}`}><EditIcon className="h-4 w-4" /></Button>
                    )}
                    {hasRole(Role.ADMIN) && (
                      <Button variant="danger" size="sm" onClick={() => handleDeleteTask(task.id)} aria-label={`Delete ${task.title}`}><DeleteIcon className="h-4 w-4" /></Button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {isModalOpen && currentUserProfile && (
        <TaskModal
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          taskToEdit={editingTask}
          onSave={handleSaveTask}
          viewModeInitial={isViewMode}
          allUsers={users}
          allCompanies={companies}
          allContacts={contacts}
          allLeads={leads}
        />
      )}
    </div>
  );
};