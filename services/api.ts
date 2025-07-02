
import { createClient, Session, User as SupabaseAuthUser, PostgrestError } from '@supabase/supabase-js';
import { UserProfile, Role, Lead, LeadStatus, Organization, LeadActivity, LeadFollowUp, LeadFollowUpStatus, Product, Deal, DealStatus, DealItem, SalesReportData, LeadsByStatusReportItem, LeadsBySourceReportItem, DealsByStatusReportItem, ChartDataPoint, Company, Contact } from '@/types';
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

      const userProfilePayload = {
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
      
      const userProfileWithRole: UserProfile = { ...profileData, role: profileData.role as Role };
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
      .select('*')
      .eq('auth_user_id', authUserId)
      .single();

    if (error) {
      if ((error as PostgrestError).code === 'PGRST116') return null; 
      console.error('Supabase getUserProfile error:', error);
    }
    return data ? { ...data, role: data.role as Role } : null;
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
      .select('*')
      .eq('org_id', orgId);
    if (error) throw error;
    return data?.map(u => ({ ...u, role: u.role as Role })) || [];
  },

  addUser: async (userData: { email: string; passwordInput: string; full_name: string; role: Role }, adminOrgId: string): Promise<UserProfile> => {
    const { data: authData, error: signUpError } = await supabase.auth.signUp({
      email: userData.email,
      password: userData.passwordInput,
    });
    if (signUpError) throw signUpError;
    if (!authData.user) throw new Error('User creation failed: No auth user data.');

    const newUserProfileData = {
      auth_user_id: authData.user.id,
      email: userData.email,
      full_name: userData.full_name,
      role: userData.role,
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
    return { ...profileData, role: profileData.role as Role };
  },

  updateUser: async (
    userId: string, 
    userData: Partial<{ full_name: string; role: Role }>,
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
    return { ...updatedProfile, role: updatedProfile.role as Role };
  },
  
  updateCurrentAuthUser: async (authUserId: string, data: { full_name?: string, passwordInput?: string }): Promise<UserProfile> => {
    if (data.passwordInput) {
      const { error: passwordError } = await supabase.auth.updateUser({ password: data.passwordInput });
      if (passwordError) throw new Error(`Password update failed: ${passwordError.message}`);
    }

    if (data.full_name) {
      const { data: userUpdateData, error: userUpdateError } = await supabase.auth.updateUser({
        data: { full_name: data.full_name } 
      });
       if (userUpdateError) throw new Error(`Auth user metadata update failed: ${userUpdateError.message}`);

      const { data: profile, error: profileError } = await supabase
        .from('users')
        .update({ full_name: data.full_name })
        .eq('auth_user_id', authUserId)
        .select()
        .single();
      if (profileError) throw new Error(`Profile name update in 'users' table failed: ${profileError.message}`);
      if (!profile) throw new Error('Failed to retrieve updated profile from users table.');
      return { ...profile, role: profile.role as Role };
    }
    
    const updatedProfile = await authService.getUserProfile(authUserId);
    if (!updatedProfile) throw new Error('Failed to retrieve profile after update.');
    return updatedProfile;
  },

  deleteUser: async (userId: string, authUserId: string): Promise<void> => {
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
      const ownerInfo = lead.owner as unknown as { id: string, full_name: string } | null;
      const companyInfo = lead.company as unknown as { id: string, name: string } | null;
      const contactInfo = lead.contact as unknown as { id: string, first_name: string, last_name: string } | null;
      return {
        ...lead,
        status: lead.status as LeadStatus,
        owner_name: ownerInfo?.full_name || 'Unassigned',
        owner_user_id: ownerInfo?.id || null,
        company_name: companyInfo?.name || undefined,
        contact_name: contactInfo ? `${contactInfo.first_name} ${contactInfo.last_name}` : undefined,
        owner: undefined, 
        company: undefined,
        contact: undefined,
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
    const ownerInfo = data.owner as unknown as { id: string, full_name: string } | null;
    const companyInfo = data.company as unknown as { id: string, name: string } | null;
    const contactInfo = data.contact as unknown as { id: string, first_name: string, last_name: string } | null;
    return {
        ...data,
        status: data.status as LeadStatus,
        owner_name: ownerInfo?.full_name || 'Unassigned',
        owner_user_id: ownerInfo?.id || null,
        company_name: companyInfo?.name || undefined,
        contact_name: contactInfo ? `${contactInfo.first_name} ${contactInfo.last_name}` : undefined,
        owner: undefined,
        company: undefined,
        contact: undefined,
    } as Lead;
  },

  addLead: async (leadData: Omit<Lead, 'id' | 'created_at' | 'updated_at' | 'owner_name' | 'company_name' | 'contact_name' | 'org_id' | 'activities' | 'follow_ups' | 'deals'>, orgId: string): Promise<Lead> => {
    const payload: any = { ...leadData, org_id: orgId };
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

    const ownerInfo = data.owner as unknown as { id: string, full_name: string } | null;
    const companyInfo = data.company as unknown as { id: string, name: string } | null;
    const contactInfo = data.contact as unknown as { id: string, first_name: string, last_name: string } | null;
    return {
      ...data,
      status: data.status as LeadStatus,
      owner_name: ownerInfo?.full_name || 'Unassigned',
      owner_user_id: ownerInfo?.id || null,
      company_name: companyInfo?.name || undefined,
      contact_name: contactInfo ? `${contactInfo.first_name} ${contactInfo.last_name}` : undefined,
      owner: undefined,
      company: undefined,
      contact: undefined,
    } as Lead;
  },

  updateLead: async (leadId: string, leadData: Partial<Omit<Lead, 'id' | 'created_at' | 'updated_at' | 'owner_name' | 'company_name' | 'contact_name' | 'org_id' | 'activities' | 'follow_ups' | 'deals'>>): Promise<Lead> => {
    const payload: any = { ...leadData };
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

    const ownerInfo = data.owner as unknown as { id: string, full_name: string } | null;
    const companyInfo = data.company as unknown as { id: string, name: string } | null;
    const contactInfo = data.contact as unknown as { id: string, first_name: string, last_name: string } | null;
    return {
      ...data,
      status: data.status as LeadStatus,
      owner_name: ownerInfo?.full_name || 'Unassigned',
      owner_user_id: ownerInfo?.id || null,
      company_name: companyInfo?.name || undefined,
      contact_name: contactInfo ? `${contactInfo.first_name} ${contactInfo.last_name}` : undefined,
      owner: undefined,
      company: undefined,
      contact: undefined,
    } as Lead;
  },

  deleteLead: async (leadId: string): Promise<void> => {
    await leadActivityService.deleteActivitiesForLead(leadId);
    await leadFollowUpService.deleteFollowUpsForLead(leadId);
    await dealService.deleteDealsForLead(leadId); 

    const { error } = await supabase.from('leads').delete().eq('id', leadId);
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
  getDealsForLead: async (leadId: string, orgId: string): Promise<Deal[]> => {
    const { data: dealsData, error: dealsError } = await supabase
        .from('deals')
        .select(`
          *, 
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
            
            const createdByUserInfo = deal.created_by as unknown as { full_name: string } | null;
            const companyInfo = deal.company as unknown as { id: string, name: string } | null;
            const contactInfo = deal.contact as unknown as { id: string, first_name: string, last_name: string } | null;

            return {
                ...deal,
                status: deal.status as DealStatus,
                created_by_user_name: createdByUserInfo?.full_name || 'N/A',
                company_name: companyInfo?.name || undefined,
                contact_name: contactInfo ? `${contactInfo.first_name} ${contactInfo.last_name}` : undefined,
                created_by: undefined, 
                company: undefined,
                contact: undefined,
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
    dealData: Omit<Deal, 'id' | 'created_at' | 'updated_at' | 'org_id' | 'total_value' | 'items' | 'created_by_user_name' | 'created_by_user_id' | 'company_name' | 'contact_name'>, 
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
        contact:contacts(id, first_name, last_name)
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

    return { 
        ...newDeal, 
        status: newDeal.status as DealStatus,
        created_by_user_name: createdByUserInfo?.full_name || 'N/A',
        company_name: companyInfo?.name || undefined,
        contact_name: contactInfo ? `${contactInfo.first_name} ${contactInfo.last_name}` : undefined,
        created_by: undefined,
        company: undefined,
        contact: undefined,
        items: (await dealService.getDealItems(newDeal.id))
    };
  },

  updateDeal: async (
    dealId: string,
    dealData: Partial<Omit<Deal, 'id' | 'created_at' | 'updated_at' | 'org_id' | 'total_value' | 'items' | 'lead_id' | 'created_by_user_id' | 'created_by_user_name' | 'company_name' | 'contact_name'>>,
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
        contact:contacts(id, first_name, last_name)
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

    return { 
        ...updatedDeal, 
        status: updatedDeal.status as DealStatus,
        created_by_user_name: createdByUserInfo?.full_name || 'N/A',
        company_name: companyInfo?.name || undefined,
        contact_name: contactInfo ? `${contactInfo.first_name} ${contactInfo.last_name}` : undefined,
        created_by: undefined,
        company: undefined,
        contact: undefined,
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
    const { data: leadsByStatusRaw, error: statusError } = await supabase
      .from('leads')
      .select('status, count') 
      .eq('org_id', orgId);

    if (statusError) {
        console.error("Error fetching lead status stats:", statusError);
    }
    
    const leadsByStatusMap = new Map<LeadStatus, number>();
    (leadsByStatusRaw || []).forEach((item: any) => { 
        leadsByStatusMap.set(item.status, (leadsByStatusMap.get(item.status) || 0) + item.count);
    });

    const leadsByStatus: LeadsByStatusReportItem[] = Object.values(LeadStatus).map(statusKey => ({
        status: statusKey,
        count: leadsByStatusMap.get(statusKey) || 0,
    }));
    
    const totalLeads = leadsByStatus.reduce((sum, item) => sum + item.count, 0);
    const convertedLeadsCount = leadsByStatusMap.get(LeadStatus.CONVERTED) || 0;
    const lostLeadsCount = leadsByStatusMap.get(LeadStatus.LOST) || 0;
    const newLeadsCount = leadsByStatusMap.get(LeadStatus.NEW) || 0;
    const contactedLeadsCount = leadsByStatusMap.get(LeadStatus.CONTACTED) || 0;
    const qualifiedLeadsCount = leadsByStatusMap.get(LeadStatus.QUALIFIED) || 0;
    
    const relevantLeadsForConversion = totalLeads - newLeadsCount;
    const conversionRate = relevantLeadsForConversion > 0
        ? parseFloat(((convertedLeadsCount / relevantLeadsForConversion) * 100).toFixed(2))
        : 0;

    const { data: leadsBySourceRaw, error: sourceError } = await supabase
      .from('leads')
      .select('source, count') 
      .eq('org_id', orgId);

    if (sourceError) console.error("Error fetching lead source stats:", sourceError);
    const leadsBySource: LeadsBySourceReportItem[] = (leadsBySourceRaw || []).map((item: any) => ({
        source: item.source || 'Unknown',
        count: item.count,
    }));


    const { data: dealsByStatusRaw, error: dealsStatusError } = await supabase
        .from('deals')
        .select('status, total_value')
        .eq('org_id', orgId);

    if (dealsStatusError) console.error("Error fetching deal status stats:", dealsStatusError);

    const dealsByStatusMap = new Map<DealStatus, { count: number, total_value: number }>();
    (dealsByStatusRaw || []).forEach((deal: any) => { 
        const current = dealsByStatusMap.get(deal.status) || { count: 0, total_value: 0 };
        current.count += 1; 
        current.total_value += deal.total_value; 
        dealsByStatusMap.set(deal.status, current);
    });
    
    let totalDeals = 0;
    let totalWonDealsValue = 0;
    const dealsByStatusResult: DealsByStatusReportItem[] = Object.values(DealStatus).map(statusKey => {
        const stats = dealsByStatusMap.get(statusKey) || { count: 0, total_value: 0 };
        totalDeals += stats.count;
        if (statusKey === DealStatus.WON) {
            totalWonDealsValue += stats.total_value;
        }
        return {
            status: statusKey,
            count: stats.count,
            total_value: stats.total_value,
        };
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
  }
};
