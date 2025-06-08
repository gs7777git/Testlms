
import React, { useState, useEffect, useCallback } from 'react';
import { Modal } from '@/components/common/Modal';
import { Button } from '@/components/common/Button';
import { Input, Textarea } from '@/components/common/Input';
import { Select } from '@/components/common/Select';
import { Spinner } from '@/components/common/Spinner';
import { Task, TaskStatus, TaskPriority, TaskComment, UserProfile, Role, Company, Contact, Lead } from '@/types';
import { TASK_STATUS_OPTIONS, TASK_PRIORITY_OPTIONS } from '@/constants';
import { taskService } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { PlusIcon } from '@/components/common/Icons';

interface TaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  taskToEdit?: Task | null;
  onSave: (task: Omit<Task, 'id' | 'created_at' | 'updated_at' | 'org_id' | 'created_by_user_id' | 'created_by_user_name' | 'assigned_to_user_name' | 'comments' | 'related_lead_name' | 'related_company_name' | 'related_contact_name'> | Task) => Promise<void>;
  viewModeInitial?: boolean;
  allUsers: UserProfile[];
  allCompanies: Company[];
  allContacts: Contact[];
  allLeads: Lead[];
}

const initialTaskState: Omit<Task, 'id' | 'created_at' | 'updated_at' | 'org_id' | 'created_by_user_id' | 'created_by_user_name' | 'assigned_to_user_name' | 'comments' | 'related_lead_name' | 'related_company_name' | 'related_contact_name'> = {
  title: '', description: '', status: TaskStatus.TO_DO, priority: TaskPriority.MEDIUM, assigned_to_user_id: '', due_date: null,
  related_lead_id: null, related_company_id: null, related_contact_id: null,
};

type ActiveTaskModalTab = 'details' | 'comments';

export const TaskModal: React.FC<TaskModalProps> = ({
  isOpen, onClose, taskToEdit, onSave, viewModeInitial = false, allUsers, allCompanies, allContacts, allLeads
}) => {
  const [taskData, setTaskData] = useState(initialTaskState);
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [newComment, setNewComment] = useState('');
  
  const [isLoading, setIsLoading] = useState(false);
  const [isCommentsLoading, setIsCommentsLoading] = useState(false);
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState<ActiveTaskModalTab>('details');
  const [isEditing, setIsEditing] = useState(!viewModeInitial);

  const { profile: currentUserProfile, hasRole } = useAuth();

  const resetForm = useCallback(() => {
    setTaskData(initialTaskState);
    setComments([]);
    setNewComment('');
    setErrors({});
    setActiveTab('details');
    setIsEditing(!viewModeInitial || !taskToEdit);
  }, [viewModeInitial, taskToEdit]);
  
  const fetchComments = useCallback(async (taskId: string) => {
    if (!currentUserProfile?.org_id) return;
    setIsCommentsLoading(true);
    try {
      const fetchedComments = await taskService.getTaskComments(taskId, currentUserProfile.org_id);
      setComments(fetchedComments);
    } catch (err) {
      console.error("Failed to fetch comments:", err);
      setErrors(prev => ({...prev, comments: "Could not load comments."}));
    } finally {
      setIsCommentsLoading(false);
    }
  }, [currentUserProfile?.org_id]);

  useEffect(() => {
    if (isOpen) {
      if (taskToEdit) {
        setTaskData({
          title: taskToEdit.title,
          description: taskToEdit.description || '',
          status: taskToEdit.status,
          priority: taskToEdit.priority,
          assigned_to_user_id: taskToEdit.assigned_to_user_id,
          due_date: taskToEdit.due_date ? new Date(taskToEdit.due_date).toISOString().split('T')[0] : null,
          related_lead_id: taskToEdit.related_lead_id || null,
          related_company_id: taskToEdit.related_company_id || null,
          related_contact_id: taskToEdit.related_contact_id || null,
        });
        setIsEditing(!viewModeInitial); // Set editing based on viewModeInitial when taskToEdit exists
        if (activeTab === 'comments') fetchComments(taskToEdit.id);
      } else {
         setTaskData(prev => ({...initialTaskState, assigned_to_user_id: currentUserProfile?.id || ''}));
         setIsEditing(true); // Always editing for new tasks
      }
    } else {
      resetForm();
    }
  }, [taskToEdit, isOpen, viewModeInitial, resetForm, activeTab, fetchComments, currentUserProfile?.id]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    let processedValue: string | null = value;
    if ((name === 'due_date' || name === 'related_lead_id' || name === 'related_company_id' || name === 'related_contact_id') && value === '') {
        processedValue = null;
    }
    setTaskData(prev => ({ ...prev, [name]: processedValue }));
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }));
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!taskData.title.trim()) newErrors.title = 'Title is required.';
    if (!taskData.assigned_to_user_id) newErrors.assigned_to_user_id = 'Assigned to user is required.';
    if (!taskData.status) newErrors.status = 'Status is required.';
    if (!taskData.priority) newErrors.priority = 'Priority is required.';
    if (taskData.due_date && isNaN(new Date(taskData.due_date).getTime())) newErrors.due_date = 'Invalid due date format.';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate() || !isEditing) return;

    setIsLoading(true);
    try {
      const finalTaskData: any = { ...taskData };
      if (taskToEdit?.id) finalTaskData.id = taskToEdit.id;
      await onSave(finalTaskData);
      // Parent (TasksPage) will handle closing modal on success and data refresh
    } catch (error) {
      console.error("Error saving task (in modal):", error);
      setErrors(prev => ({ ...prev, form: 'Failed to save task. Please try again.' }));
      setIsLoading(false); // Ensure loading is stopped on error
    } 
    // setIsLoading(false) will be handled by parent or successful save.
  };
  
  const handleAddComment = async () => {
    if (!taskToEdit || !newComment.trim() || !currentUserProfile) return;
    setIsSubmittingComment(true);
    try {
        await taskService.addTaskComment({
            task_id: taskToEdit.id,
            comment: newComment,
            // user_id will be set by the service based on current user
        }, currentUserProfile.org_id, currentUserProfile.id);
        setNewComment('');
        fetchComments(taskToEdit.id);
    } catch (error) {
        console.error("Failed to add comment:", error);
        setErrors(prev => ({...prev, commentForm: "Could not add comment."}));
    } finally {
        setIsSubmittingComment(false);
    }
  };

  const userOptions = allUsers.map(u => ({ value: u.id, label: u.full_name }));
  const statusOptions = TASK_STATUS_OPTIONS.map(s => ({ value: s, label: s }));
  const priorityOptions = TASK_PRIORITY_OPTIONS.map(p => ({ value: p, label: p }));
  const leadOptions = [{value: '', label: 'None'}, ...allLeads.map(l => ({value: l.id, label: l.name}))];
  const companyOptions = [{value: '', label: 'None'}, ...allCompanies.map(c => ({value: c.id, label: c.name}))];
  const contactOptions = [{value: '', label: 'None'}, ...allContacts.map(c => ({value: c.id, label: `${c.first_name} ${c.last_name} (${c.company_name || 'N/A'})`}))];

  const modalTitle = taskToEdit ? (isEditing ? `Edit Task: ${taskData.title || taskToEdit.title}` : `Task: ${taskToEdit.title}`) : 'Add New Task';
  const canEditTask = isEditing || hasRole(Role.ADMIN) || currentUserProfile?.id === taskToEdit?.created_by_user_id || currentUserProfile?.id === taskToEdit?.assigned_to_user_id;

  const TABS: { name: ActiveTaskModalTab; label: string }[] = [
    { name: 'details', label: 'Details' },
    { name: 'comments', label: 'Comments' },
  ];

  const renderDetailsTab = () => (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input label="Title" id="title" name="title" value={taskData.title} onChange={handleChange} error={errors.title} required disabled={isLoading || !isEditing} />
      <Textarea label="Description" id="description" name="description" value={taskData.description || ''} onChange={handleChange} rows={3} disabled={isLoading || !isEditing} />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Select label="Assigned To" id="assigned_to_user_id" name="assigned_to_user_id" value={taskData.assigned_to_user_id} onChange={handleChange} options={userOptions} error={errors.assigned_to_user_id} required disabled={isLoading || !isEditing || userOptions.length === 0} placeholder="-- Select User --"/>
        <Input label="Due Date" id="due_date" name="due_date" type="date" value={taskData.due_date || ''} onChange={handleChange} error={errors.due_date} disabled={isLoading || !isEditing} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Select label="Status" id="status" name="status" value={taskData.status} onChange={handleChange} options={statusOptions} error={errors.status} required disabled={isLoading || !isEditing} />
        <Select label="Priority" id="priority" name="priority" value={taskData.priority} onChange={handleChange} options={priorityOptions} error={errors.priority} required disabled={isLoading || !isEditing} />
      </div>
       <h4 className="text-md font-semibold text-secondary-700 pt-2">Related To (Optional)</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Select label="Lead" id="related_lead_id" name="related_lead_id" value={taskData.related_lead_id || ''} onChange={handleChange} options={leadOptions} disabled={isLoading || !isEditing} placeholder="None"/>
            <Select label="Company" id="related_company_id" name="related_company_id" value={taskData.related_company_id || ''} onChange={handleChange} options={companyOptions} disabled={isLoading || !isEditing} placeholder="None"/>
            <Select label="Contact" id="related_contact_id" name="related_contact_id" value={taskData.related_contact_id || ''} onChange={handleChange} options={contactOptions} disabled={isLoading || !isEditing} placeholder="None"/>
        </div>

      {errors.form && <p className="mt-2 text-sm text-red-600">{errors.form}</p>}
      <div className="pt-5 flex justify-end space-x-3">
        {viewModeInitial && taskToEdit && canEditTask && !isEditing && (
            <Button type="button" variant="secondary" onClick={() => setIsEditing(true)}>Edit Task</Button>
        )}
        <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>Cancel</Button>
        {isEditing && <Button type="submit" isLoading={isLoading} disabled={isLoading}>{taskToEdit ? 'Save Changes' : 'Create Task'}</Button>}
      </div>
    </form>
  );
  
  const renderCommentsTab = () => (
    <div>
      <h4 className="text-md font-semibold text-secondary-700 mb-3">Add New Comment</h4>
      <div className="space-y-3 mb-6 p-3 border rounded-md bg-secondary-50">
        <Textarea label="Comment" id="newComment" name="newComment" value={newComment} onChange={(e) => setNewComment(e.target.value)} rows={2} disabled={isSubmittingComment} required />
        {errors.commentForm && <p className="text-sm text-red-600">{errors.commentForm}</p>}
        <Button onClick={handleAddComment} isLoading={isSubmittingComment} disabled={isSubmittingComment || !newComment.trim()} size="sm" leftIcon={<PlusIcon className="h-4 w-4"/>}>Add Comment</Button>
      </div>

      <h4 className="text-md font-semibold text-secondary-700 mb-2">Comment History</h4>
      {isCommentsLoading ? <Spinner /> : (
        comments.length > 0 ? (
          <ul className="space-y-3 max-h-60 overflow-y-auto p-1">
            {comments.map(comment => (
              <li key={comment.id} className="p-3 border rounded-md bg-white shadow-sm">
                <p className="text-sm font-medium text-secondary-800">{comment.user_full_name || 'User'}</p>
                <p className="text-xs text-secondary-500">{new Date(comment.created_at).toLocaleString()}</p>
                <p className="mt-1 text-sm text-secondary-700 whitespace-pre-wrap">{comment.comment}</p>
              </li>
            ))}
          </ul>
        ) : <p className="text-sm text-secondary-500">No comments yet.</p>
      )}
      {errors.comments && <p className="mt-2 text-sm text-red-600">{errors.comments}</p>}
    </div>
  );


  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={modalTitle} size="xl">
      {taskToEdit && (
        <div className="border-b border-secondary-200 mb-4">
          <nav className="-mb-px flex space-x-4 sm:space-x-6 overflow-x-auto" aria-label="Tabs">
            {TABS.map((tabInfo) => (
              <button
                key={tabInfo.name}
                onClick={() => {
                    setActiveTab(tabInfo.name);
                    if (taskToEdit && tabInfo.name === 'comments') fetchComments(taskToEdit.id);
                }}
                className={`${
                  activeTab === tabInfo.name
                    ? 'border-primary-500 text-primary-600'
                    : 'border-transparent text-secondary-500 hover:text-secondary-700 hover:border-secondary-300'
                } whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm capitalize focus:outline-none`}
                aria-current={activeTab === tabInfo.name ? 'page' : undefined}
              >
                {tabInfo.label}
              </button>
            ))}
          </nav>
        </div>
      )}

      {activeTab === 'details' && renderDetailsTab()}
      {activeTab === 'comments' && taskToEdit && renderCommentsTab()}
    </Modal>
  );
};
