
import { createClient, Session, User as SupabaseAuthUser, PostgrestError } from '@supabase/supabase-js';
import { UserProfile, Role, Lead, LeadStatus, Organization, LeadActivity, LeadFollowUp, LeadFollowUpStatus, Product, Deal, DealStatus, DealItem, SalesReportData, LeadsByStatusReportItem, LeadsBySourceReportItem, DealsByStatusReportItem, Company, Contact, Task, TaskStatus, TaskPriority, TaskComment, TaskDashboardStats, DealPageReportData, Ticket, TicketStatus, TicketPriority, ImportedLeadData } from '@/types';
import { SUPABASE_URL, SUPABASE_ANON_KEY, TASK_STATUS_OPTIONS, TASK_PRIORITY_OPTIONS, DEAL_STATUS_OPTIONS } from '@/constants'; // This import ensures the check in constants.ts runs

// The console.error in constants.ts handles the warning if SUPABASE_URL or SUPABASE_ANON_KEY are missing.
// For the build to pass, createClient needs valid string types, even if they are dummy/non-functional values.
// The application will not function correctly at runtime if the real env vars are missing,
// and the error from constants.ts will indicate this.
const effectiveSupabaseUrl = SUPABASE_URL || "http://localhost:54321/fallback_url_for_build"; 
const effectiveSupabaseAnonKey = SUPABASE_ANON_KEY || "fallback_anon_key_for_build"; 

export const supabase = createClient(effectiveSupabaseUrl, effectiveSupabaseAnonKey);

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
      throw orgError;
    }
    if (!orgData) throw new Error('Organization creation failed.');
    const createdOrganization = orgData as Organization;

    const userProfilePayload = {
      auth_user_id: authData.user.id,
      email: authData.user.email!,
      full_name: registrationData.fullName,
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
      .select('*, manager:parent_user_id(full_name)') 
      .eq('auth_user_id', authUserId)
      .single();

    if (error) {
      if ((error as PostgrestError).code === 'PGRST116') return null; 
      console.error('Supabase getUserProfile error:', error);
      return null;
    }
    if (!data) return null;
    
    const managerInfo = data.manager as unknown as { full_name: string } | null;
    return { 
        ...data, 
        role: data.role as Role,
        manager_name: managerInfo?.full_name || undefined,
        dashboard_widgets: data.dashboard_widgets || ['myOpenLeads', 'totalTasks', 'upcomingFollowUps', 'recentActivities'], 
        manager: undefined 
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
      .select('*, manager:parent_user_id(id, full_name)') 
      .eq('org_id', orgId);
    if (error) throw error;
    
    return (data || []).map(u => {
        const managerInfo = u.manager as unknown as { id: string, full_name: string } | null;
        const managesCount = (data || []).filter(usr => usr.parent_user_id === u.id).length;
        return { 
            ...u, 
            role: u.role as Role,
            manager_name: managerInfo?.full_name || undefined, 
            manages_users_count: managesCount,
            dashboard_widgets: u.dashboard_widgets || [],
            manager: undefined 
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
      options: { data: { full_name: userData.full_name } } 
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
      dashboard_widgets: ['myOpenLeads', 'totalTasks', 'upcomingFollowUps', 'recentActivities'], 
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

    if (userData.full_name && authUserId) { 
        await supabase.auth.updateUser({ data: { full_name: userData.full_name }});
    }

    if (passwordInput && authUserId) {
        const {data: {user: currentAuthUser}} = await supabase.auth.getUser(); 
        if (currentAuthUser?.id === authUserId) { 
             const { error: passwordUpdateError } = await supabase.auth.updateUser({ password: passwordInput });
             if (passwordUpdateError) {
                console.error('Supabase updateUser (self) password error:', passwordUpdateError);
                throw new Error(`Profile updated, but password update failed: ${passwordUpdateError.message}`);
            }
        } else {
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
      await supabase.auth.updateUser({ data: { full_name: data.full_name }});
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
    
    const updatedProfile = await authService.getUserProfile(authUserId);
    if (!updatedProfile) throw new Error('Failed to retrieve profile after update.');
    return updatedProfile;
  },

  deleteUser: async (userId: string, authUserId: string): Promise<void> => {
    const { data: directReports, error: reportError } = await supabase
        .from('users')
        .select('id', { count: 'exact' })
        .eq('parent_user_id', userId);

    if (reportError) throw reportError;
    if (directReports && directReports.length > 0) {
        throw new Error(`Cannot delete user: This user manages ${directReports.length} other user(s). Please reassign their reports first.`);
    }
    
    const { error: profileDeleteError } = await supabase.from('users').delete().eq('id', userId);
    if (profileDeleteError) throw profileDeleteError;
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

  bulkAddLeads: async (leadsData: ImportedLeadData[], orgId: string): Promise<{ successCount: number; errorCount: number; errorsDetails?: {row: number, leadName: string, error: string}[]}> => {
    const leadsToInsert = leadsData.map(ld => ({
        ...ld,
        org_id: orgId,
        status: ld.status || LeadStatus.NEW, // Default status if not provided/invalid
    }));

    const { data, error } = await supabase.from('leads').insert(leadsToInsert).select();
    
    if (error) {
      console.error("Bulk lead insert error:", error);
      // Attempt to provide more granular error feedback if possible
      if (error.message.includes("violates row-level security policy") || error.message.includes("permission denied")) {
         throw new Error("Permission denied. Please check your database policies.");
      }
      // Generic error if specific parsing isn't feasible
      throw new Error(`Bulk import failed: ${error.message}. Some records might have been partially inserted if the error occurred mid-batch.`);
    }
    return { successCount: data?.length || 0, errorCount: leadsData.length - (data?.length || 0) };
  },

  bulkUpdateLeadDetails: async (leadIds: string[], updates: Partial<{status: LeadStatus, owner_user_id: string | null}>, orgId: string ): Promise<void> => {
    const { error } = await supabase
        .from('leads')
        .update(updates)
        .in('id', leadIds)
        .eq('org_id', orgId); // Ensure org_id check for security
    if (error) throw error;
  }
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
    return (data || []).map(activity => {
        const userInfo = activity.user as unknown as { full_name: string } | null;
        return {
            ...activity,
            user_full_name: userInfo?.full_name || 'System',
            user: undefined, 
        } as LeadActivity;
    });
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
    return (data || []).map(item => {
        const userInfo = item.user as unknown as { full_name: string } | null;
        return {
            ...item,
            status: item.status as LeadFollowUpStatus,
            user_full_name: userInfo?.full_name || 'N/A',
            user: undefined, 
        } as LeadFollowUp;
    });
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
     return (data || []).map(item => {
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
    });
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
    const { error: updateContactsError } = await supabase
        .from('contacts')
        .update({ company_id: null }) 
        .eq('company_id', companyId);
    if (updateContactsError) console.error(`Error unlinking contacts from company ${companyId}:`, updateContactsError);

    const { error: updateLeadsError } = await supabase
        .from('leads')
        .update({ company_id: null, contact_id: null }) 
        .eq('company_id', companyId);
    if (updateLeadsError) console.error(`Error unlinking leads from company ${companyId}:`, updateLeadsError);
    
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
    const { error: updateLeadsError } = await supabase
        .from('leads')
        .update({ contact_id: null }) 
        .eq('contact_id', contactId);
    if (updateLeadsError) console.error(`Error unlinking leads from contact ${contactId}:`, updateLeadsError);
    
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
  getDeals: async (orgId: string, currentUserId: string, currentUserRole: Role): Promise<Deal[]> => {
     let query = supabase
        .from('deals')
        .select(`
          *, 
          created_by:users(full_name),
          company:companies(id, name),
          contact:contacts(id, first_name, last_name),
          lead:leads(id, name)
        `)
        .eq('org_id', orgId);

    // If user is not admin, filter by created_by_user_id (or other logic if needed)
    // This example assumes non-admins see only their own deals. Adjust as per requirements.
    if (currentUserRole !== Role.ADMIN) {
        query = query.eq('created_by_user_id', currentUserId);
    }
    
    query = query.order('created_at', { ascending: false });

    const { data: dealsData, error: dealsError } = await query;

    if (dealsError) throw dealsError;
    if (!dealsData) return [];

    const dealsWithItems = await Promise.all(
        dealsData.map(async (deal) => {
            const { data: itemsData, error: itemsError } = await supabase
                .from('deal_items')
                .select('*, product:products(name)') 
                .eq('deal_id', deal.id);

            if (itemsError) console.error(`Error fetching items for deal ${deal.id}:`, itemsError);
            
            const createdByUserInfo = deal.created_by as unknown as { full_name: string } | null;
            const companyInfo = deal.company as unknown as { id: string, name: string } | null;
            const contactInfo = deal.contact as unknown as { id: string, first_name: string, last_name: string } | null;
            const leadInfo = deal.lead as unknown as { id: string, name: string } | null;

            return {
                ...deal,
                status: deal.status as DealStatus,
                created_by_user_name: createdByUserInfo?.full_name || 'N/A',
                company_name: companyInfo?.name || undefined,
                contact_name: contactInfo ? `${contactInfo.first_name} ${contactInfo.last_name}` : undefined,
                lead_name: leadInfo?.name || undefined,
                created_by: undefined, 
                company: undefined,
                contact: undefined,
                lead: undefined,
                items: (itemsData || []).map(item => {
                    const productInfo = item.product as unknown as { name: string } | null;
                    return {
                        ...item,
                        product_name: productInfo?.name || 'Unknown Product',
                        product: undefined, 
                    } as DealItem;
                }),
            } as Deal;
        })
    );
    return dealsWithItems;
  },
  getDealsForLead: async (leadId: string, orgId: string): Promise<Deal[]> => {
    const { data: dealsData, error: dealsError } = await supabase
        .from('deals')
        .select(`
          *, 
          created_by:users(full_name),
          company:companies(id, name),
          contact:contacts(id, first_name, last_name),
          lead:leads(id,name) 
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
            
            const createdByUserInfo = deal.created_by as unknown as { full_name: string } | null;
            const companyInfo = deal.company as unknown as { id: string, name: string } | null;
            const contactInfo = deal.contact as unknown as { id: string, first_name: string, last_name: string } | null;
            const leadInfo = deal.lead as unknown as { id: string, name: string } | null;

            return {
                ...deal,
                status: deal.status as DealStatus,
                created_by_user_name: createdByUserInfo?.full_name || 'N/A',
                company_name: companyInfo?.name || undefined,
                contact_name: contactInfo ? `${contactInfo.first_name} ${contactInfo.last_name}` : undefined,
                lead_name: leadInfo?.name || undefined,
                created_by: undefined, 
                company: undefined,
                contact: undefined,
                lead: undefined,
                items: (itemsData || []).map(item => {
                    const productInfo = item.product as unknown as { name: string } | null;
                    return {
                        ...item,
                        product_name: productInfo?.name || 'Unknown Product',
                        product: undefined, 
                    } as DealItem;
                }),
            } as Deal;
        })
    );
    return dealsWithItems;
  },
  
  addDeal: async (
    dealData: Omit<Deal, 'id' | 'created_at' | 'updated_at' | 'org_id' | 'total_value' | 'items' | 'created_by_user_name' | 'created_by_user_id' | 'company_name' | 'contact_name' | 'lead_name'>, 
    itemsData: Pick<DealItem, 'product_id' | 'quantity' | 'unit_price'>[], 
    orgId: string,
    userId: string 
  ): Promise<Deal> => {
    
    const totalValue = itemsData.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
    const dealPayload: any = { 
      ...dealData, 
      org_id: orgId, 
      created_by_user_id: userId,
      total_value: totalValue,
    };
    if (dealData.company_id === '') dealPayload.company_id = null;
    if (dealData.contact_id === '') dealPayload.contact_id = null;


    const { data: newDeal, error: dealError } = await supabase
      .from('deals')
      .insert(dealPayload)
      .select(`
        *, 
        created_by:users(full_name),
        company:companies(id, name),
        contact:contacts(id, first_name, last_name),
        lead:leads(id,name)
      `)
      .single();

    if (dealError) throw dealError;
    if (!newDeal) throw new Error('Deal creation failed.');

    const dealItemsToInsert = itemsData.map(item => ({
      deal_id: newDeal.id,
      product_id: item.product_id,
      quantity: item.quantity,
      unit_price: item.unit_price,
      total_price: item.quantity * item.unit_price,
    }));

    if (dealItemsToInsert.length > 0) {
      const { error: itemsError } = await supabase.from('deal_items').insert(dealItemsToInsert);
      if (itemsError) {
        await supabase.from('deals').delete().eq('id', newDeal.id);
        console.error("Failed to insert deal items, rolled back deal creation:", itemsError);
        throw new Error(`Failed to add items to deal: ${itemsError.message}`);
      }
    }
    
    const createdByUserInfo = newDeal.created_by as unknown as { full_name: string } | null;
    const companyInfo = newDeal.company as unknown as { id: string, name: string } | null;
    const contactInfo = newDeal.contact as unknown as { id: string, first_name: string, last_name: string } | null;
    const leadInfo = newDeal.lead as unknown as { id: string, name: string } | null;

    return { 
        ...newDeal, 
        status: newDeal.status as DealStatus,
        created_by_user_name: createdByUserInfo?.full_name || 'N/A',
        company_name: companyInfo?.name || undefined,
        contact_name: contactInfo ? `${contactInfo.first_name} ${contactInfo.last_name}` : undefined,
        lead_name: leadInfo?.name || undefined,
        created_by: undefined,
        company: undefined,
        contact: undefined,
        lead: undefined,
        items: (await dealService.getDealItems(newDeal.id))
    };
  },

  updateDeal: async (
    dealId: string,
    dealData: Partial<Omit<Deal, 'id' | 'created_at' | 'updated_at' | 'org_id' | 'total_value' | 'items' | 'lead_id' | 'created_by_user_id' | 'created_by_user_name' | 'company_name' | 'contact_name' | 'lead_name'>>,
    itemsData: Pick<DealItem, 'product_id' | 'quantity' | 'unit_price'>[] 
  ): Promise<Deal> => {
    const totalValue = itemsData.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
    const dealPayload: any = { 
      ...dealData, 
      total_value: totalValue,
      updated_at: new Date().toISOString() 
    };
    if ('company_id' in dealData && dealData.company_id === '') dealPayload.company_id = null;
    if ('contact_id' in dealData && dealData.contact_id === '') dealPayload.contact_id = null;


    const { data: updatedDeal, error: dealError } = await supabase
      .from('deals')
      .update(dealPayload)
      .eq('id', dealId)
      .select(`
        *, 
        created_by:users(full_name),
        company:companies(id, name),
        contact:contacts(id, first_name, last_name),
        lead:leads(id,name)
      `)
      .single();

    if (dealError) throw dealError;
    if (!updatedDeal) throw new Error('Deal update failed.');

    const { error: deleteItemsError } = await supabase.from('deal_items').delete().eq('deal_id', dealId);
    if (deleteItemsError) throw new Error(`Failed to clear existing deal items: ${deleteItemsError.message}`);

    const dealItemsToInsert = itemsData.map(item => ({
      deal_id: dealId,
      product_id: item.product_id,
      quantity: item.quantity,
      unit_price: item.unit_price,
      total_price: item.quantity * item.unit_price,
    }));
    
    if (dealItemsToInsert.length > 0) {
      const { error: itemsError } = await supabase.from('deal_items').insert(dealItemsToInsert);
      if (itemsError) throw new Error(`Failed to update items for deal: ${itemsError.message}`);
    }
    
    const createdByUserInfo = updatedDeal.created_by as unknown as { full_name: string } | null;
    const companyInfo = updatedDeal.company as unknown as { id: string, name: string } | null;
    const contactInfo = updatedDeal.contact as unknown as { id: string, first_name: string, last_name: string } | null;
    const leadInfo = updatedDeal.lead as unknown as { id: string, name: string } | null;

    return { 
        ...updatedDeal, 
        status: updatedDeal.status as DealStatus,
        created_by_user_name: createdByUserInfo?.full_name || 'N/A',
        company_name: companyInfo?.name || undefined,
        contact_name: contactInfo ? `${contactInfo.first_name} ${contactInfo.last_name}` : undefined,
        lead_name: leadInfo?.name || undefined,
        created_by: undefined,
        company: undefined,
        contact: undefined,
        lead: undefined,
        items: (await dealService.getDealItems(updatedDeal.id)) 
    };
  },

  deleteDeal: async (dealId: string): Promise<void> => {
    const { error: itemError } = await supabase.from('deal_items').delete().eq('deal_id', dealId);
    if (itemError) {
      console.error(`Failed to delete items for deal ${dealId}:`, itemError);
    }
    const { error: dealError } = await supabase.from('deals').delete().eq('id', dealId);
    if (dealError) throw dealError;
  },

  deleteDealsForLead: async (leadId: string): Promise<void> => {
    const { data: deals, error: fetchError } = await supabase.from('deals').select('id').eq('lead_id', leadId);
    if (fetchError) {
        console.error(`Failed to fetch deals for lead ${leadId} before deletion:`, fetchError);
        return; 
    }
    if (deals && deals.length > 0) {
        for (const deal of deals) {
            await dealService.deleteDeal(deal.id); 
        }
    }
  },
  getDealItems: async (dealId: string): Promise<DealItem[]> => {
    const { data, error } = await supabase
        .from('deal_items')
        .select('*, product:products(name)')
        .eq('deal_id', dealId);
    if (error) {
        console.error(`Error fetching items for deal ${dealId}:`, error);
        return [];
    }
    return (data || []).map(item => {
        const productInfo = item.product as unknown as { name: string } | null;
        return {
            ...item,
            product_name: productInfo?.name || 'Unknown Product',
            product: undefined, 
        } as DealItem;
    });
  }
};


// --- Reports Service ---
export const reportService = {
  getLeadStats: async (orgId: string): Promise<SalesReportData> => {
    const { data: leadsData, error: leadsError } = await supabase
      .from('leads')
      .select('status, source')
      .eq('org_id', orgId);

    if (leadsError) {
      console.error("Error fetching leads for stats:", leadsError);
      throw leadsError;
    }

    const leads = leadsData || [];
    const leadsByStatusMap = new Map<LeadStatus, number>();
    leads.forEach(lead => {
      leadsByStatusMap.set(lead.status as LeadStatus, (leadsByStatusMap.get(lead.status as LeadStatus) || 0) + 1);
    });
    const leadsByStatus: LeadsByStatusReportItem[] = Array.from(leadsByStatusMap.entries()).map(([status, count]) => ({ status, count }));
    
    const leadsBySourceMap = new Map<string, number>();
    leads.forEach(lead => {
        const source = lead.source || 'Unknown';
        leadsBySourceMap.set(source, (leadsBySourceMap.get(source) || 0) + 1);
    });
    const leadsBySource: LeadsBySourceReportItem[] = Array.from(leadsBySourceMap.entries()).map(([source, count]) => ({ source, count }));

    const totalLeads = leads.length;
    const convertedLeadsCount = leadsByStatusMap.get(LeadStatus.CONVERTED) || 0;
    const lostLeadsCount = leadsByStatusMap.get(LeadStatus.LOST) || 0;
    const newLeadsCount = leadsByStatusMap.get(LeadStatus.NEW) || 0;
    const contactedLeadsCount = leadsByStatusMap.get(LeadStatus.CONTACTED) || 0;
    const qualifiedLeadsCount = leadsByStatusMap.get(LeadStatus.QUALIFIED) || 0;
    
    const relevantLeadsForConversion = totalLeads - newLeadsCount;
    const conversionRate = relevantLeadsForConversion > 0
        ? parseFloat(((convertedLeadsCount / relevantLeadsForConversion) * 100).toFixed(2))
        : 0;

    const { data: dealsData, error: dealsError } = await supabase
        .from('deals')
        .select('status, total_value')
        .eq('org_id', orgId);

    if (dealsError) {
        console.error("Error fetching deals for stats:", dealsError);
        throw dealsError;
    }
    const deals = dealsData || [];
    
    const dealsByStatusMap = new Map<DealStatus, { count: number, total_value: number }>();
    deals.forEach(deal => {
        const current = dealsByStatusMap.get(deal.status as DealStatus) || { count: 0, total_value: 0 };
        current.count += 1; 
        current.total_value += deal.total_value || 0; 
        dealsByStatusMap.set(deal.status as DealStatus, current);
    });
    
    let totalDeals = 0;
    let totalWonDealsValue = 0;
    const dealsByStatusResult: DealsByStatusReportItem[] = Array.from(dealsByStatusMap.entries()).map(([status, stats]) => {
        totalDeals += stats.count;
        if (status === DealStatus.WON) {
            totalWonDealsValue += stats.total_value;
        }
        return { status, ...stats };
    });
    
    return {
        totalLeads,
        convertedLeadsCount,
        lostLeadsCount,
        newLeadsCount,
        contactedLeadsCount,
        qualifiedLeadsCount,
        conversionRate,
        leadsByStatus,
        leadsBySource,
        totalDeals,
        totalWonDealsValue,
        dealsByStatus: dealsByStatusResult,
    };
  },

  getTaskDashboardStats: async (_orgId: string, _userId: string, _userRole: Role): Promise<TaskDashboardStats> => {
    console.warn("getTaskDashboardStats: RPC not implemented, returning default stats. Implement 'get_task_dashboard_stats' RPC in Supabase.");
    return {
        totalTasks: 0,
        openTasks: 0,
        overdueTasks: 0,
        tasksByStatus: TASK_STATUS_OPTIONS.map((status: TaskStatus) => ({ status, count: 0 })),
        tasksByPriority: TASK_PRIORITY_OPTIONS.map((priority: TaskPriority) => ({ priority, count: 0 })),
    };
  },

  getDealPageReportData: async (_orgId: string, _userId: string, _userRole: Role): Promise<DealPageReportData> => {
    console.warn("getDealPageReportData: RPC not implemented, returning default data. Implement 'get_deal_page_report_data' RPC in Supabase.");
    return {
        totalDealsCount: 0,
        openDealsValue: 0,
        wonDealsValue: 0,
        avgWonDealSize: 0,
        dealsByStatus: DEAL_STATUS_OPTIONS.map((status: DealStatus) => ({ status, count: 0, total_value: 0 })),
    };
  }
};

// --- Task Service ---
export const taskService = {
  getTasks: async (orgId: string, currentUserId: string, currentUserRole: Role, _allOrgUsers: UserProfile[]): Promise<Task[]> => {
    let query = supabase
      .from('tasks')
      .select(`
        *, 
        assigned_to:assigned_to_user_id(full_name), 
        created_by:created_by_user_id(full_name),
        related_lead:related_lead_id(name),
        related_company:related_company_id(name),
        related_contact:related_contact_id(first_name, last_name)
      `)
      .eq('org_id', orgId);

    if (currentUserRole !== Role.ADMIN) {
      query = query.or(`assigned_to_user_id.eq.${currentUserId},created_by_user_id.eq.${currentUserId}`);
    }
    
    query = query.order('due_date', { ascending: true, nullsFirst: false }).order('created_at', { ascending: false });

    const { data, error } = await query;
    if (error) throw error;

    return (data || []).map(task => {
      const assignedToUser = task.assigned_to as unknown as { full_name: string } | null;
      const createdByUser = task.created_by as unknown as { full_name: string } | null;
      const relatedLead = task.related_lead as unknown as { name: string } | null;
      const relatedCompany = task.related_company as unknown as { name: string } | null;
      const relatedContact = task.related_contact as unknown as { first_name: string, last_name: string } | null;
      
      return {
        ...task,
        status: task.status as TaskStatus,
        priority: task.priority as TaskPriority,
        assigned_to_user_name: assignedToUser?.full_name || 'N/A',
        created_by_user_name: createdByUser?.full_name || 'N/A',
        related_lead_name: relatedLead?.name || undefined,
        related_company_name: relatedCompany?.name || undefined,
        related_contact_name: relatedContact ? `${relatedContact.first_name} ${relatedContact.last_name}` : undefined,
        assigned_to: undefined,
        created_by: undefined,
        related_lead: undefined,
        related_company: undefined,
        related_contact: undefined,
      } as Task;
    });
  },

  addTask: async (taskData: Omit<Task, 'id' | 'created_at' | 'updated_at' | 'org_id' | 'created_by_user_id' | 'created_by_user_name' | 'assigned_to_user_name' | 'comments' | 'related_lead_name' | 'related_company_name' | 'related_contact_name'>, orgId: string, createdByUserId: string): Promise<Task> => {
    const payload = { 
        ...taskData, 
        org_id: orgId, 
        created_by_user_id: createdByUserId,
        related_lead_id: taskData.related_lead_id || null,
        related_company_id: taskData.related_company_id || null,
        related_contact_id: taskData.related_contact_id || null,
        due_date: taskData.due_date ? new Date(taskData.due_date).toISOString() : null,
    };
    const { data, error } = await supabase.from('tasks').insert(payload).select().single();
    if (error) throw error;
    if (!data) throw new Error('Task creation failed.');
    return this.getTaskDetails(data.id, orgId); // Use orgId passed to function
  },

  updateTask: async (taskId: string, taskData: Partial<Omit<Task, 'id' | 'created_at' | 'updated_at' | 'org_id' | 'created_by_user_id' | 'created_by_user_name' | 'assigned_to_user_name' | 'comments' | 'related_lead_name' | 'related_company_name' | 'related_contact_name'>>): Promise<Task> => {
    const payload: any = { ...taskData, updated_at: new Date().toISOString() };
    if (taskData.hasOwnProperty('related_lead_id')) payload.related_lead_id = taskData.related_lead_id || null;
    if (taskData.hasOwnProperty('related_company_id')) payload.related_company_id = taskData.related_company_id || null;
    if (taskData.hasOwnProperty('related_contact_id')) payload.related_contact_id = taskData.related_contact_id || null;
    if (taskData.due_date) payload.due_date = new Date(taskData.due_date).toISOString();
    else if (taskData.hasOwnProperty('due_date') && taskData.due_date === null) payload.due_date = null;

    const { data, error } = await supabase.from('tasks').update(payload).eq('id', taskId).select().single();
    if (error) throw error;
    if (!data) throw new Error('Task update failed.');
    if (!data.org_id) throw new Error('Organization ID missing from updated task data.'); // Should not happen
    return this.getTaskDetails(data.id, data.org_id);
  },

  deleteTask: async (taskId: string): Promise<void> => {
    await supabase.from('task_comments').delete().eq('task_id', taskId);
    const { error } = await supabase.from('tasks').delete().eq('id', taskId);
    if (error) throw error;
  },

  getTaskDetails: async (taskId: string, orgId: string): Promise<Task> => {
    const { data, error } = await supabase
      .from('tasks')
      .select(`
        *, 
        assigned_to:assigned_to_user_id(full_name), 
        created_by:created_by_user_id(full_name),
        related_lead:related_lead_id(name),
        related_company:related_company_id(name),
        related_contact:related_contact_id(first_name, last_name)
      `)
      .eq('id', taskId)
      .eq('org_id', orgId)
      .single();
    if (error) throw error;
    if (!data) throw new Error('Task not found.');

    const assignedToUser = data.assigned_to as unknown as { full_name: string } | null;
    const createdByUser = data.created_by as unknown as { full_name: string } | null;
    const relatedLead = data.related_lead as unknown as { name: string } | null;
    const relatedCompany = data.related_company as unknown as { name: string } | null;
    const relatedContact = data.related_contact as unknown as { first_name: string, last_name: string } | null;

    return {
      ...data,
      status: data.status as TaskStatus,
      priority: data.priority as TaskPriority,
      assigned_to_user_name: assignedToUser?.full_name || 'N/A',
      created_by_user_name: createdByUser?.full_name || 'N/A',
      related_lead_name: relatedLead?.name || undefined,
      related_company_name: relatedCompany?.name || undefined,
      related_contact_name: relatedContact ? `${relatedContact.first_name} ${relatedContact.last_name}` : undefined,
      assigned_to: undefined, created_by: undefined, related_lead: undefined, related_company: undefined, related_contact: undefined,
    } as Task;
  },

  getTaskComments: async (taskId: string, _orgId: string): Promise<TaskComment[]> => {
    const { data, error } = await supabase
      .from('task_comments')
      .select('*, user:user_id(full_name)')
      .eq('task_id', taskId)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return (data || []).map(comment => ({
      ...comment,
      user_full_name: (comment.user as any)?.full_name || 'User',
      user: undefined,
    }));
  },

  addTaskComment: async (commentData: Omit<TaskComment, 'id' | 'created_at' | 'user_full_name'>, _orgId: string, userId: string): Promise<TaskComment> => {
    const payload = { ...commentData, user_id: userId };
    const { data, error } = await supabase.from('task_comments').insert(payload).select('*, user:user_id(full_name)').single();
    if (error) throw error;
    if (!data) throw new Error('Failed to add comment.');
    return { ...data, user_full_name: (data.user as any)?.full_name || 'User', user: undefined };
  },
};

// --- Ticket Service ---
export const ticketService = {
    getTickets: async (orgId: string, currentUserId: string, currentUserRole: Role): Promise<Ticket[]> => {
        let query = supabase
            .from('tickets')
            .select(`*, assigned_to:assigned_to_user_id(full_name), created_by:created_by_user_id(full_name)`)
            .eq('org_id', orgId);

        if (currentUserRole !== Role.ADMIN) {
            query = query.or(`assigned_to_user_id.eq.${currentUserId},created_by_user_id.eq.${currentUserId}`);
        }
        query = query.order('updated_at', { ascending: false });
        const { data, error } = await query;
        if (error) throw error;
        return (data || []).map(ticket => ({
            ...ticket,
            status: ticket.status as TicketStatus,
            priority: ticket.priority as TicketPriority,
            assigned_to_user_name: (ticket.assigned_to as any)?.full_name || 'Unassigned',
            created_by_user_name: (ticket.created_by as any)?.full_name || 'N/A',
            assigned_to: undefined,
            created_by: undefined,
        }));
    },
    
    addTicket: async (ticketData: Omit<Ticket, 'id' | 'ticket_uid' | 'created_at' | 'updated_at' | 'org_id' | 'created_by_user_id' | 'created_by_user_name' | 'assigned_to_user_name' | 'resolved_at' | 'closed_at'>, orgId: string, createdByUserId: string): Promise<Ticket> => {
        const ticket_uid = `TCK-${new Date().getFullYear()}-${String(Math.random().toString(36).substr(2, 5)).toUpperCase()}`;
        const payload = { 
            ...ticketData, 
            ticket_uid,
            org_id: orgId, 
            created_by_user_id: createdByUserId,
            assigned_to_user_id: ticketData.assigned_to_user_id || null,
        };
        const { data, error } = await supabase.from('tickets').insert(payload).select().single();
        if (error) throw error;
        if (!data) throw new Error("Ticket creation failed.");
        return this.getTicketDetails(data.id, orgId);
    },

    updateTicket: async (
        ticketId: string, 
        updates: Partial<Omit<Ticket, 'id' | 'ticket_uid' | 'created_at' | 'updated_at' | 'org_id' | 'created_by_user_id' | 'created_by_user_name' | 'assigned_to_user_name'>>, 
        originalTicket: Ticket
    ): Promise<Ticket> => {
        const payload: any = { ...updates, updated_at: new Date().toISOString() };
        
        if (updates.status && updates.status !== originalTicket.status) {
            if (updates.status === TicketStatus.RESOLVED) {
                payload.resolved_at = (updates as Ticket).resolved_at || new Date().toISOString(); // Use passed value or set new
                payload.closed_at = (updates as Ticket).status === TicketStatus.CLOSED ? ((updates as Ticket).closed_at || new Date().toISOString()) : null; // If also closing, set closed_at
            } else if (updates.status === TicketStatus.CLOSED) {
                payload.closed_at = (updates as Ticket).closed_at || new Date().toISOString();
                // If original was not resolved, and we are closing, also set resolved_at
                if (originalTicket.status !== TicketStatus.RESOLVED) {
                    payload.resolved_at = (updates as Ticket).resolved_at || new Date().toISOString();
                }
            } else { // For OPEN, IN_PROGRESS, ON_HOLD
                payload.resolved_at = null;
                payload.closed_at = null;
            }
        } else { // Status not changing, but resolved_at or closed_at might be updated directly
             if (updates.hasOwnProperty('resolved_at')) {
                payload.resolved_at = (updates as Ticket).resolved_at;
            }
            if (updates.hasOwnProperty('closed_at')) {
                payload.closed_at = (updates as Ticket).closed_at;
            }
        }

         if (updates.hasOwnProperty('assigned_to_user_id')) {
            payload.assigned_to_user_id = (updates as Ticket).assigned_to_user_id || null;
        }

        const { data, error } = await supabase.from('tickets').update(payload).eq('id', ticketId).select().single();
        if (error) throw error;
        if (!data) throw new Error("Ticket update failed.");
        if (!data.org_id) throw new Error("Organization ID missing from updated ticket data.");
        return this.getTicketDetails(data.id, data.org_id);
    },

    deleteTicket: async (ticketId: string): Promise<void> => {
        const { error } = await supabase.from('tickets').delete().eq('id', ticketId);
        if (error) throw error;
    },

    getTicketDetails: async (ticketId: string, orgId: string): Promise<Ticket> => {
      const { data, error } = await supabase
        .from('tickets')
        .select('*, assigned_to:assigned_to_user_id(full_name), created_by:created_by_user_id(full_name)')
        .eq('id', ticketId)
        .eq('org_id', orgId)
        .single();
      if (error) throw error;
      if (!data) throw new Error('Ticket not found.');
      return {
        ...data,
        status: data.status as TicketStatus,
        priority: data.priority as TicketPriority,
        assigned_to_user_name: (data.assigned_to as any)?.full_name || 'Unassigned',
        created_by_user_name: (data.created_by as any)?.full_name || 'N/A',
        assigned_to: undefined,
        created_by: undefined,
      };
    },
};
