
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { leadService, userService, leadFollowUpService, reportService, supabase, taskService } from '@/services/api';
import { LeadActivity, LeadFollowUp, Role, LeadStatus, LeadFollowUpStatus, SalesReportData, TaskDashboardStats } from '@/types';
import { Spinner } from '@/components/common/Spinner';
import { EyeIcon, ClipboardDocumentCheckIcon, UsersIcon, LeadsIcon } from '@/components/common/Icons';
import { StatCard } from '@/components/common/StatCard'; 

interface DashboardStats {
  myTotalLeads?: number; // User's assigned leads
  myOpenLeads?: number; // User's open leads
  totalUsersInOrg?: number; // Admin view
  totalLeadsInOrg?: number; // Admin view, from SalesReportData.totalLeads
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
            By {activity.user_full_name || 'System'} on Lead: 
            {activity.lead_id ? (
                 <Link to={`/leads`} state={{ preselectLeadId: activity.lead_id, viewMode: true, initialTab: 'activities' }} className="text-primary-600 hover:underline">
                    { activity.lead_name || activity.lead_id.substring(0,8) }
                </Link>
            ) : (
                <span className="text-secondary-500">N/A</span>
            )}
            {' '} - {new Date(activity.created_at).toLocaleDateString()}
          </p>
        </div>
        {activity.lead_id && (
            <Link to={`/leads`} state={{ preselectLeadId: activity.lead_id, viewMode: true, initialTab: 'activities' }} className="text-primary-600 hover:text-primary-700" title="View Lead">
                <EyeIcon className="h-5 w-5"/>
            </Link>
        )}
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
                <Link to={`/leads`} state={{ preselectLeadId: followup.lead_id, viewMode: true, initialTab: 'follow_ups' }} className="hover:underline">
                    {followup.notes || `Follow-up for ${followup.lead_name || 'lead'}`}
                </Link>
            </p>
            <p className="text-sm text-secondary-500">
                Due: {new Date(followup.due_date).toLocaleDateString()}
            </p>
        </div>
        <Link to={`/leads`} state={{ preselectLeadId: followup.lead_id, viewMode: true, initialTab: 'follow_ups' }} className="text-primary-600 hover:text-primary-700" title="View Lead & Manage Follow-up">
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
      if (!profile || !profile.org_id || !profile.id) { 
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      try {
        let newStatsData: Partial<DashboardStats & SalesReportData> = {};
        const promises = [];

        if (hasRole(Role.ADMIN)) {
          promises.push(
            userService.getUsers(profile.org_id).then(users => newStatsData.totalUsersInOrg = users.length),
            reportService.getLeadStats(profile.org_id).then(report => {
              newStatsData = { ...newStatsData, ...report }; // Merge all sales report data for admin
            })
          );
        }
        
        promises.push(
        leadService.getLeads(profile.org_id).then(leads => {
            const myLeads = leads.filter(lead => lead.owner_user_id === profile.id);
            newStatsData.myTotalLeads = myLeads.length;
            newStatsData.myOpenLeads = myLeads.filter(lead => 
            lead.status !== LeadStatus.CONVERTED && lead.status !== LeadStatus.LOST).length;
            
            if (!hasRole(Role.ADMIN)) { 
              if (!newStatsData.totalLeads) {
                newStatsData.totalLeads = myLeads.length;
              }
            }
        }),
        leadFollowUpService.getUpcomingFollowUpsForUser(profile.id, profile.org_id, 5).then(setUpcomingFollowUps),
        taskService.getTaskDashboardStats(profile.org_id, profile.id, profile.role).then(setTaskStats)
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
        setStats(newStatsData);

      } catch (error) {
        console.error("Failed to load dashboard data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    if (profile) fetchDashboardData();
  }, [profile, hasRole]); 

  if (isLoading && Object.keys(stats).length === 0 && Object.keys(taskStats).length === 0) {
    return <div className="flex justify-center items-center h-64"><Spinner size="lg" /></div>;
  }
  
  return (
    <div>
      <h1 className="text-3xl font-bold text-secondary-900 mb-2">Dashboard</h1>
      <p className="text-secondary-600 mb-6">Welcome back, {profile?.full_name || 'User'}! Here's what's happening in your CRM.</p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {hasRole(Role.ADMIN) && <StatCard title="Total Leads in Org" value={isLoading && stats.totalLeads === undefined ? <Spinner size="sm" /> : stats.totalLeads} linkTo="/leads" icon={<LeadsIcon className="h-8 w-8"/>} />}
        {(hasRole(Role.USER) && !hasRole(Role.ADMIN)) && <StatCard title="My Assigned Leads" value={isLoading && stats.myTotalLeads === undefined ? <Spinner size="sm" /> : stats.myTotalLeads} linkTo="/leads" icon={<LeadsIcon className="h-8 w-8"/>} />}
        {hasRole(Role.USER) && <StatCard title="My Open Leads" value={isLoading && stats.myOpenLeads === undefined ? <Spinner size="sm" /> : stats.myOpenLeads} linkTo="/leads" icon={<LeadsIcon className="h-8 w-8"/>} />}
        {hasRole(Role.ADMIN) && <StatCard title="Total Users" value={isLoading && stats.totalUsersInOrg === undefined ? <Spinner size="sm" /> : stats.totalUsersInOrg} linkTo="/users" icon={<UsersIcon className="h-8 w-8"/>} />}
        {profile?.id && <StatCard title="My Open Tasks" value={isLoading && taskStats.openTasks === undefined ? <Spinner size="sm" /> : taskStats.openTasks} linkTo="/tasks" icon={<ClipboardDocumentCheckIcon className="h-8 w-8"/>} />}
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {profile?.id && (
        <div className="bg-white shadow-lg rounded-xl p-6">
            <h2 className="text-xl font-semibold text-secondary-800 mb-4">My Upcoming Follow-ups</h2>
            {isLoading && upcomingFollowUps.length === 0 ? <Spinner/> : upcomingFollowUps.length > 0 ? (
            <ul className="divide-y divide-secondary-200 max-h-96 overflow-y-auto">
                {upcomingFollowUps.map(f => <FollowUpItem key={f.id} followup={f} />)}
            </ul>
            ) : (
            <p className="text-secondary-500">No upcoming follow-ups scheduled.</p>
            )}
        </div>
        )}

        <div className="bg-white shadow-lg rounded-xl p-6">
            <h2 className="text-xl font-semibold text-secondary-800 mb-4">Recent Activities {hasRole(Role.ADMIN) ? ' (Org-wide)' : ''}</h2>
            {isLoading && recentActivities.length === 0 ? <Spinner/> : recentActivities.length > 0 ? (
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
