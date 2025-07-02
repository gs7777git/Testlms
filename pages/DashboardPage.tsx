
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { leadService, userService, leadFollowUpService, reportService, supabase } from '@/services/api';
import { LeadActivity, LeadFollowUp, Role, LeadStatus, UserProfile, LeadFollowUpStatus, SalesReportData } from '@/types';
import { Spinner } from '@/components/common/Spinner';
import { EyeIcon } from '@/components/common/Icons';

interface DashboardStats {
  totalLeads: number;
  myOpenLeads: number;
  totalUsers: number;
}

export const DashboardPage: React.FC = () => {
  const { profile, hasRole } = useAuth();
  const [stats, setStats] = useState<Partial<DashboardStats & SalesReportData>>({}); // Combine for admin stats
  const [upcomingFollowUps, setUpcomingFollowUps] = useState<(LeadFollowUp & {lead_name?: string})[]>([]);
  const [recentActivities, setRecentActivities] = useState<(LeadActivity & {lead_name?: string})[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      if (!profile || !profile.org_id) {
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      try {
        let newStats: Partial<DashboardStats & SalesReportData> = {};
        const promises = [];

        if (hasRole(Role.ADMIN)) {
          promises.push(
            userService.getUsers(profile.org_id).then(users => newStats.totalUsers = users.length),
            // reportService.getLeadStats(profile.org_id).then(data => newStats.totalLeads = data.totalLeads || 0) // This is part of getLeadStats below
             reportService.getLeadStats(profile.org_id).then(report => {
              newStats.totalLeads = report.totalLeads;
              // You can add more admin-specific stats from report here if needed
            })
          );
        }
        
        if (profile.id) { 
           promises.push(
            leadService.getLeads(profile.org_id).then(leads => {
              newStats.myOpenLeads = leads.filter(lead => lead.owner_user_id === profile.id && 
                lead.status !== LeadStatus.CONVERTED && lead.status !== LeadStatus.LOST).length;
              if (!hasRole(Role.ADMIN)) { 
                // For non-admin users, totalLeads should be their assigned leads
                newStats.totalLeads = leads.filter(lead => lead.owner_user_id === profile.id).length; 
              }
            }),
            leadFollowUpService.getUpcomingFollowUpsForUser(profile.id, profile.org_id, 5).then(setUpcomingFollowUps)
           );
        }
        
         promises.push(
            supabase.from('lead_activities')
            .select('*, user:users(full_name), lead:leads(name)') 
            .eq('org_id', profile.org_id)
            .order('created_at', { ascending: false })
            .limit(5)
            .then(response => {
                if (response.error) throw response.error;
                setRecentActivities(response.data?.map((act: any) => ({ 
                    ...act, 
                    user_full_name: act.user?.full_name || 'System', 
                    lead_name: act.lead?.name || 'N/A', 
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

    fetchDashboardData();
  }, [profile, hasRole]);

  if (isLoading) {
    return <div className="flex justify-center items-center h-64"><Spinner size="lg" /></div>;
  }

  const StatCard: React.FC<{ title: string; value: string | number | undefined; linkTo?: string }> = ({ title, value, linkTo }) => (
    <div className="bg-white shadow-lg rounded-xl p-6 transform hover:scale-105 transition-transform duration-200">
      <h3 className="text-lg font-semibold text-secondary-700">{title}</h3>
      <p className="text-4xl font-bold text-primary-600 mt-2">{value !== undefined ? value : '--'}</p>
      {linkTo && <Link to={linkTo} className="text-sm text-primary-500 hover:underline mt-3 block">View all</Link>}
    </div>
  );
  
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
            By {activity.user_full_name || 'System'} on Lead: <Link to={`/leads`} state={{ preselectLeadId: activity.lead_id, viewMode: true }} className="text-primary-600 hover:underline">{ activity.lead_name || activity.lead_id.substring(0,8)}</Link>
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


  return (
    <div>
      <h1 className="text-3xl font-bold text-secondary-900 mb-2">Dashboard</h1>
      <p className="text-secondary-600 mb-6">Welcome back, {profile?.full_name || 'User'}! Here's what's happening in your CRM.</p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {hasRole(Role.ADMIN) && <StatCard title="Total Leads in Org" value={stats.totalLeads} linkTo="/leads"/>}
        {(hasRole(Role.USER) && !hasRole(Role.ADMIN) && profile?.id) && <StatCard title="My Assigned Leads" value={stats.totalLeads} linkTo="/leads"/>}
        {hasRole(Role.USER) && profile?.id && <StatCard title="My Open Leads" value={stats.myOpenLeads} linkTo="/leads" />}
        {hasRole(Role.ADMIN) && <StatCard title="Total Users" value={stats.totalUsers} linkTo="/users" />}
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {hasRole(Role.USER) && profile?.id && (
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