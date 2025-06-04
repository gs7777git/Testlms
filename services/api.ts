
import { createClient, Session, User as SupabaseAuthUser, PostgrestError } from '@supabase/supabase-js';
import { UserProfile, Role, Lead, LeadStatus, Organization } from './types'; // Adjusted path assuming types.ts is in the same root dir
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './constants'; // Adjusted path assuming constants.ts is in the same root dir

// Initialize Supabase client
// The constants file (constants.ts) already performs a check and alerts if these are missing.
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  // This is a fallback, primarily for type safety, as constants.ts should handle the user alert.
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

    if (error) {
      console.error('Supabase login error:', error);
      throw error;
    }
    if (!data.session || !data.user) {
      throw new Error('Login failed: No session or user data returned.');
    }

    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('*')
      .eq('auth_user_id', data.user.id)
      .single();

    if (profileError) {
      console.error('Supabase profile fetch error:', profileError);
      await supabase.auth.signOut();
      throw new Error('Login failed: User profile not found. Please contact support.');
    }
    if (!profile) {
      await supabase.auth.signOut();
      throw new Error('Login failed: User profile is empty. Please contact support.');
    }

    const userProfileWithRole: UserProfile = { ...profile, role: profile.role as Role };

    return { session: data.session, authUser: data.user, profile: userProfileWithRole };
  },

  registerAdminAndOrganization: async (registrationData: AdminRegistrationData): Promise<{ authUser: SupabaseAuthUser, organization: Organization, profile: UserProfile }> => {
    const { data: authData, error: signUpError } = await supabase.auth.signUp({
      email: registrationData.email,
      password: registrationData.passwordInput,
    });

    if (signUpError) {
      console.error('Supabase signUp (registerAdmin) error:', signUpError);
      throw signUpError;
    }
    if (!authData.user) {
      throw new Error('Admin registration failed: No auth user data returned from signUp.');
    }

    let createdOrganization: Organization | null = null;
    try {
      const { data: orgData, error: orgError } = await supabase
        .from('organizations')
        .insert({ name: registrationData.organizationName })
        .select()
        .single();

      if (orgError) {
        console.error('Supabase create organization error:', orgError);
        throw orgError;
      }
      if (!orgData) {
        throw new Error('Organization creation failed: No data returned.');
      }
      createdOrganization = orgData as Organization;

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

      if (profileError) {
        console.error('Supabase create user profile error:', profileError);
        throw profileError;
      }
      if (!profileData) {
          throw new Error('User profile creation failed: No data returned.');
      }

      const userProfileWithRole: UserProfile = { ...profileData, role: profileData.role as Role };
      return { authUser: authData.user, organization: createdOrganization, profile: userProfileWithRole };

    } catch (error) {
      console.error("Error during admin registration process, attempting cleanup:", error);
      if (authData.user) {
        console.warn(`Attempting to clean up auth user ${authData.user.id}. This might require admin privileges not available client-side.`);
      }
      throw error;
    }
  },

  logout: async (): Promise<void> => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('Supabase logout error:', error);
    }
    return; // Explicit return for Promise<void>
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
      console.error('Supabase getUserProfile error:', error);
      if ((error as PostgrestError).code === 'PGRST116') {
          return null;
      }
      // If it's another error, it might be better to throw or handle it specifically
      // For now, returning null for any error to match original behavior for non-PGRST116 errors.
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

    if (error) {
      console.error('Supabase getUsers error:', error);
      throw error;
    }
    return data?.map(u => ({...u, role: u.role as Role})) || [];
  },

  addUser: async (
    userData: { email: string; passwordInput: string; full_name: string; role: Role },
    adminOrgId: string
  ): Promise<UserProfile> => {
    const { data: authData, error: signUpError } = await supabase.auth.signUp({
      email: userData.email,
      password: userData.passwordInput,
    });

    if (signUpError) {
      console.error('Supabase signUp (addUser) error:', signUpError);
      throw signUpError;
    }
    if (!authData.user) {
      throw new Error('User creation failed: No auth user data returned.');
    }

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
      console.error('Supabase addUser profile insert error:', profileError);
      console.warn(`Orphaned auth user created (ID: ${authData.user.id}) due to profile creation failure. Manual cleanup may be required or use a backend function.`);
      throw profileError;
    }
    if (!profileData) {
      console.warn(`Orphaned auth user might have been created (ID: ${authData.user.id}) due to empty profile data response. Manual cleanup may be required or use a backend function.`);
      throw new Error('User profile creation failed: No profile data returned.');
    }

    return {...profileData, role: profileData.role as Role };
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

    if (profileUpdateError) {
      console.error('Supabase updateUser profile error:', profileUpdateError);
      throw profileUpdateError;
    }
    if (!updatedProfile) {
      throw new Error('User profile update failed: No data returned.');
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
            console.warn("Attempting to update another user's password from client-side using anon key. This operation will fail. Use a backend function with service_role privileges.");
        }
    }
    return {...updatedProfile, role: updatedProfile.role as Role };
  },

  deleteUser: async (userId: string, authUserId: string): Promise<void> => {
    const { error: profileDeleteError } = await supabase
      .from('users')
      .delete()
      .eq('id', userId);

    if (profileDeleteError) {
      console.error('Supabase deleteUser (profile) error:', profileDeleteError);
      throw profileDeleteError;
    }

    console.warn(`User profile ${userId} deleted. Deleting Supabase auth user ${authUserId} from client-side with an anon key is NOT PERMITTED for other users and will fail silently or error. This MUST be handled by a backend function (e.g., Supabase Edge Function) with service_role privileges.`);
    return; // Explicit return for Promise<void>
  },
};

// --- Lead Service Interface ---
interface LeadServiceInterface {
  getLeads: (orgId: string) => Promise<Lead[]>;
  addLead: (
    leadData: Omit<Lead, 'id' | 'created_at' | 'updated_at' | 'owner_name' | 'org_id'>,
    orgId: string
  ) => Promise<Lead>;
  updateLead: (
    leadId: string,
    leadData: Partial<Omit<Lead, 'id' | 'created_at' | 'updated_at' | 'owner_name' | 'org_id'>>
  ) => Promise<Lead>;
  deleteLead: (leadId: string) => Promise<void>;
}


// --- Lead Service ---
export const leadService: LeadServiceInterface = {
  getLeads: async (orgId: string): Promise<Lead[]> => {
    const { data, error } = await supabase
      .from('leads')
      .select(`
        id, name, email, mobile, source, status, stage, org_id, owner_user_id, notes, created_at, updated_at,
        owner:users ( id, full_name )
      `)
      .eq('org_id', orgId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Supabase getLeads error:', error);
      throw error;
    }
    return data?.map(lead => {
      const ownerInfo = lead.owner as unknown as { id: string, full_name: string } | null;
      return {
        ...lead,
        status: lead.status as LeadStatus,
        owner_name: ownerInfo?.full_name || 'Unassigned',
        owner_user_id: ownerInfo?.id || null,
        owner: undefined, // Remove the nested owner object after processing
      } as Lead;
    }) || [];
  },

  addLead: async (leadData: Omit<Lead, 'id' | 'created_at' | 'updated_at' | 'owner_name' | 'org_id'>, orgId: string): Promise<Lead> => {
    const payload = { ...leadData, org_id: orgId };
    if (payload.owner_user_id === '') {
        payload.owner_user_id = null;
    }
    const { data, error } = await supabase
      .from('leads')
      .insert(payload)
      .select(`
        id, name, email, mobile, source, status, stage, org_id, owner_user_id, notes, created_at, updated_at,
        owner:users ( id, full_name )
      `)
      .single();

    if (error) {
      console.error('Supabase addLead error:', error);
      throw error;
    }
    if (!data) {
        throw new Error('Lead creation failed: No data returned.');
    }
    const ownerInfo = data.owner as unknown as { id: string, full_name: string } | null;
    const newLead: Lead = {
      ...data,
      status: data.status as LeadStatus,
      owner_name: ownerInfo?.full_name || 'Unassigned',
      owner_user_id: ownerInfo?.id || null,
      owner: undefined, // Remove the nested owner object
    };
    return newLead;
  },

  updateLead: async (leadId: string, leadData: Partial<Omit<Lead, 'id' | 'created_at' | 'updated_at' | 'owner_name' | 'org_id'>>): Promise<Lead> => {
    const payload = {...leadData};
    if (payload.owner_user_id === '') {
        payload.owner_user_id = null;
    }
    const { data, error } = await supabase
      .from('leads')
      .update(payload)
      .eq('id', leadId)
      .select(`
        id, name, email, mobile, source, status, stage, org_id, owner_user_id, notes, created_at, updated_at,
        owner:users ( id, full_name )
      `)
      .single();

    if (error) {
      console.error('Supabase updateLead error:', error);
      throw error;
    }
    if (!data) {
        throw new Error('Lead update failed: No data returned.');
    }
    const ownerInfo = data.owner as unknown as { id: string, full_name: string } | null;
    const updatedLead: Lead = {
      ...data,
      status: data.status as LeadStatus,
      owner_name: ownerInfo?.full_name || 'Unassigned',
      owner_user_id: ownerInfo?.id || null,
      owner: undefined, // Remove the nested owner object
    };
    return updatedLead;
  },

  deleteLead: async (leadId: string): Promise<void> => {
    const { error } = await supabase
      .from('leads')
      .delete()
      .eq('id', leadId);

    if (error) {
      console.error('Supabase deleteLead error:', error);
      throw error;
    }
    return; // Explicit return for Promise<void>
  },
};
