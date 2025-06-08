
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

type ActiveSupportTab = 'all' | 'assigned' | 'reported';

export const SupportPage: React.FC = () => {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  
  const [pageLoading, setPageLoading] = useState(true);
  const [isDataLoading, setIsDataLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTicket, setEditingTicket] = useState<Ticket | null>(null);
  const [isViewMode, setIsViewMode] = useState(false); 

  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState<{ status: string; priority: string; assignee: string }>({
    status: '', priority: '', assignee: ''
  });
  const [activeTab, setActiveTab] = useState<ActiveSupportTab>('all');

  const { profile: currentUserProfile, hasRole } = useAuth();

  const fetchData = useCallback(async (options?: { isInitialLoad?: boolean }) => {
    const { isInitialLoad = false } = options || {};

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
      const promises: (Promise<Ticket[]> | Promise<UserProfile[]>)[] = [
        ticketService.getTickets(currentUserProfile.org_id, currentUserProfile.id, currentUserProfile.role),
      ];
      if (isInitialLoad) {
        promises.push(userService.getUsers(currentUserProfile.org_id));
      }
      
      const results = await Promise.all(promises);
      setTickets(results[0] as Ticket[] || []);
      if (isInitialLoad && results.length > 1 && results[1]) {
        setUsers(results[1] as UserProfile[] || []);
      }
    } catch (error) {
      console.error("Failed to fetch tickets or users:", error);
      setTickets([]);
      if(isInitialLoad) setUsers([]);
      alert(`Error fetching data: ${(error as Error).message}`);
    } finally {
      if(isInitialLoad) {
        setPageLoading(false);
      }
      setIsDataLoading(false);
    }
  }, [currentUserProfile]); // fetchData depends on currentUserProfile

  useEffect(() => {
    if (currentUserProfile) {
      if (!hasRole(Role.ADMIN) && activeTab === 'all') {
        setActiveTab('assigned'); // This will trigger another re-render and useEffect run
      } else { 
         fetchData({isInitialLoad: true}); 
      }
    } else {
      setPageLoading(false);
      setIsDataLoading(false);
      setTickets([]);
      setUsers([]);
    }
  }, [currentUserProfile, activeTab, hasRole, fetchData]);

  const refreshTicketsData = () => {
    fetchData({isInitialLoad: false});
  };

  const handleOpenModal = (ticket: Ticket | null = null, view: boolean = false) => {
    setEditingTicket(ticket);
    setIsViewMode(view);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingTicket(null);
    setIsViewMode(false);
    refreshTicketsData(); 
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

  const filteredAndTabbedTickets = useMemo(() => {
    let currentTickets = tickets;
    if (activeTab === 'assigned' && currentUserProfile) {
        currentTickets = tickets.filter(t => t.assigned_to_user_id === currentUserProfile.id);
    } else if (activeTab === 'reported' && currentUserProfile) {
        currentTickets = tickets.filter(t => t.created_by_user_id === currentUserProfile.id);
    }

    return currentTickets.filter(ticket => {
        const searchTermLower = searchTerm.toLowerCase();
        const searchMatch =
            ticket.subject.toLowerCase().includes(searchTermLower) ||
            ticket.ticket_uid.toLowerCase().includes(searchTermLower) ||
            (ticket.description && ticket.description.toLowerCase().includes(searchTermLower)) ||
            (ticket.assigned_to_user_name && ticket.assigned_to_user_name.toLowerCase().includes(searchTermLower)) ||
            (ticket.requester_info && ticket.requester_info.toLowerCase().includes(searchTermLower));

        const statusMatch = filters.status ? ticket.status === filters.status : true;
        const priorityMatch = filters.priority ? ticket.priority === filters.priority : true;
        const assigneeMatch = filters.assignee ? ticket.assigned_to_user_id === filters.assignee : true;
        
        return searchMatch && statusMatch && priorityMatch && assigneeMatch;
    });
  }, [tickets, searchTerm, filters, activeTab, currentUserProfile]);

  const TABS: { name: ActiveSupportTab; label: string }[] = [
    { name: 'all', label: 'All Tickets' },
    { name: 'assigned', label: 'My Assigned Tickets' },
    { name: 'reported', label: 'My Reported Tickets' },
  ];
  
  const statusOptions = [{value: '', label: 'All Statuses'}, ...TICKET_STATUS_OPTIONS.map(s => ({value: s, label: s}))];
  const priorityOptions = [{value: '', label: 'All Priorities'}, ...TICKET_PRIORITY_OPTIONS.map(p => ({value: p, label: p}))];
  const userOptionsForFilter = [{value: '', label: 'All Assignees'}, ...users.map(u => ({value: u.id, label: u.full_name}))];

  const getStatusColor = (status: TicketStatus) => {
    switch(status) {
      case TicketStatus.OPEN: return 'bg-blue-100 text-blue-800';
      case TicketStatus.IN_PROGRESS: return 'bg-yellow-100 text-yellow-800';
      case TicketStatus.ON_HOLD: return 'bg-orange-100 text-orange-800';
      case TicketStatus.RESOLVED: return 'bg-green-100 text-green-800';
      case TicketStatus.CLOSED: return 'bg-secondary-100 text-secondary-700 line-through';
      default: return 'bg-secondary-100 text-secondary-800';
    }
  };

  const getPriorityAriaLabel = (priority: TicketPriority) => {
    let colorClass = '';
    switch(priority) {
        case TicketPriority.URGENT: colorClass = 'text-red-500'; break;
        case TicketPriority.HIGH: colorClass = 'text-orange-500'; break;
        case TicketPriority.MEDIUM: colorClass = 'text-yellow-500'; break;
        case TicketPriority.LOW: colorClass = 'text-green-500'; break;
    }
    return <span className={colorClass} aria-label={`Priority: ${priority}`}>●</span>;
  };

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

      <div className="mb-6 border-b border-secondary-200">
        <nav className="-mb-px flex space-x-6 overflow-x-auto" aria-label="Tabs">
            {TABS.filter(tab => hasRole(Role.ADMIN) || tab.name !== 'all').map((tabInfo) => (
            <button
                key={tabInfo.name}
                onClick={() => setActiveTab(tabInfo.name)}
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
                options={statusOptions}
                wrapperClassName="lg:col-span-1"
            />
            <Select
                label="Filter by Priority"
                id="ticket-priority-filter"
                name="priority"
                value={filters.priority}
                onChange={handleFilterChange}
                options={priorityOptions}
                wrapperClassName="lg:col-span-1"
            />
             <Select
                label="Filter by Assignee"
                id="ticket-assignee-filter"
                name="assignee"
                value={filters.assignee}
                onChange={handleFilterChange}
                options={userOptionsForFilter}
                wrapperClassName="lg:col-span-1"
            />
        </div>
      </div>
      
      <div className="bg-white shadow overflow-x-auto rounded-lg">
        <table className="min-w-full divide-y divide-secondary-200" aria-label="Support Tickets Table">
          <thead className="bg-secondary-50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">Ticket ID</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">Subject</th>
              <th scope="col" className="px-2 py-3 text-center text-xs font-medium text-secondary-500 uppercase tracking-wider" title="Priority">P</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">Status</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">Assigned To</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">Requester</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">Created At</th>
              <th scope="col" className="relative px-6 py-3"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-secondary-200">
            {isDataLoading && tickets.length > 0 ? (
                 <tr><td colSpan={8} className="px-6 py-12 text-center relative">
                    <div className="absolute inset-0 bg-white bg-opacity-50 flex justify-center items-center"><Spinner /></div>
                    Updating data...
                 </td></tr>
            ) : filteredAndTabbedTickets.length === 0 ? (
                <tr><td colSpan={8} className="px-6 py-12 text-center text-sm text-secondary-500">No tickets found.</td></tr>
            ) : (
                filteredAndTabbedTickets.map((ticket) => (
                <tr key={ticket.id} className="hover:bg-secondary-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-primary-600 font-medium hover:underline cursor-pointer" onClick={() => handleOpenModal(ticket, true)}>{ticket.ticket_uid}</td>
                    <td className="px-6 py-4 whitespace-normal text-sm font-medium text-secondary-900 max-w-xs hover:underline cursor-pointer" title={ticket.subject} onClick={() => handleOpenModal(ticket, true)}>{ticket.subject}</td>
                    <td className="px-2 py-4 whitespace-nowrap text-sm text-center">{getPriorityAriaLabel(ticket.priority)}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(ticket.status)}`}>
                            {ticket.status}
                        </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-secondary-500">{ticket.assigned_to_user_name || 'Unassigned'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-secondary-500">{ticket.requester_info}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-secondary-500">{new Date(ticket.created_at).toLocaleDateString()}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                      <Button variant="outline" size="sm" onClick={() => handleOpenModal(ticket, true)} aria-label={`View ticket ${ticket.ticket_uid}`}><EyeIcon className="h-4 w-4" /></Button>
                      {(hasRole(Role.ADMIN) || currentUserProfile?.id === ticket.created_by_user_id || currentUserProfile?.id === ticket.assigned_to_user_id) &&
                          <Button variant="outline" size="sm" onClick={() => handleOpenModal(ticket)} aria-label={`Edit ticket ${ticket.ticket_uid}`}><EditIcon className="h-4 w-4" /></Button>
                      }
                      {hasRole(Role.ADMIN) &&
                          <Button variant="danger" size="sm" onClick={() => handleDeleteTicket(ticket.id)} aria-label={`Delete ticket ${ticket.ticket_uid}`}><DeleteIcon className="h-4 w-4" /></Button>
                      }
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
          viewModeInitial={isViewMode}
          allUsers={users}
        />
      )}
    </div>
  );
};