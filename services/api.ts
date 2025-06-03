
import { createClient, Session, User as SupabaseAuthUser } from '@supabase/supabase-js';
import { UserProfile, Role, Lead, LeadStatus } from '../types';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../constants';

// Initialize Supabase client
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export interface UserCredentials {
  email: string;
  password?: string; // Password is optional for some operations like fetching current user
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

    // Fetch user profile from public.users table
    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('*')
      .eq('auth_user_id', data.user.id)
      .single();

    if (profileError) {
      console.error('Supabase profile fetch error:', profileError);
      // Critical: if profile doesn't exist, user cannot operate in the app.
      // Sign out the user to prevent inconsistent state.
      await supabase.auth.signOut();
      throw new Error('Login failed: User profile not found. Please contact support.');
    }
    if (!profile) {
      await supabase.auth.signOut();
      throw new Error('Login failed: User profile is empty. Please contact support.');
    }
    
    // Ensure role from DB is cast to Role enum
    const userProfileWithRole: UserProfile = { ...profile, role: profile.role as Role };

    return { session: data.session, authUser: data.user, profile: userProfileWithRole };
  },

  logout: async (): Promise<void> => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('Supabase logout error:', error);
      // Even if there's an error, client-side state should be cleared.
      // The error might be network-related, but session is likely invalidated server-side.
    }
  },

  // Gets current Supabase auth user and their session
  getSession: async (): Promise<{ session: Session | null; authUser: SupabaseAuthUser | null }> => {
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      console.error('Supabase getSession error:', error);
      return { session: null, authUser: null }; // Gracefully handle error
    }
    return { session: data.session, authUser: data.session?.user ?? null };
  },
  
  // Fetches profile for a given Supabase auth user
  getUserProfile: async (authUserId: string): Promise<UserProfile | null> => {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('auth_user_id', authUserId)
      .single();

    if (error) {
      console.error('Supabase getUserProfile error:', error);
      return null;
    }
    return data ? { ...data, role: data.role as Role } : null;
  },

  // Listens to auth state changes
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

  // Admin creating a new user.
  addUser: async (
    userData: { email: string; passwordInput: string; full_name: string; role: Role },
    adminOrgId: string
  ): Promise<UserProfile> => {
    // 1. Create the Supabase Auth user
    // IMPORTANT: This creates a user that needs to confirm their email by default unless disabled in Supabase settings.
    // For an admin creating users, you might want to:
    //    a) Disable email confirmation temporarily or for specific flows.
    //    b) Or, use supabase.auth.admin.createUser() from a backend function with service_role key
    //       which allows setting email_confirm to true directly and other admin actions.
    //       const { data: authData, error: signUpError } = await supabase.auth.admin.createUser({
    //          email: userData.email,
    //          password: userData.passwordInput,
    //          email_confirm: true, // Auto-confirm email if created by admin
    //          user_metadata: { full_name: userData.full_name } // Can store some non-sensitive initial data here
    //       });
    // For client-side with anon key, standard signUp is used:
    const { data: authData, error: signUpError } = await supabase.auth.signUp({
      email: userData.email,
      password: userData.passwordInput,
      // options: { data: { full_name: userData.full_name } } // This data goes to auth.users.raw_user_meta_data
    });

    if (signUpError) {
      console.error('Supabase signUp (addUser) error:', signUpError);
      throw signUpError;
    }
    if (!authData.user) {
      throw new Error('User creation failed: No auth user data returned.');
    }
    
    // 2. Create the profile in public.users table
    const newUserProfileData = {
      auth_user_id: authData.user.id,
      email: userData.email, // or authData.user.email
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
      // Critical: If profile creation fails, the Supabase Auth user is orphaned.
      // Attempt to delete the orphaned auth user. This requires admin privileges and should ideally be a transaction or handled by a backend function.
      // Using supabase.auth.admin.deleteUser(authData.user.id) would be ideal here if this code ran with service_role.
      // Since this is client-side, we can't reliably clean up. This highlights a common backend-preferred operation.
      console.warn(`Orphaned auth user created (ID: ${authData.user.id}) due to profile creation failure. Manual cleanup may be required or use a backend function.`);
      throw profileError;
    }
    if (!profileData) {
      // Similar to above, an orphan could be created if no data returns but no error was thrown.
      console.warn(`Orphaned auth user might have been created (ID: ${authData.user.id}) due to empty profile data response. Manual cleanup may be required or use a backend function.`);
      throw new Error('User profile creation failed: No profile data returned.');
    }
    
    return {...profileData, role: profileData.role as Role };
  },

  updateUser: async (
    userId: string, // This is public.users.id (profile ID)
    userData: Partial<{ full_name: string; role: Role }>,
    authUserId?: string, // supabase.auth.user.id, needed for password update
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

    // Update password in Supabase Auth if provided AND authUserId is available
    if (passwordInput && authUserId) {
        const {data: {user: currentAuthUser}} = await supabase.auth.getUser();
        if (currentAuthUser?.id === authUserId) { // Current user updating their own password
             const { error: passwordUpdateError } = await supabase.auth.updateUser({ password: passwordInput });
             if (passwordUpdateError) {
                console.error('Supabase updateUser (self) password error:', passwordUpdateError);
                // Profile was updated, but password failed. Decide on error handling strategy.
                // Throwing an error here might be too disruptive if profile update was main goal.
                // Could return profile with a warning, or throw specific error.
                throw new Error(`Profile updated, but password update failed: ${passwordUpdateError.message}`);
            }
        } else { // Admin attempting to update another user's password
            // This requires service_role key and supabase.auth.admin.updateUserById()
            // This will FAIL with anon key from client-side.
            console.warn("Attempting to update another user's password from client-side using anon key. This operation will fail. Use a backend function with service_role privileges.");
            // throw new Error("Updating other users' passwords from the client with anon key is not permitted. A backend function with service_role is required.");
            // For now, we'll let the profile update succeed and log a warning about password.
            // In a real app, this path should be handled by a backend function.
        }
    }
    return {...updatedProfile, role: updatedProfile.role as Role };
  },

  deleteUser: async (userId: string, authUserId: string): Promise<void> => {
    // Deleting from 'public.users' first.
    // This adheres to RLS if correctly set up (e.g., admin can delete users in their org).
    const { error: profileDeleteError } = await supabase
      .from('users')
      .delete()
      .eq('id', userId); // Assuming userId is the public.users.id

    if (profileDeleteError) {
      console.error('Supabase deleteUser (profile) error:', profileDeleteError);
      throw profileDeleteError;
    }
    
    // Deleting the Supabase Auth user.
    // CRITICAL: This operation REQUIRES service_role key and using supabase.auth.admin.deleteUser(authUserId).
    // It CANNOT be done from the client-side with an anon key for other users.
    // An admin user logged into the app CANNOT delete another auth user directly via client SDK.
    // This part of the function WILL FAIL in a typical client-side setup for deleting *other* users.
    // It should be moved to a Supabase Edge Function called with necessary privileges.
    console.warn(`User profile ${userId} deleted. Deleting Supabase auth user ${authUserId} from client-side with an anon key is NOT PERMITTED for other users and will fail silently or error depending on Supabase version/config. This MUST be handled by a backend function (e.g., Supabase Edge Function) with service_role privileges.`);
    // Example of how it should be done in a backend function:
    // await supabase.auth.admin.deleteUser(authUserId);
    // For now, this function mainly handles profile deletion. The auth user will be orphaned if this is not handled server-side.
  },
};

// --- Lead Service ---
export const leadService = {
  getLeads: async (orgId: string): Promise<Lead[]> => {
    const { data, error } = await supabase
      .from('leads')
      .select(`
        id,
        name,
        email,
        mobile,
        source,
        status,
        stage,
        org_id,
        owner_user_id,
        notes,
        created_at,
        updated_at,
        owner:users ( id, full_name ) 
      `)
      .eq('org_id', orgId)
      .order('created_at', { ascending: false }); // Example: order by creation date

    if (error) {
      console.error('Supabase getLeads error:', error);
      throw error;
    }
    return data?.map(lead => {
      const ownerInfo = lead.owner as unknown as { id: string, full_name: string } | null; 
      return {
        ...lead,
        status: lead.status as LeadStatus, // Ensure status is correctly typed
        owner_name: ownerInfo?.full_name || 'Unassigned',
        owner_user_id: ownerInfo?.id || null, // Ensure owner_user_id is correctly extracted
        owner: undefined, // Remove the nested owner object to match Lead type strictly
      } as Lead; 
    }) || [];
  },

  addLead: async (leadData: Omit<Lead, 'id' | 'created_at' | 'updated_at' | 'owner_name' | 'org_id'>, orgId: string): Promise<Lead> => {
    const payload = { ...leadData, org_id: orgId };
    // Ensure owner_user_id is null if it's an empty string from form
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
    return {
      ...data,
      status: data.status as LeadStatus,
      owner_name: ownerInfo?.full_name || 'Unassigned',
      owner_user_id: ownerInfo?.id || null,
      owner: undefined,
    } as Lead;
  },

  updateLead: async (leadId: string, leadData: Partial<Omit<Lead, 'id' | 'created_at' | 'updated_at' | 'owner_name' | 'org_id'>>): Promise<Lead> => {
    const payload = {...leadData};
    // Ensure owner_user_id is null if it's an empty string from form
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
    return {
      ...data,
      status: data.status as LeadStatus,
      owner_name: ownerInfo?.full_name || 'Unassigned',
      owner_user_id: ownerInfo?.id || null,
      owner: undefined,
    } as Lead;
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
  },
};