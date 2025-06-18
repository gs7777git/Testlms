
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { leadService, userService, leadFollowUpService, reportService, supabase } from '@/services/api';
import { LeadActivity, LeadFollowUp, Role, LeadStatus, LeadFollowUpStatus, SalesReportData, TaskDashboardStats } from '@/types';
import { Spinner } from '@/components/common/Spinner';
import { EyeIcon, ClipboardDocumentCheckIcon, UsersIcon, LeadsIcon } from '@/components/common/Icons';
import { StatCard } from '@/pages/ReportsPage'; 

interface DashboardStats {
  myTotalLeads?: number; // User's assigned leads
  myOpenLeads?: number; // User's open leads
  totalUsersInOrg?: number; // Admin view
  totalLeadsInOrg?: number; // Admin view
}

const ActivityItem: React.FC<{ activity: LeadActivity & {lead_name?: string} }> = ({ activity }) => (
    <li className="py-3 px-1 hover:bg-secondary-50 rounded-md">
      <div className="flex items-center space-x-3">
        <div className="flex-shrink-0">
           <span className="inline-flex items-center justify-center h-8 w-8 rounded-full bg-primary-500 text-white">
            <span className="text-sm font-medium leading-none">{(activity.user_full_name || 'S').charAt(0).toUpperCase()}</span>
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-secondary-900 truncate capitalize" title={activity.details}>
            {activity.type.replace('_', ' ')}: <span className="font-normal text-secondary-600">{activity.details}</span>
          </p>
          <p className="text-sm text-secondary-500">
            By {activity.user_full_name || 'System'} on Lead: <Link to={`/leads`} state={{ preselectLeadId: activity.lead_id, viewMode: true }} className="text-primary-600 hover:underline">{ activity.lead_name || (activity.lead_id && activity.lead_id.substring(0,8)) || 'N/A'}</Link>
            {' '} - {new Date(activity.created_at).toLocaleDateString()}
          </p>
        </div>
        <Link to={`/leads`} state={{ preselectLeadId: activity.lead_id, viewMode: true }} className="text-primary-600 hover:text-primary-700" title="View Lead">
            <EyeIcon className="h-5 w-5"/>
        </Link>
      </div>
    </li>
  );

  const FollowUpItem: React.FC<{ followup: LeadFollowUp & {lead_name?: string} }> = ({ followup }) => (
     <li className="py-3 px-1 hover:bg-secondary-50 rounded-md">
      <div className="flex items-center space-x-3">
         <div className="flex-shrink-0">
            <div className={`h-2.5 w-2.5 rounded-full ${followup.status === LeadFollowUpStatus.PENDING ? 'bg-yellow-400' : 'bg-green-400'}`}></div>
        </div>
        <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-secondary-900">
                <Link to={`/leads`} state={{ preselectLeadId: followup.lead_id, viewMode: true }} className="hover:underline">
                    {followup.notes || `Follow-up for ${followup.lead_name || 'lead'}`}
                </Link>
            </p>
            <p className="text-sm text-secondary-500">
                Due: {new Date(followup.due_date).toLocaleDateString()}
            </p>
        </div>
        <Link to={`/leads`} state={{ preselectLeadId: followup.lead_id, viewMode: true }} className="text-primary-600 hover:text-primary-700" title="View Lead & Manage Follow-up">
            <EyeIcon className="h-5 w-5"/>
        </Link>
      </div>
    </li>
  );


export const DashboardPage: React.FC = () => {
  const { profile, hasRole } = useAuth();
  const [stats, setStats] = useState<Partial<DashboardStats & SalesReportData>>({});
  const [taskStats, setTaskStats] = useState<Partial<TaskDashboardStats>>({});
  const [upcomingFollowUps, setUpcomingFollowUps] = useState<(LeadFollowUp & {lead_name?: string})[]>([]);
  const [recentActivities, setRecentActivities] = useState<(LeadActivity & {lead_name?: string})[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      if (!profile || !profile.org_id || !profile.id) { // Added profile.id check
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      try {
        let newStats: Partial<DashboardStats & SalesReportData> = {};
        const promises = [];

        // Admin specific stats
        if (hasRole(Role.ADMIN)) {
          promises.push(
            userService.getUsers(profile.org_id).then(users => newStats.totalUsersInOrg = users.length),
            reportService.getLeadStats(profile.org_id).then(report => {
              newStats = { ...newStats, ...report }; 
              newStats.totalLeadsInOrg = report.totalLeads; 
            })
          );
        }
        
        // User specific stats (also relevant for admin's own view)
        // profile.id is now checked above
        promises.push(
        leadService.getLeads(profile.org_id).then(leads => {
            const myLeads = leads.filter(lead => lead.owner_user_id === profile.id);
            newStats.myTotalLeads = myLeads.length;
            newStats.myOpenLeads = myLeads.filter(lead => 
            lead.status !== LeadStatus.CONVERTED && lead.status !== LeadStatus.LOST).length;
            
            if (!hasRole(Role.ADMIN)) { 
            newStats.totalLeads = myLeads.length; 
            }
        }),
        leadFollowUpService.getUpcomingFollowUpsForUser(profile.id, profile.org_id, 5).then(setUpcomingFollowUps),
        reportService.getTaskDashboardStats(profile.org_id, profile.id).then(setTaskStats)
        );
        
         promises.push(
            supabase.from('lead_activities')
            .select('*, user:users(full_name), lead:leads(id, name)') 
            .eq('org_id', profile.org_id)
            .order('created_at', { ascending: false })
            .limit(5)
            .then(response => {
                if (response.error) throw response.error;
                setRecentActivities(response.data?.map((act: any) => ({ 
                    ...act, 
                    user_full_name: act.user?.full_name || 'System', 
                    lead_name: act.lead?.name || 'N/A', 
                    lead_id: act.lead?.id || act.lead_id,
                    user: undefined, 
                    lead: undefined,   
                } as LeadActivity & {lead_name?: string})) || []);
            })
        );

        await Promise.all(promises);
        setStats(newStats);

      } catch (error) {
        console.error("Failed to load dashboard data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    if (profile) fetchDashboardData();
  }, [profile, hasRole]); 

  if (isLoading) {
    return <div className="flex justify-center items-center h-64"><Spinner size="lg" /></div>;
  }
  
  return (
    <div>
      <h1 className="text-3xl font-bold text-secondary-900 mb-2">Dashboard</h1>
      <p className="text-secondary-600 mb-6">Welcome back, {profile?.full_name || 'User'}! Here's what's happening in your CRM.</p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {hasRole(Role.ADMIN) && <StatCard title="Total Leads in Org" value={stats.totalLeadsInOrg} linkTo="/leads" icon={<LeadsIcon className="h-6 w-6"/>} />}
        {hasRole(Role.USER) && <StatCard title="My Assigned Leads" value={stats.myTotalLeads} linkTo="/leads" icon={<LeadsIcon className="h-6 w-6"/>} />}
        {hasRole(Role.USER) && <StatCard title="My Open Leads" value={stats.myOpenLeads} linkTo="/leads" icon={<LeadsIcon className="h-6 w-6"/>} />}
        {hasRole(Role.ADMIN) && <StatCard title="Total Users" value={stats.totalUsersInOrg} linkTo="/users" icon={<UsersIcon className="h-6 w-6"/>} />}
        {profile?.id && <StatCard title="My Open Tasks" value={taskStats.openTasks} linkTo="/tasks" icon={<ClipboardDocumentCheckIcon className="h-6 w-6"/>} />}
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {profile?.id && (
        <div className="bg-white shadow-lg rounded-xl p-6">
            <h2 className="text-xl font-semibold text-secondary-800 mb-4">My Upcoming Follow-ups</h2>
            {upcomingFollowUps.length > 0 ? (
            <ul className="divide-y divide-secondary-200 max-h-96 overflow-y-auto">
                {upcomingFollowUps.map(f => <FollowUpItem key={f.id} followup={f} />)}
            </ul>
            ) : (
            <p className="text-secondary-500">No upcoming follow-ups scheduled.</p>
            )}
        </div>
        )}

        <div className="bg-white shadow-lg rounded-xl p-6">
            <h2 className="text-xl font-semibold text-secondary-800 mb-4">Recent Activities {hasRole(Role.ADMIN) ? ' (Org-wide)' : '(My Leads & Org)'}</h2>
            {recentActivities.length > 0 ? (
            <ul className="divide-y divide-secondary-200 max-h-96 overflow-y-auto">
                {recentActivities.map(act => <ActivityItem key={act.id} activity={act} />)}
            </ul>
            ) : (
            <p className="text-secondary-500">No recent activities recorded.</p>
            )}
        </div>
      </div>

    </div>
  );
};
