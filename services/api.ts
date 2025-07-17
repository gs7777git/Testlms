
import { createClient, Session, User as SupabaseAuthUser, PostgrestError } from '@supabase/supabase-js';
import { 
    UserProfile, Role, Lead, LeadStatus, Organization, LeadActivity, LeadFollowUp, 
    LeadFollowUpStatus, Product, Deal, DealStatus, DealItem, SalesReportData, 
    LeadsByStatusReportItem, LeadsBySourceReportItem, DealsByStatusReportItem, 
    Company, Contact, ImportedLeadData, DealPageReportData, Task, TaskComment, TaskDashboardStats,
    Ticket, TicketStatus, TicketPriority, TaskStatus, TaskPriority
} from '@/types';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/constants';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error("Supabase URL or Anon Key is undefined in api.ts. This should have been caught in constants.ts.");
}

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      organizations: {
        Row: Organization
        Insert: Omit<Organization, 'id' | 'created_at'>
        Update: Partial<Omit<Organization, 'id' | 'created_at'>>
      }
      users: {
        Row: UserProfile
        Insert: Omit<UserProfile, 'id' | 'created_at' | 'manager_name' | 'manages_users_count' | 'dashboard_widgets'>
        Update: Partial<Omit<UserProfile, 'id' | 'created_at' | 'auth_user_id' | 'org_id' | 'manager_name' | 'manages_users_count'>>
      }
      leads: {
        Row: Lead
        Insert: Omit<Lead, 'id' | 'created_at' | 'updated_at' | 'owner_name' | 'company_name' | 'contact_name' | 'activities' | 'follow_ups' | 'deals'>
        Update: Partial<Omit<Lead, 'id' | 'created_at' | 'updated_at' | 'owner_name' | 'company_name' | 'contact_name' | 'activities' | 'follow_ups' | 'deals' | 'org_id'>>
      }
      products: {
        Row: Product
        Insert: Omit<Product, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Product, 'id' | 'created_at' | 'updated_at' | 'org_id'>>
      }
      companies: {
          Row: Company
          Insert: Omit<Company, 'id' | 'created_at' | 'updated_at'>
          Update: Partial<Omit<Company, 'id' | 'created_at' | 'updated_at' | 'org_id'>>
      }
      contacts: {
          Row: Contact
          Insert: Omit<Contact, 'id' | 'created_at' | 'updated_at' | 'company_name'>
          Update: Partial<Omit<Contact, 'id' | 'created_at' | 'updated_at' | 'org_id' | 'company_name'>>
      }
      deals: {
          Row: Deal
          Insert: Omit<Deal, 'id' | 'created_at' | 'updated_at' | 'created_by_user_name' | 'company_name' | 'contact_name' | 'lead_name' | 'items'>
          Update: Partial<Omit<Deal, 'id' | 'created_at' | 'created_by_user_id' | 'created_by_user_name' | 'company_name' | 'contact_name' | 'lead_name' | 'items' | 'org_id' | 'lead_id'>>
      }
      deal_items: {
          Row: DealItem
          Insert: Omit<DealItem, 'id' | 'product_name' | 'created_at'>
          Update: Partial<Omit<DealItem, 'id' | 'deal_id' | 'product_name' | 'created_at'>>
      }
      lead_activities: {
          Row: LeadActivity
          Insert: Omit<LeadActivity, 'id' | 'created_at' | 'user_full_name'>
          Update: Partial<Omit<LeadActivity, 'id' | 'created_at' | 'user_full_name' | 'lead_id' | 'user_id' | 'org_id'>>
      }
      lead_follow_ups: {
          Row: LeadFollowUp
          Insert: Omit<LeadFollowUp, 'id' | 'created_at' | 'updated_at' | 'user_full_name' | 'completed_at'>
          Update: Partial<Omit<LeadFollowUp, 'id' | 'created_at' | 'user_full_name' | 'lead_id' | 'org_id'>>
      }
      tasks: {
          Row: Task
          Insert: Omit<Task, 'id' | 'created_at' | 'updated_at' | 'assigned_to_user_name' | 'created_by_user_name' | 'related_lead_name' | 'related_company_name' | 'related_contact_name' | 'comments'>
          Update: Partial<Omit<Task, 'id' | 'created_at' | 'updated_at' | 'org_id' | 'created_by_user_id' | 'assigned_to_user_name' | 'created_by_user_name' | 'related_lead_name' | 'related_company_name' | 'related_contact_name' | 'comments'>>
      }
      task_comments: {
          Row: TaskComment
          Insert: Omit<TaskComment, 'id' | 'created_at' | 'user_full_name'>
          Update: Partial<Omit<TaskComment, 'id' | 'created_at' | 'user_full_name' | 'task_id' | 'user_id' | 'org_id'>>
      }
      tickets: {
          Row: Ticket
          Insert: Omit<Ticket, 'id' | 'ticket_uid' | 'created_at' | 'updated_at' | 'created_by_user_name' | 'assigned_to_user_name' | 'resolved_at' | 'closed_at'>
          Update: Partial<Omit<Ticket, 'id' | 'ticket_uid' | 'created_at' | 'org_id' | 'created_by_user_id' | 'created_by_user_name' | 'assigned_to_user_name'>>
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
        get_users_with_manager_and_report_count: {
            Args: { p_org_id: string }
            Returns: UserProfile[]
        }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}


export const supabase = createClient<Database>(SUPABASE_URL!, SUPABASE_ANON_KEY!);

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
      await supabase.auth.signOut(); // Sign out if profile is missing
      throw new Error('Login failed: User profile not found.');
    }
    return { session: data.session, authUser: data.user, profile };
  },

  registerAdminAndOrganization: async (registrationData: AdminRegistrationData): Promise<{ authUser: SupabaseAuthUser, organization: Organization, profile: UserProfile }> => {
    const { data: authData, error: signUpError } = await supabase.auth.signUp({
      email: registrationData.email,
      password: registrationData.passwordInput,
    });

    if (signUpError) throw signUpError;
    if (!authData.user) throw new Error('Admin registration failed: No auth user data returned.');

    try {
      const { data: orgData, error: orgError } = await supabase
        .from('organizations')
        .insert({ name: registrationData.organizationName })
        .select()
        .single();

      if (orgError) throw orgError;
      if (!orgData) throw new Error('Organization creation failed.');
      const createdOrganization = orgData as Organization;

      const userProfilePayload: Database['public']['Tables']['users']['Insert'] = {
        auth_user_id: authData.user.id,
        email: authData.user.email!,
        full_name: registrationData.fullName,
        role: Role.ADMIN,
        org_id: createdOrganization.id,
      };

      const { data: profileData, error: profileError } = await supabase
        .from('users')
        .insert(userProfilePayload)
        .select()
        .single();

      if (profileError) throw profileError;
      if (!profileData) throw new Error('User profile creation failed.');
      
      const userProfileWithRole: UserProfile = { ...(profileData as UserProfile), role: profileData.role as Role };
      return { authUser: authData.user, organization: createdOrganization, profile: userProfileWithRole };

    } catch (error) {
      console.error("Error during admin registration, attempting cleanup of auth user:", error);
      throw error;
    }
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
    }
    if (!data) return null;
    const { manager, ...profileData } = data as any;
    const managerInfo = manager as { full_name: string } | null;
    return { 
      ...(profileData as UserProfile), 
      role: profileData.role as Role, 
      manager_name: managerInfo?.full_name || null 
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
        .rpc('get_users_with_manager_and_report_count', { p_org_id: orgId });

    if (error) {
        console.error("Error calling RPC get_users_with_manager_and_report_count:", error);
        throw error;
    }
    
    return ((data as any) || []) as UserProfile[];
  },

  addUser: async (userData: { email: string; passwordInput: string; full_name: string; role: Role; role_name?: string | null; parent_user_id?: string | null }, adminOrgId: string): Promise<UserProfile> => {
    const { data: authData, error: signUpError } = await supabase.auth.signUp({
      email: userData.email,
      password: userData.passwordInput,
    });
    if (signUpError) throw signUpError;
    if (!authData.user) throw new Error('User creation failed: No auth user data.');

    const newUserProfileData: Database['public']['Tables']['users']['Insert'] = {
      auth_user_id: authData.user.id,
      email: userData.email,
      full_name: userData.full_name,
      role: userData.role,
      role_name: userData.role_name || null,
      parent_user_id: userData.parent_user_id || null,
      org_id: adminOrgId,
    };
    const { data: profileData, error: profileError } = await supabase
      .from('users')
      .insert(newUserProfileData)
      .select()
      .single();
    if (profileError) {
      console.error('Profile creation failed, auth user might be orphaned:', profileError);
      throw profileError;
    }
    if (!profileData) throw new Error('User profile creation failed: No profile data.');
    return { ...(profileData as UserProfile), role: profileData.role as Role };
  },

  updateUser: async (
    userId: string, 
    userData: Partial<{ full_name: string; role: Role; role_name: string | null, parent_user_id: string | null }>,
    authUserId?: string, 
    passwordInput?: string
  ): Promise<UserProfile> => {
    const { data: updatedProfile, error: profileUpdateError } = await supabase
      .from('users')
      .update(userData)
      .eq('id', userId)
      .select()
      .single();

    if (profileUpdateError) throw profileUpdateError;
    if (!updatedProfile) throw new Error('User profile update failed.');

    if (passwordInput && authUserId) {
        const {data: {user: currentAuthUser}} = await supabase.auth.getUser(); 
        if (currentAuthUser?.id === authUserId) { 
             const { error: passwordUpdateError } = await supabase.auth.updateUser({ password: passwordInput });
             if (passwordUpdateError) {
                console.error('Supabase updateUser (self) password error:', passwordUpdateError);
                throw new Error(`Profile updated, but password update failed: ${passwordUpdateError.message}`);
            }
        } else {
            console.warn("Attempting to update another user's password from client-side using supabase.auth.updateUser(). This is for the CURRENT user. To update OTHER users' passwords, a backend function with service_role using admin.updateUserById() is required.");
        }
    }
    return { ...(updatedProfile as UserProfile), role: updatedProfile.role as Role };
  },
  
  updateCurrentAuthUser: async (authUserId: string, data: { full_name?: string, passwordInput?: string }): Promise<UserProfile> => {
    if (data.passwordInput) {
      const { error: passwordError } = await supabase.auth.updateUser({ password: data.passwordInput });
      if (passwordError) throw new Error(`Password update failed: ${passwordError.message}`);
    }

    if (data.full_name) {
       await supabase.auth.updateUser({
        data: { full_name: data.full_name } 
      });

      const { data: profile, error: profileError } = await supabase
        .from('users')
        .update({ full_name: data.full_name })
        .eq('auth_user_id', authUserId)
        .select()
        .single();
      if (profileError) throw new Error(`Profile name update in 'users' table failed: ${profileError.message}`);
      if (!profile) throw new Error('Failed to retrieve updated profile from users table.');
      return { ...(profile as UserProfile), role: profile.role as Role };
    }
    
    const updatedProfile = await authService.getUserProfile(authUserId);
    if (!updatedProfile) throw new Error('Failed to retrieve profile after update.');
    return updatedProfile;
  },

  deleteUser: async (userId: string, authUserId: string): Promise<void> => {
    // Reassign direct reports before deleting
    await supabase.from('users').update({ parent_user_id: null }).eq('parent_user_id', userId);

    const { error: profileDeleteError } = await supabase.from('users').delete().eq('id', userId);
    if (profileDeleteError) throw profileDeleteError;
    console.warn(`User profile ${userId} deleted. Auth user ${authUserId} deletion must be handled by a backend function with service_role (e.g., using supabase.auth.admin.deleteUser()).`);
  },
};

// --- Lead Service ---
export const leadService = {
  getLeads: async (orgId: string): Promise<Lead[]> => {
    const { data, error } = await supabase
      .from('leads')
      .select(`
        *, 
        owner:users(id, full_name),
        company:companies(id, name),
        contact:contacts(id, first_name, last_name)
      `)
      .eq('org_id', orgId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data?.map(lead => {
      const { owner, company, contact, ...leadData } = lead as any;
      return {
        ...leadData,
        status: lead.status as LeadStatus,
        owner_name: owner?.full_name || 'Unassigned',
        owner_user_id: owner?.id || null,
        company_name: company?.name || undefined,
        contact_name: contact ? `${contact.first_name} ${contact.last_name}` : undefined,
      } as Lead;
    }) || [];
  },

  getLeadDetails: async (leadId: string, orgId: string): Promise<Lead | null> => {
     const { data, error } = await supabase
      .from('leads')
      .select(`
        *, 
        owner:users(id, full_name),
        company:companies(id, name),
        contact:contacts(id, first_name, last_name)
      `)
      .eq('id', leadId)
      .eq('org_id', orgId)
      .single();

    if (error) {
        if ((error as PostgrestError).code === 'PGRST116') return null;
        throw error;
    }
    if (!data) return null;
    const { owner, company, contact, ...leadData } = data as any;
    return {
        ...leadData,
        status: data.status as LeadStatus,
        owner_name: owner?.full_name || 'Unassigned',
        owner_user_id: owner?.id || null,
        company_name: company?.name || undefined,
        contact_name: contact ? `${contact.first_name} ${contact.last_name}` : undefined,
    } as Lead;
  },

  addLead: async (leadData: Omit<Lead, 'id' | 'created_at' | 'updated_at' | 'owner_name' | 'company_name' | 'contact_name' | 'org_id' | 'activities' | 'follow_ups' | 'deals'>, orgId: string): Promise<Lead> => {
    const payload: Database['public']['Tables']['leads']['Insert'] = { ...leadData, org_id: orgId };
    if (payload.owner_user_id === '') payload.owner_user_id = null;
    if (payload.company_id === '') payload.company_id = null;
    if (payload.contact_id === '') payload.contact_id = null;


    const { data, error } = await supabase
      .from('leads')
      .insert(payload)
      .select(`
        *, 
        owner:users(id, full_name),
        company:companies(id, name),
        contact:contacts(id, first_name, last_name)
      `)
      .single();
    if (error) throw error;
    if (!data) throw new Error('Lead creation failed.');
    
    const { owner, company, contact, ...leadRow } = data as any;
    return {
      ...leadRow,
      status: data.status as LeadStatus,
      owner_name: owner?.full_name || 'Unassigned',
      owner_user_id: owner?.id || null,
      company_name: company?.name || undefined,
      contact_name: contact ? `${contact.first_name} ${contact.last_name}` : undefined,
    } as Lead;
  },

  updateLead: async (leadId: string, leadData: Partial<Omit<Lead, 'id' | 'created_at' | 'updated_at' | 'owner_name' | 'company_name' | 'contact_name' | 'org_id' | 'activities' | 'follow_ups' | 'deals'>>): Promise<Lead> => {
    const payload: Database['public']['Tables']['leads']['Update'] = { ...leadData };
    if ('owner_user_id' in payload && (payload.owner_user_id === '' || payload.owner_user_id === undefined)) {
        payload.owner_user_id = null;
    }
    if ('company_id' in payload && (payload.company_id === '' || payload.company_id === undefined)) {
        payload.company_id = null;
    }
    if ('contact_id' in payload && (payload.contact_id === '' || payload.contact_id === undefined)) {
        payload.contact_id = null;
    }

    const { data, error } = await supabase
      .from('leads')
      .update(payload)
      .eq('id', leadId)
      .select(`
        *, 
        owner:users(id, full_name),
        company:companies(id, name),
        contact:contacts(id, first_name, last_name)
      `)
      .single();
    if (error) throw error;
    if (!data) throw new Error('Lead update failed.');

    const { owner, company, contact, ...leadRow } = data as any;
    return {
      ...leadRow,
      status: data.status as LeadStatus,
      owner_name: owner?.full_name || 'Unassigned',
      owner_user_id: owner?.id || null,
      company_name: company?.name || undefined,
      contact_name: contact ? `${contact.first_name} ${contact.last_name}` : undefined,
    } as Lead;
  },

  deleteLead: async (leadId: string): Promise<void> => {
    await leadActivityService.deleteActivitiesForLead(leadId);
    await leadFollowUpService.deleteFollowUpsForLead(leadId);
    await dealService.deleteDealsForLead(leadId); 

    const { error } = await supabase.from('leads').delete().eq('id', leadId);
    if (error) throw error;
  },
  
  bulkAddLeads: async (leads: ImportedLeadData[], orgId: string): Promise<{ successCount: number; errorCount: number; errorsDetails?: {row: number, leadName: string, error: string}[] }> => {
    const leadsToInsert = leads.map(l => ({
        ...l,
        org_id: orgId,
        status: l.status || LeadStatus.NEW // Default status if not provided
    }));
    
    const { data, error } = await supabase
      .from('leads')
      .insert(leadsToInsert)
      .select();

    if (error) {
      console.error("Bulk add leads error:", error);
      const detail = (error as PostgrestError).details;
      return { successCount: 0, errorCount: leads.length, errorsDetails: [{ row: 0, leadName: 'All', error: detail || error.message }] };
    }
    
    const successCount = data?.length || 0;
    const errorCount = leads.length - successCount;

    return { successCount, errorCount };
  },

  bulkUpdateLeadDetails: async (leadIds: string[], updates: Partial<{ status: LeadStatus; owner_user_id: string | null }>, orgId: string): Promise<void> => {
    const { error } = await supabase
        .from('leads')
        .update(updates)
        .in('id', leadIds)
        .eq('org_id', orgId); 
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
    return data?.map(activity => {
        const { user, ...activityData } = activity as any;
        return {
            ...activityData,
            user_full_name: user?.full_name || 'System',
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
    const { user, ...activityRow } = data as any;
    return {
        ...activityRow,
        user_full_name: user?.full_name || 'System',
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
        const { user, ...followUpData } = item as any;
        return {
            ...followUpData,
            status: item.status as LeadFollowUpStatus,
            user_full_name: user?.full_name || 'N/A',
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
        const { user, lead, ...followUpData } = item as any;
        return {
            ...followUpData,
            status: item.status as LeadFollowUpStatus,
            user_full_name: user?.full_name || 'N/A',
            lead_name: lead?.name || 'N/A', 
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
    const { user, ...followUpRow } = data as any;
    return {
        ...followUpRow,
        status: data.status as LeadFollowUpStatus,
        user_full_name: user?.full_name || 'N/A',
    } as LeadFollowUp;
  },

  updateFollowUp: async (
    followUpId: string,
    updateData: Partial<Pick<LeadFollowUp, 'due_date' | 'notes' | 'status' | 'completed_at' | 'user_id' | 'updated_at'>>
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
    const { user, ...followUpRow } = data as any;
    return {
        ...followUpRow,
        status: data.status as LeadFollowUpStatus,
        user_full_name: user?.full_name || 'N/A',
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
    const payload: Database['public']['Tables']['products']['Update'] = { ...productData, updated_at: new Date().toISOString() };
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
    const payload: Database['public']['Tables']['companies']['Update'] = { ...companyData, updated_at: new Date().toISOString() };
    const { data, error } = await supabase.from('companies').update(payload).eq('id', companyId).select().single();
    if (error) throw error;
    if (!data) throw new Error('Company update failed.');
    return data;
  },
  deleteCompany: async (companyId: string): Promise<void> => {
    await supabase
        .from('contacts')
        .update({ company_id: null })
        .eq('company_id', companyId);

    await supabase
        .from('leads')
        .update({ company_id: null, contact_id: null })
        .eq('company_id', companyId);
    
    await supabase
        .from('deals')
        .update({ company_id: null, contact_id: null })
        .eq('company_id', companyId);

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
        const { company, ...contactRow } = contact as any;
        return {
            ...contactRow,
            company_name: company?.name || 'N/A',
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
        const { company, ...contactRow } = contact as any;
        return {
            ...contactRow,
            company_name: company?.name || 'N/A',
        }
    });
  },
  addContact: async (contactData: Omit<Contact, 'id' | 'created_at' | 'updated_at' | 'org_id' | 'company_name'>, orgId: string): Promise<Contact> => {
    const payload = { ...contactData, org_id: orgId };
    const { data, error } = await supabase.from('contacts').insert(payload).select('*, company:companies(name)').single();
    if (error) throw error;
    if (!data) throw new Error('Contact creation failed.');
    const { company, ...contactRow } = data as any;
    return {...contactRow, company_name: company?.name || "N/A"};
  },
  updateContact: async (contactId: string, contactData: Partial<Omit<Contact, 'id' | 'created_at' | 'updated_at' | 'org_id' | 'company_name'>>): Promise<Contact> => {
    const payload: Database['public']['Tables']['contacts']['Update'] = { ...contactData, updated_at: new Date().toISOString() };
    const { data, error } = await supabase.from('contacts').update(payload).eq('id', contactId).select('*, company:companies(name)').single();
    if (error) throw error;
    if (!data) throw new Error('Contact update failed.');
    const { company, ...contactRow } = data as any;
    return {...contactRow, company_name: company?.name || "N/A"};
  },
  deleteContact: async (contactId: string): Promise<void> => {
    await supabase
        .from('leads')
        .update({ contact_id: null }) 
        .eq('contact_id', contactId);
    
    await supabase
        .from('deals')
        .update({ contact_id: null })
        .eq('contact_id', contactId);

    const { error } = await supabase.from('contacts').delete().eq('id', contactId);
    if (error) throw error;
  },
};


// --- Deal Service ---
export const dealService = {
  getDeals: async(orgId: string, userId: string, userRole: Role): Promise<Deal[]> => {
    let query = supabase.from('deals')
        .select(`*, created_by:users(full_name), company:companies(id, name), contact:contacts(id, first_name, last_name), lead:leads(id, name)`)
        .eq('org_id', orgId);

    if (userRole !== Role.ADMIN) {
      query = query.eq('created_by_user_id', userId);
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
            
            const { created_by, company, contact, lead, ...dealRow } = deal as any;
            
            return {
                ...dealRow,
                status: deal.status as DealStatus,
                created_by_user_name: created_by?.full_name || 'N/A',
                company_name: company?.name || undefined,
                contact_name: contact ? `${contact.first_name} ${contact.last_name}` : undefined,
                lead_name: lead?.name || undefined,
                items: (itemsData || []).map(item => {
                    const { product, ...itemRow } = item as any;
                    return { ...itemRow, product_name: product?.name || 'Unknown Product' } as DealItem;
                }),
            } as Deal;
        })
    );
    return dealsWithItems;
  },
  getDealsForLead: async (leadId: string, orgId: string): Promise<Deal[]> => {
    return dealService.getDeals(orgId, '', Role.ADMIN).then(allDeals => allDeals.filter(d => d.lead_id === leadId));
  },
  
  addDeal: async (
    dealData: Omit<Deal, 'id' | 'created_at' | 'updated_at' | 'org_id' | 'total_value' | 'items' | 'created_by_user_name' | 'created_by_user_id' | 'company_name' | 'contact_name' | 'lead_name'> & {lead_id: string}, 
    itemsData: Pick<DealItem, 'product_id' | 'quantity' | 'unit_price'>[], 
    orgId: string,
    userId: string 
  ): Promise<Deal> => {
    
    const totalValue = itemsData.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
    const dealPayload: Database['public']['Tables']['deals']['Insert'] = { 
      ...dealData, 
      org_id: orgId, 
      created_by_user_id: userId,
      total_value: totalValue,
    };
     if (dealPayload.company_id === '') dealPayload.company_id = null;
    if (dealPayload.contact_id === '') dealPayload.contact_id = null;


    const { data: newDeal, error: dealError } = await supabase
      .from('deals')
      .insert(dealPayload)
      .select(`*, created_by:users(full_name), company:companies(id, name), contact:contacts(id, first_name, last_name)`)
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
    
    const { created_by, company, contact, ...dealRow } = newDeal as any;

    return { 
        ...(dealRow as Deal),
        status: newDeal.status as DealStatus,
        created_by_user_name: created_by?.full_name || 'N/A',
        company_name: company?.name || undefined,
        contact_name: contact ? `${contact.first_name} ${contact.last_name}` : undefined,
        items: (await dealService.getDealItems(newDeal.id))
    };
  },

  updateDeal: async (
    dealId: string,
    dealData: Partial<Omit<Deal, 'id' | 'created_at' | 'updated_at' | 'org_id' | 'total_value' | 'items' | 'lead_id' | 'created_by_user_id' | 'created_by_user_name' | 'company_name' | 'contact_name' | 'lead_name'>>,
    itemsData: Pick<DealItem, 'product_id' | 'quantity' | 'unit_price'>[] 
  ): Promise<Deal> => {
    const totalValue = itemsData.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
    const dealPayload: Database['public']['Tables']['deals']['Update'] = { ...dealData, total_value: totalValue, updated_at: new Date().toISOString() };
    if ('company_id' in dealPayload && dealPayload.company_id === '') dealPayload.company_id = null;
    if ('contact_id' in dealPayload && dealPayload.contact_id === '') dealPayload.contact_id = null;

    const { data: updatedDeal, error: dealError } = await supabase
      .from('deals')
      .update(dealPayload)
      .eq('id', dealId)
      .select(`*, created_by:users(full_name), company:companies(id, name), contact:contacts(id, first_name, last_name)`)
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
    
    const { created_by, company, contact, ...dealRow } = updatedDeal as any;

    return { 
        ...(dealRow as Deal),
        status: updatedDeal.status as DealStatus,
        created_by_user_name: created_by?.full_name || 'N/A',
        company_name: company?.name || undefined,
        contact_name: contact ? `${contact.first_name} ${contact.last_name}` : undefined,
        items: (await dealService.getDealItems(updatedDeal.id)) 
    };
  },

  deleteDeal: async (dealId: string): Promise<void> => {
    const { error: itemError } = await supabase.from('deal_items').delete().eq('deal_id', dealId);
    if (itemError) console.error(`Failed to delete items for deal ${dealId}:`, itemError);
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
        const { product, ...itemRow } = item as any;
        return { ...itemRow, product_name: product?.name || 'Unknown Product' } as DealItem;
    });
  }
};


// --- Reports Service ---
export const reportService = {
  getLeadStats: async (orgId: string): Promise<SalesReportData> => {
    const { data: allLeads, error: leadsError } = await supabase.from('leads').select('status, source').eq('org_id', orgId);
    if(leadsError) throw leadsError;

    const leadsByStatusMap = new Map<LeadStatus, number>();
    const leadsBySourceMap = new Map<string, number>();

    (allLeads || []).forEach(lead => {
        leadsByStatusMap.set(lead.status as LeadStatus, (leadsByStatusMap.get(lead.status as LeadStatus) || 0) + 1);
        const source = lead.source || 'Unknown';
        leadsBySourceMap.set(source, (leadsBySourceMap.get(source) || 0) + 1);
    });

    const leadsByStatus: LeadsByStatusReportItem[] = Object.values(LeadStatus).map(statusKey => ({
        status: statusKey,
        count: leadsByStatusMap.get(statusKey) || 0,
    }));

    const leadsBySource: LeadsBySourceReportItem[] = Array.from(leadsBySourceMap.entries()).map(([source, count]) => ({ source, count }));
    
    const totalLeads = allLeads.length;
    const convertedLeadsCount = leadsByStatusMap.get(LeadStatus.CONVERTED) || 0;
    const lostLeadsCount = leadsByStatusMap.get(LeadStatus.LOST) || 0;
    const newLeadsCount = leadsByStatusMap.get(LeadStatus.NEW) || 0;
    const contactedLeadsCount = leadsByStatusMap.get(LeadStatus.CONTACTED) || 0;
    const qualifiedLeadsCount = leadsByStatusMap.get(LeadStatus.QUALIFIED) || 0;

    const relevantLeadsForConversion = totalLeads - newLeadsCount;
    const conversionRate = relevantLeadsForConversion > 0
        ? parseFloat(((convertedLeadsCount / relevantLeadsForConversion) * 100).toFixed(2))
        : 0;

    const { data: deals, error: dealsError } = await supabase.from('deals').select('status, total_value').eq('org_id', orgId);
    if(dealsError) throw dealsError;

    const dealsByStatusMap = new Map<DealStatus, { count: number, total_value: number }>();
    (deals || []).forEach(deal => {
        const current = dealsByStatusMap.get(deal.status as DealStatus) || { count: 0, total_value: 0 };
        current.count++;
        current.total_value += deal.total_value;
        dealsByStatusMap.set(deal.status as DealStatus, current);
    });

    const totalDeals = deals.length;
    const totalWonDealsValue = dealsByStatusMap.get(DealStatus.WON)?.total_value || 0;
    
    const dealsByStatus: DealsByStatusReportItem[] = Array.from(dealsByStatusMap.entries()).map(([status, data]) => ({
        status,
        count: data.count,
        total_value: data.total_value
    }));
    
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
        dealsByStatus,
    };
  },

  getDealPageReportData: async(orgId: string, userId: string, userRole: Role): Promise<DealPageReportData> => {
    const allDeals = await dealService.getDeals(orgId, userId, userRole);
    
    const totalDealsCount = allDeals.length;
    let openDealsValue = 0;
    let wonDealsValue = 0;
    let wonDealsCount = 0;
    
    const dealsByStatusMap = new Map<DealStatus, { count: number, total_value: number }>();

    allDeals.forEach(deal => {
        if (deal.status !== DealStatus.WON && deal.status !== DealStatus.LOST && deal.status !== DealStatus.CANCELLED) {
            openDealsValue += deal.total_value;
        }
        if (deal.status === DealStatus.WON) {
            wonDealsValue += deal.total_value;
            wonDealsCount++;
        }

        const current = dealsByStatusMap.get(deal.status) || { count: 0, total_value: 0 };
        current.count++;
        current.total_value += deal.total_value;
        dealsByStatusMap.set(deal.status, current);
    });
    
    const avgWonDealSize = wonDealsCount > 0 ? wonDealsValue / wonDealsCount : 0;
    
    const dealsByStatusResult: DealsByStatusReportItem[] = Array.from(dealsByStatusMap.entries()).map(([status, data]) => ({
      status,
      count: data.count,
      total_value: data.total_value
    }));


    return {
        totalDealsCount,
        openDealsValue,
        wonDealsValue,
        avgWonDealSize,
        dealsByStatus: dealsByStatusResult
    };
  }
};


// --- Task Service ---
export const taskService = {
    getTasks: async (orgId: string, userId: string, userRole: Role, allUsers: UserProfile[]): Promise<Task[]> => {
        let query = supabase.from('tasks').select('*, related_lead:related_lead_id(name), related_company:related_company_id(name), related_contact:related_contact_id(first_name, last_name)').eq('org_id', orgId);
        if(userRole !== Role.ADMIN) {
            query = query.or(`assigned_to_user_id.eq.${userId},created_by_user_id.eq.${userId}`);
        }
        query = query.order('created_at', { ascending: false });

        const { data, error } = await query;
        if (error) throw error;
        
        return (data || []).map(task => {
            const { related_lead, related_company, related_contact, ...taskData } = task as any;
            const contactInfo = related_contact as { first_name: string; last_name: string; } | null;
            return {
                ...taskData,
                status: task.status as TaskStatus,
                priority: task.priority as TaskPriority,
                assigned_to_user_name: allUsers.find(u => u.id === task.assigned_to_user_id)?.full_name || 'N/A',
                created_by_user_name: allUsers.find(u => u.id === task.created_by_user_id)?.full_name || 'N/A',
                related_lead_name: related_lead?.name || null,
                related_company_name: related_company?.name || null,
                related_contact_name: contactInfo ? `${contactInfo.first_name} ${contactInfo.last_name}` : null,
            } as Task;
        });
    },

    addTask: async(taskData: Omit<Task, 'id'|'created_at'|'updated_at'|'org_id'|'created_by_user_id'|'created_by_user_name'|'assigned_to_user_name'|'comments' | 'related_lead_name' | 'related_company_name' | 'related_contact_name'>, orgId: string, creatorUserId: string): Promise<Task> => {
        const payload = {...taskData, org_id: orgId, created_by_user_id: creatorUserId};
        const { data, error } = await supabase.from('tasks').insert(payload).select().single();
        if (error) throw error;
        if (!data) throw new Error("Task creation failed");
        return data as Task;
    },

    updateTask: async(taskId: string, taskData: Partial<Omit<Task, 'id'|'created_at'|'updated_at'|'org_id'|'created_by_user_id'|'created_by_user_name'|'assigned_to_user_name'|'comments' | 'related_lead_name' | 'related_company_name' | 'related_contact_name'>>): Promise<Task> => {
        const payload: Database['public']['Tables']['tasks']['Update'] = {...taskData, updated_at: new Date().toISOString()};
        const { data, error } = await supabase.from('tasks').update(payload).eq('id', taskId).select().single();
        if (error) throw error;
        if (!data) throw new Error("Task update failed");
        return data as Task;
    },

    deleteTask: async(taskId: string): Promise<void> => {
        await supabase.from('task_comments').delete().eq('task_id', taskId);
        const { error } = await supabase.from('tasks').delete().eq('id', taskId);
        if (error) throw error;
    },

    getTaskComments: async(taskId: string, orgId: string): Promise<TaskComment[]> => {
        const {data, error} = await supabase.from('task_comments').select('*, user:users(full_name)').eq('task_id', taskId).eq('org_id', orgId).order('created_at', {ascending: true});
        if(error) throw error;
        return (data || []).map(comment => {
            const { user, ...commentData } = comment as any;
            return {...commentData, user_full_name: user?.full_name || 'System' }
        })
    },
    
    addTaskComment: async(commentData: Omit<TaskComment, 'id'|'created_at'|'user_full_name'|'org_id'>, orgId: string, userId: string): Promise<TaskComment> => {
        const payload = {...commentData, org_id: orgId, user_id: userId};
        const { data, error } = await supabase.from('task_comments').insert(payload).select().single();
        if (error) throw error;
        if (!data) throw new Error("Comment creation failed");
        return data as TaskComment;
    },

    getTaskDashboardStats: async(orgId: string, userId: string, userRole: Role): Promise<TaskDashboardStats> => {
        const allUsers = await userService.getUsers(orgId);
        const allTasks = await taskService.getTasks(orgId, userId, userRole, allUsers);
        
        const myTasks = allTasks.filter(t => t.assigned_to_user_id === userId);
        const openTasks = myTasks.filter(t => t.status !== TaskStatus.DONE && t.status !== TaskStatus.CANCELLED).length;
        const overdueTasks = myTasks.filter(t => t.due_date && new Date(t.due_date) < new Date() && t.status !== TaskStatus.DONE && t.status !== TaskStatus.CANCELLED).length;

        return {
            totalTasks: allTasks.length,
            openTasks,
            overdueTasks
        };
    }
};

// --- Ticket Service ---
export const ticketService = {
  getTickets: async (orgId: string, userId: string, userRole: Role): Promise<Ticket[]> => {
    let query = supabase.from('tickets').select('*, created_by:users(full_name), assigned_to:users(full_name)').eq('org_id', orgId);
    if(userRole !== Role.ADMIN) {
        query = query.or(`assigned_to_user_id.eq.${userId},created_by_user_id.eq.${userId}`);
    }
    query = query.order('created_at', { ascending: false });

    const { data, error } = await query;
    if (error) throw error;

    return (data || []).map(ticket => {
        const { created_by, assigned_to, ...ticketData } = ticket as any;
      return {
        ...ticketData,
        status: ticket.status as TicketStatus,
        priority: ticket.priority as TicketPriority,
        created_by_user_name: created_by?.full_name || 'N/A',
        assigned_to_user_name: assigned_to?.full_name || 'Unassigned',
      };
    });
  },

  addTicket: async(ticketData: Omit<Ticket, 'id'|'ticket_uid'|'created_at'|'updated_at'|'org_id'|'created_by_user_id'|'created_by_user_name'|'assigned_to_user_name'|'resolved_at'|'closed_at'>, orgId: string, creatorUserId: string): Promise<Ticket> => {
    const payload = {...ticketData, org_id: orgId, created_by_user_id: creatorUserId};
    const { data, error } = await supabase.from('tickets').insert(payload).select().single();
    if(error) throw error;
    if(!data) throw new Error("Ticket creation failed");
    return data as Ticket;
  },

  updateTicket: async(ticketId: string, ticketData: Partial<Omit<Ticket, 'id'|'ticket_uid'|'created_at'|'updated_at'|'org_id'|'created_by_user_id'|'created_by_user_name'|'assigned_to_user_name'>>, originalTicket?: Ticket | null): Promise<Ticket> => {
    const payload: Database['public']['Tables']['tickets']['Update'] = {...ticketData, updated_at: new Date().toISOString()};
    
    if (originalTicket) {
      if (payload.status === TicketStatus.RESOLVED && originalTicket.status !== TicketStatus.RESOLVED) {
        payload.resolved_at = new Date().toISOString();
      }
      if (payload.status === TicketStatus.CLOSED && originalTicket.status !== TicketStatus.CLOSED) {
        payload.closed_at = new Date().toISOString();
      }
    }
    
    const { data, error } = await supabase.from('tickets').update(payload).eq('id', ticketId).select().single();
    if (error) throw error;
    if (!data) throw new Error("Ticket update failed");
    return data as Ticket;
  },
  
  deleteTicket: async(ticketId: string): Promise<void> => {
    const { error } = await supabase.from('tickets').delete().eq('id', ticketId);
    if(error) throw error;
  }
};
