
import { createClient, Session, User as SupabaseAuthUser, PostgrestError } from '@supabase/supabase-js';
import { UserProfile, Role, Lead, LeadStatus, Organization, LeadActivity, LeadFollowUp, LeadFollowUpStatus, Product, Deal, DealStatus, DealItem, SalesReportData, LeadsByStatusReportItem, LeadsBySourceReportItem, DealsByStatusReportItem, Company, Contact, Task, TaskStatus, TaskPriority, TaskComment, TaskDashboardStats, DealPageReportData, Ticket, TicketStatus, TicketPriority, ImportedLeadData } from '@/types';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/constants';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error("Supabase URL or Anon Key is undefined in api.ts. This should have been caught in constants.ts.");
}

export const supabase = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!);

export interface UserCredentials {
  email: string;
  password?: string;
}

export interface AdminRegistrationData extends UserCredentials {
  fullName: string;
  organizationName: string;
  passwordInput: string;
}

// --- Auth Service ---
export const authService = {
  login: async (credentials: UserCredentials): Promise<{ session: Session; authUser: SupabaseAuthUser; profile: UserProfile }> => {
    if (!credentials.password) {
      throw new Error('Password is required for login.');
    }
    const { data, error } = await supabase.auth.signInWithPassword({
      email: credentials.email,
      password: credentials.password,
    });

    if (error) throw error;
    if (!data.session || !data.user) throw new Error('Login failed: No session or user data returned.');

    const profile = await authService.getUserProfile(data.user.id);
    if (!profile) {
      await supabase.auth.signOut(); 
      throw new Error('Login failed: User profile not found.');
    }
    return { session: data.session, authUser: data.user, profile };
  },

  registerAdminAndOrganization: async (registrationData: AdminRegistrationData): Promise<{ authUser: SupabaseAuthUser, organization: Organization, profile: UserProfile }> => {
    const { data: authData, error: signUpError } = await supabase.auth.signUp({
      email: registrationData.email,
      password: registrationData.passwordInput,
      options: {
        data: { 
          full_name: registrationData.fullName, 
        }
      }
    });

    if (signUpError) throw signUpError;
    if (!authData.user) throw new Error('Admin registration failed: No auth user data returned.');

    const { data: orgData, error: orgError } = await supabase
      .from('organizations')
      .insert({ name: registrationData.organizationName })
      .select()
      .single();

    if (orgError) {
      console.error("Organization creation failed, auth user might be orphaned:", orgError);
      // Consider deleting the auth user here if org creation fails (requires admin privileges for supabase.auth.admin.deleteUser)
      throw orgError;
    }
    if (!orgData) throw new Error('Organization creation failed.');
    const createdOrganization = orgData as Organization;

    const userProfilePayload = {
      auth_user_id: authData.user.id,
      email: authData.user.email!,
      full_name: registrationData.fullName, // Make sure this aligns with what you use in UserProfile
      role: Role.ADMIN,
      org_id: createdOrganization.id,
      dashboard_widgets: ['myOpenLeads', 'totalTasks', 'upcomingFollowUps', 'recentActivities'], // Default widgets
    };

    const { data: profileData, error: profileError } = await supabase
      .from('users')
      .insert(userProfilePayload)
      .select()
      .single();

    if (profileError) {
      console.error("User profile creation failed, org and auth user might be orphaned:", profileError);
      // Consider deleting org and auth user here
      throw profileError;
    }
    if (!profileData) throw new Error('User profile creation failed.');
    
    const userProfileWithRole: UserProfile = { ...profileData, role: profileData.role as Role, dashboard_widgets: profileData.dashboard_widgets || [] };
    return { authUser: authData.user, organization: createdOrganization, profile: userProfileWithRole };
  },

  logout: async (): Promise<void> => {
    const { error } = await supabase.auth.signOut();
    if (error) console.error('Supabase logout error:', error);
  },

  getSession: async (): Promise<{ session: Session | null; authUser: SupabaseAuthUser | null }> => {
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      console.error('Supabase getSession error:', error);
      return { session: null, authUser: null };
    }
    return { session: data.session, authUser: data.session?.user ?? null };
  },

  getUserProfile: async (authUserId: string): Promise<UserProfile | null> => {
    const { data, error } = await supabase
      .from('users')
      .select('*, manager:parent_user_id(full_name)') // Ensure RLS allows this or use a view/function
      .eq('auth_user_id', authUserId)
      .single();

    if (error) {
      if ((error as PostgrestError).code === 'PGRST116') return null; // No rows found, not an error for profile check
      console.error('Supabase getUserProfile error:', error);
      return null;
    }
    if (!data) return null;
    
    const managerInfo = data.manager as unknown as { full_name: string } | null;
    return { 
        ...data, 
        role: data.role as Role,
        manager_name: managerInfo?.full_name || undefined,
        dashboard_widgets: data.dashboard_widgets || ['myOpenLeads', 'totalTasks', 'upcomingFollowUps', 'recentActivities'], // Default if not set
        manager: undefined // Remove the joined object to match UserProfile type
    };
  },

  onAuthStateChange: (callback: (session: Session | null, authUser: SupabaseAuthUser | null, profile: UserProfile | null) => void) => {
    return supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        const profile = await authService.getUserProfile(session.user.id);
        callback(session, session.user, profile);
      } else {
        callback(null, null, null);
      }
    });
  },
};

// --- User Service (for public.users table) ---
export const userService = {
  getUsers: async (orgId: string): Promise<UserProfile[]> => {
    const { data, error } = await supabase
      .from('users')
      .select('*, manager:parent_user_id(id, full_name)') // RLS check needed
      .eq('org_id', orgId);
    if (error) throw error;
    
    // Calculate manages_users_count client-side after fetching all users
    return (data || []).map(u => {
        const managerInfo = u.manager as unknown as { id: string, full_name: string } | null;
        const managesCount = (data || []).filter(usr => usr.parent_user_id === u.id).length;
        return { 
            ...u, 
            role: u.role as Role,
            manager_name: managerInfo?.full_name || undefined, 
            manages_users_count: managesCount,
            dashboard_widgets: u.dashboard_widgets || [],
            manager: undefined // Remove joined object
        };
    });
  },

  addUser: async (userData: { 
      email: string; 
      passwordInput: string; 
      full_name: string; 
      role: Role; 
      role_name?: string | null; 
      parent_user_id?: string | null; 
    }, adminOrgId: string): Promise<UserProfile> => {
    const { data: authData, error: signUpError } = await supabase.auth.signUp({
      email: userData.email,
      password: userData.passwordInput,
      options: { data: { full_name: userData.full_name } } // Store full_name in auth.users.user_metadata
    });
    if (signUpError) throw signUpError;
    if (!authData.user) throw new Error('User creation failed: No auth user data.');

    const newUserProfileData = {
      auth_user_id: authData.user.id,
      email: userData.email,
      full_name: userData.full_name,
      role: userData.role,
      role_name: userData.role_name || null,
      parent_user_id: userData.parent_user_id || null,
      org_id: adminOrgId,
      dashboard_widgets: ['myOpenLeads', 'totalTasks', 'upcomingFollowUps', 'recentActivities'], // Default widgets
    };
    const { data: profileData, error: profileError } = await supabase
      .from('users')
      .insert(newUserProfileData)
      .select('*, manager:parent_user_id(full_name)')
      .single();
    if (profileError) {
      console.error('Profile creation failed, auth user might be orphaned:', profileError);
      throw profileError;
    }
    if (!profileData) throw new Error('User profile creation failed: No profile data.');
    
    const managerInfo = profileData.manager as unknown as { full_name: string } | null;
    return { 
        ...profileData, 
        role: profileData.role as Role,
        manager_name: managerInfo?.full_name || undefined,
        dashboard_widgets: profileData.dashboard_widgets || [],
        manager: undefined 
    };
  },

  updateUser: async (
    userId: string, 
    userData: Partial<{ full_name: string; role: Role; role_name: string | null; parent_user_id: string | null }>,
    authUserId?: string, 
    passwordInput?: string
  ): Promise<UserProfile> => {
    const updatePayload: any = { ...userData };
    // Ensure null is sent for empty optional fields
    if (userData.hasOwnProperty('parent_user_id')) {
        updatePayload.parent_user_id = userData.parent_user_id === '' ? null : userData.parent_user_id;
    }
    if (userData.hasOwnProperty('role_name')) {
        updatePayload.role_name = userData.role_name === '' ? null : userData.role_name;
    }

    const { data: updatedProfile, error: profileUpdateError } = await supabase
      .from('users')
      .update(updatePayload)
      .eq('id', userId)
      .select('*, manager:parent_user_id(full_name)')
      .single();

    if (profileUpdateError) throw profileUpdateError;
    if (!updatedProfile) throw new Error('User profile update failed.');

    // If full_name changed, update auth.users.user_metadata as well
    if (userData.full_name && authUserId) { // Assuming authUserId is of the user being updated
        await supabase.auth.updateUser({ data: { full_name: userData.full_name }});
    }

    if (passwordInput && authUserId) {
        const {data: {user: currentAuthUser}} = await supabase.auth.getUser(); // Get current authenticated user
        if (currentAuthUser?.id === authUserId) { // Only allow self-password update
             const { error: passwordUpdateError } = await supabase.auth.updateUser({ password: passwordInput });
             if (passwordUpdateError) {
                console.error('Supabase updateUser (self) password error:', passwordUpdateError);
                // Potentially throw or return a partial success if profile updated but password failed
                throw new Error(`Profile updated, but password update failed: ${passwordUpdateError.message}`);
            }
        } else {
            // This case should ideally not be hit if UI restricts password change for others
            console.warn("Attempting to update another user's password from client-side. This is typically for the current user. Ensure correct context.");
        }
    }
    const managerInfo = updatedProfile.manager as unknown as { full_name: string } | null;
    return { 
        ...updatedProfile, 
        role: updatedProfile.role as Role,
        manager_name: managerInfo?.full_name || undefined,
        dashboard_widgets: updatedProfile.dashboard_widgets || [],
        manager: undefined 
    };
  },
  
  updateCurrentAuthUser: async (authUserId: string, data: { full_name?: string, passwordInput?: string }): Promise<UserProfile> => {
    if (data.passwordInput) {
      const { error: passwordError } = await supabase.auth.updateUser({ password: data.passwordInput });
      if (passwordError) throw new Error(`Password update failed: ${passwordError.message}`);
    }

    if (data.full_name) {
      // Update auth user metadata first
      await supabase.auth.updateUser({ data: { full_name: data.full_name }});
      // Then update the public.users table
      const { data: profile, error: profileError } = await supabase
        .from('users')
        .update({ full_name: data.full_name })
        .eq('auth_user_id', authUserId)
        .select('*, manager:parent_user_id(full_name)')
        .single();
      if (profileError) throw new Error(`Profile name update in 'users' table failed: ${profileError.message}`);
      if (!profile) throw new Error('Failed to retrieve updated profile from users table.');
      
      const managerInfo = profile.manager as unknown as { full_name: string } | null;
      return { 
        ...profile, 
        role: profile.role as Role,
        manager_name: managerInfo?.full_name || undefined,
        dashboard_widgets: profile.dashboard_widgets || [],
        manager: undefined
      };
    }
    
    // If only password was updated, or no relevant data changes, refetch profile
    const updatedProfile = await authService.getUserProfile(authUserId);
    if (!updatedProfile) throw new Error('Failed to retrieve profile after update.');
    return updatedProfile;
  },

  deleteUser: async (userId: string, authUserId: string): Promise<void> => {
    // Check if the user manages anyone
    const { data: directReports, error: reportError } = await supabase
        .from('users')
        .select('id', { count: 'exact' })
        .eq('parent_user_id', userId);

    if (reportError) throw reportError;
    if (directReports && directReports.length > 0) {
        throw new Error(`Cannot delete user: This user manages ${directReports.length} other user(s). Please reassign their reports first.`);
    }
    
    // Delete from public.users table
    const { error: profileDeleteError } = await supabase.from('users').delete().eq('id', userId);
    if (profileDeleteError) throw profileDeleteError;

    // Note: Deleting the auth.users entry requires admin privileges and should be handled via a Supabase Edge Function
    // or a backend call with service_role key if full deletion (including auth record) is required from client actions.
    // For now, only profile is deleted client-side.
    console.warn(`User profile ${userId} deleted. Auth user ${authUserId} deletion must be handled by a backend function with service_role (e.g., using supabase.auth.admin.deleteUser()).`);
  },
  
  updateUserDashboardWidgets: async (userId: string, widgets: string[]): Promise<UserProfile> => {
    const { data, error } = await supabase
      .from('users')
      .update({ dashboard_widgets: widgets })
      .eq('id', userId)
      .select('*, manager:parent_user_id(full_name)')
      .single();
    if (error) throw error;
    if (!data) throw new Error("Failed to update user's dashboard widgets.");
    const managerInfo = data.manager as unknown as { full_name: string } | null;
     return { 
        ...data, 
        role: data.role as Role,
        manager_name: managerInfo?.full_name || undefined,
        dashboard_widgets: data.dashboard_widgets || [],
        manager: undefined
    };
  }
};

// --- Lead Service ---
export const leadService = {
  getLeads: async (orgId: string): Promise<Lead[]> => {
    const { data, error } = await supabase
      .from('leads')
      .select(`*, owner:users(id, full_name), company:companies(id, name), contact:contacts(id, first_name, last_name)`)
      .eq('org_id', orgId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []).map(lead => {
      const ownerInfo = lead.owner as unknown as UserProfile | null;
      const companyInfo = lead.company as unknown as Company | null;
      const contactInfo = lead.contact as unknown as Contact | null;
      return {
        ...lead,
        status: lead.status as LeadStatus,
        owner_name: ownerInfo?.full_name || 'Unassigned',
        company_name: companyInfo?.name,
        contact_name: contactInfo ? `${contactInfo.first_name} ${contactInfo.last_name}` : undefined,
        owner: undefined, company: undefined, contact: undefined,
      } as Lead;
    });
  },

  getLeadDetails: async (leadId: string, orgId: string): Promise<Lead | null> => {
     const { data, error } = await supabase
      .from('leads')
      .select(`*, owner:users(id, full_name), company:companies(id, name), contact:contacts(id, first_name, last_name)`)
      .eq('id', leadId)
      .eq('org_id', orgId)
      .single();

    if (error) {
        if ((error as PostgrestError).code === 'PGRST116') return null;
        throw error;
    }
    if (!data) return null;
    const ownerInfo = data.owner as unknown as UserProfile | null;
    const companyInfo = data.company as unknown as Company | null;
    const contactInfo = data.contact as unknown as Contact | null;
    return {
        ...data,
        status: data.status as LeadStatus,
        owner_name: ownerInfo?.full_name || 'Unassigned',
        company_name: companyInfo?.name,
        contact_name: contactInfo ? `${contactInfo.first_name} ${contactInfo.last_name}` : undefined,
        owner: undefined, company: undefined, contact: undefined,
    } as Lead;
  },

  addLead: async (leadData: Omit<Lead, 'id' | 'created_at' | 'updated_at' | 'owner_name' | 'company_name' | 'contact_name' | 'org_id' | 'activities' | 'follow_ups' | 'deals'>, orgId: string): Promise<Lead> => {
    const payload: any = { ...leadData, org_id: orgId };
    if ('owner_user_id' in payload && (payload.owner_user_id === '' || payload.owner_user_id === undefined)) payload.owner_user_id = null;
    if ('company_id' in payload && (payload.company_id === '' || payload.company_id === undefined)) payload.company_id = null;
    if ('contact_id' in payload && (payload.contact_id === '' || payload.contact_id === undefined)) payload.contact_id = null;

    const { data, error } = await supabase
      .from('leads')
      .insert(payload)
      .select(`*, owner:users(id, full_name), company:companies(id, name), contact:contacts(id, first_name, last_name)`)
      .single();
    if (error) throw error;
    if (!data) throw new Error('Lead creation failed.');

    const ownerInfo = data.owner as unknown as UserProfile | null;
    const companyInfo = data.company as unknown as Company | null;
    const contactInfo = data.contact as unknown as Contact | null;
    return {
      ...data, status: data.status as LeadStatus,
      owner_name: ownerInfo?.full_name || 'Unassigned',
      company_name: companyInfo?.name,
      contact_name: contactInfo ? `${contactInfo.first_name} ${contactInfo.last_name}` : undefined,
      owner: undefined, company: undefined, contact: undefined,
    } as Lead;
  },

  updateLead: async (leadId: string, leadData: Partial<Omit<Lead, 'id' | 'created_at' | 'updated_at' | 'owner_name' | 'company_name' | 'contact_name' | 'org_id' | 'activities' | 'follow_ups' | 'deals'>>): Promise<Lead> => {
    const payload: any = { ...leadData };
    if ('owner_user_id' in payload && (payload.owner_user_id === '' || payload.owner_user_id === undefined)) payload.owner_user_id = null;
    if ('company_id' in payload && (payload.company_id === '' || payload.company_id === undefined)) payload.company_id = null;
    if ('contact_id' in payload && (payload.contact_id === '' || payload.contact_id === undefined)) payload.contact_id = null;

    const { data, error } = await supabase
      .from('leads')
      .update(payload)
      .eq('id', leadId)
      .select(`*, owner:users(id, full_name), company:companies(id, name), contact:contacts(id, first_name, last_name)`)
      .single();
    if (error) throw error;
    if (!data) throw new Error('Lead update failed.');

    const ownerInfo = data.owner as unknown as UserProfile | null;
    const companyInfo = data.company as unknown as Company | null;
    const contactInfo = data.contact as unknown as Contact | null;
    return {
      ...data, status: data.status as LeadStatus,
      owner_name: ownerInfo?.full_name || 'Unassigned',
      company_name: companyInfo?.name,
      contact_name: contactInfo ? `${contactInfo.first_name} ${contactInfo.last_name}` : undefined,
      owner: undefined, company: undefined, contact: undefined,
    } as Lead;
  },

  deleteLead: async (leadId: string): Promise<void> => {
    await leadActivityService.deleteActivitiesForLead(leadId);
    await leadFollowUpService.deleteFollowUpsForLead(leadId);
    await dealService.deleteDealsForLead(leadId); 

    const { error } = await supabase.from('leads').delete().eq('id', leadId);
    if (error) throw error;
  },

  bulkAddLeads: async (leadsData: ImportedLeadData[], orgId: string): Promise<{ successCount: number; errorCount: number; errorsDetails?: {row: number, leadName: string, error: string}[] }> => {
    const leadsToInsert = leadsData.map(lead => ({
        ...lead,
        org_id: orgId,
        status: lead.status || LeadStatus.NEW, // Default status if not provided or invalid
    }));

    const { data, error } = await supabase.from('leads').insert(leadsToInsert).select();
    
    if (error) {
      console.error("Error bulk adding leads:", error);
      // Attempt to provide more granular error feedback if possible (Supabase might not return per-row errors easily for bulk insert)
      return { 
        successCount: 0, 
        errorCount: leadsToInsert.length, 
        errorsDetails: leadsToInsert.map((l, i) => ({row: i+1, leadName: l.name || 'Unknown', error: error.message})) 
      };
    }
    return { successCount: data?.length || 0, errorCount: leadsToInsert.length - (data?.length || 0) };
  },

  bulkUpdateLeadDetails: async (leadIds: string[], updates: Partial<{ status: LeadStatus; owner_user_id: string | null }>, orgId: string): Promise<void> => {
    const { error } = await supabase
      .from('leads')
      .update(updates)
      .in('id', leadIds)
      .eq('org_id', orgId); // Ensure updates are scoped to the organization
    if (error) throw error;
  },
};

// --- Lead Activity Service ---
export const leadActivityService = {
  getActivitiesForLead: async (leadId: string, orgId: string): Promise<LeadActivity[]> => {
    const { data, error } = await supabase
      .from('lead_activities')
      .select('*, user:users(full_name)')
      .eq('lead_id', leadId)
      .eq('org_id', orgId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data?.map(activity => {
        const userInfo = activity.user as unknown as { full_name: string } | null;
        return {
            ...activity,
            user_full_name: userInfo?.full_name || 'System',
            user: undefined, 
        } as LeadActivity;
    }) || [];
  },

  addActivity: async (activityData: Omit<LeadActivity, 'id' | 'created_at' | 'org_id' | 'user_full_name'>, orgId: string): Promise<LeadActivity> => {
    const payload = { ...activityData, org_id: orgId };
    const { data, error } = await supabase
      .from('lead_activities')
      .insert(payload)
      .select('*, user:users(full_name)')
      .single();
    if (error) throw error;
    if (!data) throw new Error('Activity creation failed.');
    const userInfo = data.user as unknown as { full_name: string } | null;
    return {
        ...data,
        user_full_name: userInfo?.full_name || 'System',
        user: undefined, 
    } as LeadActivity;
  },
  deleteActivitiesForLead: async (leadId: string): Promise<void> => {
    const { error } = await supabase.from('lead_activities').delete().eq('lead_id', leadId);
    if (error) {
        console.error(`Failed to delete activities for lead ${leadId}:`, error);
    }
  }
};

// --- Lead FollowUp Service ---
export const leadFollowUpService = {
  getFollowUpsForLead: async (leadId: string, orgId: string): Promise<LeadFollowUp[]> => {
    const { data, error } = await supabase
      .from('lead_follow_ups')
      .select('*, user:users(full_name)')
      .eq('lead_id', leadId)
      .eq('org_id', orgId)
      .order('due_date', { ascending: true });
    if (error) throw error;
    return data?.map(item => {
        const userInfo = item.user as unknown as { full_name: string } | null;
        return {
            ...item,
            status: item.status as LeadFollowUpStatus,
            user_full_name: userInfo?.full_name || 'N/A',
            user: undefined, 
        } as LeadFollowUp;
    }) || [];
  },

  getUpcomingFollowUpsForUser: async (userId: string, orgId: string, limit: number = 5): Promise<(LeadFollowUp & {lead_name?: string})[]> => {
    const { data, error } = await supabase
      .from('lead_follow_ups')
      .select('*, lead:leads(name), user:users(full_name)') 
      .eq('user_id', userId)
      .eq('org_id', orgId)
      .eq('status', LeadFollowUpStatus.PENDING)
      .order('due_date', { ascending: true })
      .limit(limit);
    if (error) throw error;
     return data?.map(item => {
        const userInfo = item.user as unknown as { full_name: string } | null;
        const leadInfo = item.lead as unknown as { name: string } | null; 
        return {
            ...item,
            status: item.status as LeadFollowUpStatus,
            user_full_name: userInfo?.full_name || 'N/A',
            lead_name: leadInfo?.name || 'N/A', 
            user: undefined,
            lead: undefined, 
        } as LeadFollowUp & { lead_name?: string };
    }) || [];
  },

  addFollowUp: async (followUpData: Omit<LeadFollowUp, 'id' | 'created_at' | 'org_id' | 'completed_at' | 'updated_at' | 'user_full_name'>, orgId: string): Promise<LeadFollowUp> => {
    const payload = { ...followUpData, org_id: orgId };
    const { data, error } = await supabase
      .from('lead_follow_ups')
      .insert(payload)
      .select('*, user:users(full_name)')
      .single();
    if (error) throw error;
    if (!data) throw new Error('Follow-up creation failed.');
    const userInfo = data.user as unknown as { full_name: string } | null;
    return {
        ...data,
        status: data.status as LeadFollowUpStatus,
        user_full_name: userInfo?.full_name || 'N/A',
        user: undefined, 
    } as LeadFollowUp;
  },

  updateFollowUp: async (
    followUpId: string,
    updateData: Partial<Pick<LeadFollowUp, 'due_date' | 'notes' | 'status' | 'completed_at' | 'user_id'>>
  ): Promise<LeadFollowUp> => {
    const payload: Partial<LeadFollowUp> = { ...updateData, updated_at: new Date().toISOString() };
    
    if (updateData.status === LeadFollowUpStatus.COMPLETED && !updateData.completed_at) {
        payload.completed_at = new Date().toISOString();
    } else if (updateData.status !== LeadFollowUpStatus.COMPLETED && updateData.status !== undefined) { 
        payload.completed_at = null; 
    }

    const { data, error } = await supabase
      .from('lead_follow_ups')
      .update(payload)
      .eq('id', followUpId)
      .select('*, user:users(full_name)')
      .single();
    if (error) throw error;
    if (!data) throw new Error('Follow-up update failed.');
    const userInfo = data.user as unknown as { full_name: string } | null;
    return {
        ...data,
        status: data.status as LeadFollowUpStatus,
        user_full_name: userInfo?.full_name || 'N/A',
        user: undefined, 
    } as LeadFollowUp;
  },

  deleteFollowUp: async (followUpId: string): Promise<void> => {
    const { error } = await supabase.from('lead_follow_ups').delete().eq('id', followUpId);
    if (error) throw error;
  },
  deleteFollowUpsForLead: async (leadId: string): Promise<void> => {
    const { error } = await supabase.from('lead_follow_ups').delete().eq('lead_id', leadId);
     if (error) {
        console.error(`Failed to delete follow-ups for lead ${leadId}:`, error);
    }
  }
};

// --- Organization Service ---
export const organizationService = {
    getOrganizationDetails: async (orgId: string): Promise<Organization | null> => {
        const { data, error } = await supabase
            .from('organizations')
            .select('*')
            .eq('id', orgId)
            .single();
        if (error) {
             if ((error as PostgrestError).code === 'PGRST116') return null;
            console.error("Error fetching organization details:", error);
            throw error;
        }
        return data;
    },
};

// --- Product Service ---
export const productService = {
  getProducts: async (orgId: string): Promise<Product[]> => {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('org_id', orgId)
      .order('name', { ascending: true });
    if (error) throw error;
    return data || [];
  },

  addProduct: async (productData: Omit<Product, 'id' | 'created_at' | 'updated_at' | 'org_id'>, orgId: string): Promise<Product> => {
    const payload = { ...productData, org_id: orgId };
    const { data, error } = await supabase
      .from('products')
      .insert(payload)
      .select()
      .single();
    if (error) throw error;
    if (!data) throw new Error('Product creation failed.');
    return data;
  },

  updateProduct: async (productId: string, productData: Partial<Omit<Product, 'id' | 'created_at' | 'updated_at' | 'org_id'>>): Promise<Product> => {
    const payload = { ...productData, updated_at: new Date().toISOString() };
    const { data, error } = await supabase
      .from('products')
      .update(payload)
      .eq('id', productId)
      .select()
      .single();
    if (error) throw error;
    if (!data) throw new Error('Product update failed.');
    return data;
  },

  deleteProduct: async (productId: string): Promise<void> => {
    const { error } = await supabase.from('products').delete().eq('id', productId);
    if (error) throw error;
  },
  
  bulkAddProducts: async (products: Omit<Product, 'id' | 'created_at' | 'updated_at' | 'org_id'>[], orgId: string): Promise<Product[]> => {
    const productsToInsert = products.map(p => ({ ...p, org_id: orgId }));
    const { data, error } = await supabase
      .from('products')
      .insert(productsToInsert)
      .select();
    if (error) throw error;
    return data || [];
  }
};

// --- Company Service ---
export const companyService = {
  getCompanies: async (orgId: string): Promise<Company[]> => {
    const { data, error } = await supabase
      .from('companies')
      .select('*')
      .eq('org_id', orgId)
      .order('name', { ascending: true });
    if (error) throw error;
    return data || [];
  },
  addCompany: async (companyData: Omit<Company, 'id' | 'created_at' | 'updated_at' | 'org_id'>, orgId: string): Promise<Company> => {
    const payload = { ...companyData, org_id: orgId };
    const { data, error } = await supabase.from('companies').insert(payload).select().single();
    if (error) throw error;
    if (!data) throw new Error('Company creation failed.');
    return data;
  },
  updateCompany: async (companyId: string, companyData: Partial<Omit<Company, 'id' | 'created_at' | 'updated_at' | 'org_id'>>): Promise<Company> => {
    const payload = { ...companyData, updated_at: new Date().toISOString() };
    const { data, error } = await supabase.from('companies').update(payload).eq('id', companyId).select().single();
    if (error) throw error;
    if (!data) throw new Error('Company update failed.');
    return data;
  },
  deleteCompany: async (companyId: string): Promise<void> => {
    // Consider implications: delete/unlink contacts? Unlink from leads/deals?
    // For now, simple delete. RLS/Triggers might handle cascades in DB.
    // First, update related contacts to remove company_id (or delete them based on policy)
    const { error: updateContactsError } = await supabase
        .from('contacts')
        .update({ company_id: null }) // Or .delete()
        .eq('company_id', companyId);
    if (updateContactsError) console.error(`Error unlinking contacts from company ${companyId}:`, updateContactsError);

    // Unlink from leads
    const { error: updateLeadsError } = await supabase
        .from('leads')
        .update({ company_id: null, contact_id: null }) // Also clear contact if company is removed
        .eq('company_id', companyId);
    if (updateLeadsError) console.error(`Error unlinking leads from company ${companyId}:`, updateLeadsError);
    
    // Unlink from deals
    const { error: updateDealsError } = await supabase
        .from('deals')
        .update({ company_id: null, contact_id: null })
        .eq('company_id', companyId);
     if (updateDealsError) console.error(`Error unlinking deals from company ${companyId}:`, updateDealsError);


    const { error } = await supabase.from('companies').delete().eq('id', companyId);
    if (error) throw error;
  },
};

// --- Contact Service ---
export const contactService = {
  getContacts: async (orgId: string): Promise<Contact[]> => {
    const { data, error } = await supabase
      .from('contacts')
      .select('*, company:companies(name)')
      .eq('org_id', orgId)
      .order('last_name', { ascending: true })
      .order('first_name', { ascending: true });
    if (error) throw error;
    return (data || []).map(contact => {
        const companyInfo = contact.company as unknown as {name: string} | null;
        return {
            ...contact,
            company_name: companyInfo?.name || 'N/A',
            company: undefined,
        }
    });
  },
  getContactsForCompany: async (companyId: string, orgId: string): Promise<Contact[]> => {
    const { data, error } = await supabase
      .from('contacts')
      .select('*, company:companies(name)')
      .eq('org_id', orgId)
      .eq('company_id', companyId)
      .order('last_name', { ascending: true });
    if (error) throw error;
     return (data || []).map(contact => {
        const companyInfo = contact.company as unknown as {name: string} | null;
        return {
            ...contact,
            company_name: companyInfo?.name || 'N/A',
            company: undefined,
        }
    });
  },
  addContact: async (contactData: Omit<Contact, 'id' | 'created_at' | 'updated_at' | 'org_id' | 'company_name'>, orgId: string): Promise<Contact> => {
    const payload = { ...contactData, org_id: orgId };
    const { data, error } = await supabase.from('contacts').insert(payload).select('*, company:companies(name)').single();
    if (error) throw error;
    if (!data) throw new Error('Contact creation failed.');
    const companyInfo = data.company as unknown as {name: string} | null;
    return {...data, company_name: companyInfo?.name || "N/A", company: undefined};
  },
  updateContact: async (contactId: string, contactData: Partial<Omit<Contact, 'id' | 'created_at' | 'updated_at' | 'org_id' | 'company_name'>>): Promise<Contact> => {
    const payload = { ...contactData, updated_at: new Date().toISOString() };
    const { data, error } = await supabase.from('contacts').update(payload).eq('id', contactId).select('*, company:companies(name)').single();
    if (error) throw error;
    if (!data) throw new Error('Contact update failed.');
    const companyInfo = data.company as unknown as {name: string} | null;
    return {...data, company_name: companyInfo?.name || "N/A", company: undefined};
  },
  deleteContact: async (contactId: string): Promise<void> => {
    // Unlink from leads
    const { error: updateLeadsError } = await supabase
        .from('leads')
        .update({ contact_id: null }) 
        .eq('contact_id', contactId);
    if (updateLeadsError) console.error(`Error unlinking leads from contact ${contactId}:`, updateLeadsError);
    
    // Unlink from deals
    const { error: updateDealsError } = await supabase
        .from('deals')
        .update({ contact_id: null })
        .eq('contact_id', contactId);
     if (updateDealsError) console.error(`Error unlinking deals from contact ${contactId}:`, updateDealsError);

    const { error } = await supabase.from('contacts').delete().eq('id', contactId);
    if (error) throw error;
  },
};


// --- Deal Service (Updated for Company/Contact linking) ---
export const dealService = {
  getDeals: async (orgId: string, userId: string, userRole: Role): Promise<Deal[]> => {
    let query = supabase
        .from('deals')
        .select(`
          *, 
          lead:leads(id, name),
          created_by:users(full_name),
          company:companies(id, name),
          contact:contacts(id, first_name, last_name)
        `)
        .eq('org_id', orgId);

    if (userRole !== Role.ADMIN) {
        query = query.eq('created_by_user_id', userId);
    }
    query = query.order('created_at', { ascending: false });

    const { data: dealsData, error: dealsError } = await query;
    if (dealsError) throw dealsError;
    if (!dealsData) return [];
    
    return Promise.all(dealsData.map(async (deal) => {
        const { data: itemsData, error: itemsError } = await supabase
            .from('deal_items')
            .select('*, product:products(name)')
            .eq('deal_id', deal.id);
        if (itemsError) console.error(`Error fetching items for deal ${deal.id}:`, itemsError);

        const leadInfo = deal.lead as unknown as {id: string, name: string} | null;
        const createdByUserInfo = deal.created_by as unknown as { full_name: string } | null;
        const companyInfo = deal.company as unknown as { id: string, name: string } | null;
        const contactInfo = deal.contact as unknown as { id: string, first_name: string, last_name: string } | null;
        
        return {
            ...deal,
            status: deal.status as DealStatus,
            lead_name: leadInfo?.name || undefined,
            created_by_user_name: createdByUserInfo?.full_name || 'N/A',
            company_name: companyInfo?.name || undefined,
            contact_name: contactInfo ? `${contactInfo.first_name} ${contactInfo.last_name}` : undefined,
            lead: undefined, created_by: undefined, company: undefined, contact: undefined,
            items: (itemsData || []).map(item => {
                const productInfo = item.product as unknown as { name: string } | null;
                return { ...item, product_name: productInfo?.name || 'Unknown Product', product: undefined } as DealItem;
            }),
        } as Deal;
    }));
  },
  getDealsForLead: async (leadId: string, orgId: string): Promise<Deal[]> => {
    const { data: dealsData, error: dealsError } = await supabase
        .from('deals')
        .select(`
          *, 
          lead:leads(id, name),
          created_by:users(full_name),
          company:companies(id, name),
          contact:contacts(id, first_name, last_name)
        `)
        .eq('lead_id', leadId)
        .eq('org_id', orgId)
        .order('created_at', { ascending: false });

    if (dealsError) throw dealsError;
    if (!dealsData) return [];

    const dealsWithItems = await Promise.all(
        dealsData.map(async (deal) => {
            const { data: itemsData, error: itemsError } = await supabase
                .from('deal_items')
                .select('*, product:products(name)') 
                .eq('deal_id', deal.id);

            if (itemsError) console.error(`Error fetching items for deal ${deal.id}:`, itemsError);
            
            const leadInfo = deal.lead as unknown as {id: string, name: string} | null;
            const createdByUserInfo = deal.created_by as unknown as { full_name: string } | null;
            const companyInfo = deal.company as unknown as { id: string, name: string } | null;
            const contactInfo = deal.contact as unknown as { id: string, first_name: string, last_name: string } | null;

            return {
                ...deal,
                status: deal.status as DealStatus,
                lead_name: leadInfo?.name || undefined,
                created_by_user_name: createdByUserInfo?.full_name || 'N/A',
                company_name: company