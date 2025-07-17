import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Button } from '@/components/common/Button';
import { TicketModal } from '@/components/tickets/TicketModal'; 
import { Ticket, TicketStatus, Role, UserProfile, TicketPriority } from '@/types';
import { ticketService, userService } from '@/services/api';
import { PlusIcon, EditIcon, EyeIcon, DeleteIcon } from '@/components/common/Icons';
import { Spinner } from '@/components/common/Spinner';
import { useAuth } from '@/contexts/AuthContext';
import { Input } from '@/components/common/Input';
import { Select } from '@/components/common/Select';
import { TICKET_STATUS_OPTIONS, TICKET_PRIORITY_OPTIONS } from '@/constants';


export const SupportPage: React.FC = () => {
  const { profile: currentUserProfile, hasRole } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [pageLoading, setPageLoading] = useState(true);
  const [isDataLoading, setIsDataLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTicket, setEditingTicket] = useState<Ticket | null>(null);
  const [viewMode, setViewMode] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState<{ status: string; priority: string; assignedTo: string }>({
    status: '', priority: '', assignedTo: ''
  });


  const fetchData = useCallback(async (options?: {isInitialLoad?: boolean}) => {
    const {isInitialLoad = false} = options || {};
    if (!currentUserProfile?.org_id || !currentUserProfile.id || !currentUserProfile.role) {
      if(isInitialLoad) setPageLoading(false);
      setIsDataLoading(false);
      setTickets([]);
      if(isInitialLoad) setUsers([]);
      return;
    }
    
    if (isInitialLoad) {
        setPageLoading(true);
    } else {
        setIsDataLoading(true);
    }
    try {
      const [fetchedTickets, fetchedUsers] = await Promise.all([
        ticketService.getTickets(currentUserProfile.org_id, currentUserProfile.id, currentUserProfile.role),
        userService.getUsers(currentUserProfile.org_id)
      ]);
      setTickets(fetchedTickets || []);
      setUsers(fetchedUsers || []);
    } catch (error) {
      console.error("Failed to fetch support tickets or users:", error);
      setTickets([]);
      if(isInitialLoad) setUsers([]);
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

  const refreshTicketsData = () => {
    fetchData({isInitialLoad: false});
  }

  const handleOpenModal = (ticket: Ticket | null = null, isViewMode = false) => {
    setEditingTicket(ticket);
    setViewMode(isViewMode);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingTicket(null);
    setViewMode(false);
  };

  const handleSaveTicket = async (
    ticketData: Omit<Ticket, 'id' | 'ticket_uid' | 'created_at' | 'updated_at' | 'org_id' | 'created_by_user_id' | 'created_by_user_name' | 'assigned_to_user_name' | 'resolved_at' | 'closed_at'> | Ticket,
    isNew: boolean,
    originalTicket?: Ticket | null 
  ) => {
     if (!currentUserProfile?.org_id || !currentUserProfile.id) {
      alert("Cannot save ticket: Organization or User context is missing.");
      return;
    }
    setIsDataLoading(true);
    try {
      if (isNew) {
        await ticketService.addTicket(
            ticketData as Omit<Ticket, 'id' | 'ticket_uid' | 'created_at' | 'updated_at' | 'org_id' | 'created_by_user_id' | 'created_by_user_name' | 'assigned_to_user_name' | 'resolved_at' | 'closed_at'>,
            currentUserProfile.org_id,
            currentUserProfile.id
        );
      } else if (editingTicket?.id) {
        await ticketService.updateTicket(editingTicket.id, ticketData as Partial<Omit<Ticket, 'id' | 'ticket_uid' | 'created_at' | 'updated_at' | 'org_id' | 'created_by_user_id' | 'created_by_user_name' | 'assigned_to_user_name' | 'resolved_at' | 'closed_at'>>, editingTicket);
      }
      refreshTicketsData(); 
      handleCloseModal();
    } catch (error) {
      console.error("Error saving ticket:", error);
      alert(`Error saving ticket: ${(error as Error).message}`);
      throw error;
    } finally {
        setIsDataLoading(false);
    }
  };

  const handleDeleteTicket = async (ticketId: string) => {
    if (window.confirm('Are you sure you want to delete this ticket?')) {
      setIsDataLoading(true);
      try {
        await ticketService.deleteTicket(ticketId);
        refreshTicketsData();
      } catch (error) {
        console.error("Failed to delete ticket:", error);
        alert(`Error deleting ticket: ${(error as Error).message}`);
      } finally {
        setIsDataLoading(false);
      }
    }
  };
  
  const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFilters({ ...filters, [e.target.name]: e.target.value });
  };

  const filteredTickets = useMemo(() => {
    return tickets.filter(ticket => {
      const searchTermLower = searchTerm.toLowerCase();
      const searchMatch =
        ticket.subject.toLowerCase().includes(searchTermLower) ||
        ticket.ticket_uid.toLowerCase().includes(searchTermLower) ||
        (ticket.requester_info && ticket.requester_info.toLowerCase().includes(searchTermLower)) ||
        (ticket.assigned_to_user_name && ticket.assigned_to_user_name.toLowerCase().includes(searchTermLower));
        
      const statusMatch = filters.status ? ticket.status === filters.status : true;
      const priorityMatch = filters.priority ? ticket.priority === filters.priority : true;
      const assigneeMatch = filters.assignedTo ? ticket.assigned_to_user_id === filters.assignedTo : true;
      
      return searchMatch && statusMatch && priorityMatch && assigneeMatch;
    });
  }, [tickets, searchTerm, filters]);


  const statusOptionsForFilter = [{ value: '', label: 'All Statuses' }, ...TICKET_STATUS_OPTIONS.map(s => ({ value: s, label: s }))];
  const priorityOptionsForFilter = [{ value: '', label: 'All Priorities' }, ...TICKET_PRIORITY_OPTIONS.map(p => ({ value: p, label: p }))];
  const userOptionsForFilter = [{value: '', label: 'All Users'}, ...users.map(u => ({value: u.id, label: u.full_name}))];

  const getStatusColor = (status: TicketStatus) => {
    switch (status) {
      case TicketStatus.RESOLVED:
      case TicketStatus.CLOSED: return 'bg-green-100 text-green-800';
      case TicketStatus.IN_PROGRESS: return 'bg-blue-100 text-blue-800';
      case TicketStatus.ON_HOLD: return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-indigo-100 text-indigo-800'; // Open
    }
  };

  const getPriorityColor = (priority: TicketPriority) => {
      switch (priority) {
          case TicketPriority.URGENT: return 'text-red-600 font-semibold';
          case TicketPriority.HIGH: return 'text-orange-600 font-semibold';
          case TicketPriority.MEDIUM: return 'text-yellow-600';
          default: return 'text-secondary-600';
      }
  }


  if (pageLoading) {
    return <div className="flex justify-center items-center h-screen"><Spinner size="lg" /></div>;
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
        <h1 className="text-3xl font-bold text-secondary-900">Support Tickets</h1>
        <Button onClick={() => handleOpenModal()} leftIcon={<PlusIcon className="h-5 w-5" />} disabled={isDataLoading}>
          Create New Ticket
        </Button>
      </div>
      
       <div className="mb-6 p-4 bg-white shadow rounded-lg">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Input 
                placeholder="Search tickets..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="lg:col-span-1"
                aria-label="Search tickets"
            />
             <Select
                label="Filter by Status"
                id="ticket-status-filter"
                name="status"
                value={filters.status}
                onChange={handleFilterChange}
                options={statusOptionsForFilter}
                wrapperClassName="lg:col-span-1"
            />
            <Select
                label="Filter by Priority"
                id="ticket-priority-filter"
                name="priority"
                value={filters.priority}
                onChange={handleFilterChange}
                options={priorityOptionsForFilter}
                wrapperClassName="lg:col-span-1"
            />
            <Select
                label="Filter by Assignee"
                id="ticket-assignee-filter"
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
        {isDataLoading && tickets.length > 0 && (
            <div className="absolute inset-0 bg-white bg-opacity-75 flex justify-center items-center z-10">
                <Spinner />
            </div>
        )}
        <table className="min-w-full divide-y divide-secondary-200" aria-label="Support Tickets Table">
          <thead className="bg-secondary-50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">Ticket ID</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">Subject</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">Status</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">Priority</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">Assigned To</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">Created By</th>
               <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">Last Updated</th>
              <th scope="col" className="relative px-6 py-3"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-secondary-200">
            {isDataLoading && tickets.length === 0 ? (
                 <tr><td colSpan={8} className="px-6 py-12 text-center"><Spinner /></td></tr>
            ) : filteredTickets.length === 0 ? (
              <tr><td colSpan={8} className="px-6 py-12 text-center text-sm text-secondary-500">No tickets found.</td></tr>
            ) : (
              filteredTickets.map((ticket) => (
                <tr key={ticket.id} className="hover:bg-secondary-50">
                   <td className="px-6 py-4 whitespace-nowrap text-sm text-secondary-500 font-mono">{ticket.ticket_uid}</td>
                  <td className="px-6 py-4 whitespace-normal text-sm font-medium text-secondary-900 max-w-sm break-words">{ticket.subject}</td>
                   <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(ticket.status)}`}>
                      {ticket.status}
                    </span>
                  </td>
                  <td className={`px-6 py-4 whitespace-nowrap text-sm ${getPriorityColor(ticket.priority)}`}>{ticket.priority}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-secondary-500">{ticket.assigned_to_user_name || 'Unassigned'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-secondary-500">{ticket.created_by_user_name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-secondary-500">{new Date(ticket.updated_at).toLocaleDateString()}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                    <Button variant="outline" size="sm" onClick={() => handleOpenModal(ticket, true)} aria-label={`View ${ticket.subject}`}><EyeIcon className="h-4 w-4" /></Button>
                     {(hasRole(Role.ADMIN) || currentUserProfile?.id === ticket.created_by_user_id || currentUserProfile?.id === ticket.assigned_to_user_id) && (
                      <Button variant="outline" size="sm" onClick={() => handleOpenModal(ticket)} aria-label={`Edit ${ticket.subject}`}><EditIcon className="h-4 w-4" /></Button>
                    )}
                    {hasRole(Role.ADMIN) && (
                      <Button variant="danger" size="sm" onClick={() => handleDeleteTicket(ticket.id)} aria-label={`Delete ${ticket.subject}`}><DeleteIcon className="h-4 w-4" /></Button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

       {isModalOpen && currentUserProfile && (
        <TicketModal
            isOpen={isModalOpen}
            onClose={handleCloseModal}
            ticketToEdit={editingTicket}
            onSave={handleSaveTicket}
            viewModeInitial={viewMode}
            allUsers={users}
        />
      )}
    </div>
  );
};