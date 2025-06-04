import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import { Session, User as SupabaseAuthUser } from '@supabase/supabase-js';
import { UserProfile, Role } from '@/types';
import { authService, UserCredentials } from '@/services/api';
import { Spinner } from '@/components/common/Spinner';

interface AuthContextType {
  session: Session | null;
  authUser: SupabaseAuthUser | null; // Supabase's auth.user
  profile: UserProfile | null; // Your public.users profile
  isLoading: boolean;
  login: (credentials: UserCredentials) => Promise<void>;
  logout: () => Promise<void>;
  hasRole: (role: Role | Role[]) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [authUser, setAuthUser] = useState<SupabaseAuthUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);
    // Check for initial session
    authService.getSession().then(({ session: initialSession, authUser: initialAuthUser }) => {
      setSession(initialSession);
      setAuthUser(initialAuthUser);
      if (initialAuthUser) {
        authService.getUserProfile(initialAuthUser.id).then(initialProfile => {
          setProfile(initialProfile);
          setIsLoading(false);
        }).catch(() => setIsLoading(false));
      } else {
        setIsLoading(false);
      }
    }).catch(() => setIsLoading(false));

    // Listen for auth state changes
    const { data: authListener } = authService.onAuthStateChange(
      (newSession, newAuthUser, newProfile) => {
        setSession(newSession);
        setAuthUser(newAuthUser);
        setProfile(newProfile);
        // If user logs out, or session ends, loading is effectively false for auth state
        // If user logs in, profile fetch might still be loading, but initial check is covered.
        if (!newSession) setIsLoading(false); 
      }
    );
    
    return () => {
      authListener?.unsubscribe();
    };
  }, []);

  const login = async (credentials: UserCredentials) => {
    setIsLoading(true);
    try {
      const { session: newSession, authUser: newAuthUser, profile: newProfile } = await authService.login(credentials);
      setSession(newSession);
      setAuthUser(newAuthUser);
      setProfile(newProfile);
    } catch (error) {
      console.error('AuthProvider: login failed', error);
      // Clear any partial state on login failure
      setSession(null);
      setAuthUser(null);
      setProfile(null);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      await authService.logout();
      // Auth listener should clear session, authUser, and profile states.
    } catch (error) {
      console.error("AuthProvider: Logout failed:", error);
      // Even if Supabase logout call fails, try to clear client state.
      // However, auth listener is primary for this.
    } finally {
      // Auth listener will set isLoading to false once states are updated.
      // If logout does not trigger auth listener (e.g. offline), ensure isLoading is false.
      // For now, rely on listener. If issues, add setIsLoading(false) here.
    }
  };

  const hasRole = (roles: Role | Role[]): boolean => {
    if (!profile) return false;
    const userRole = profile.role;
    return Array.isArray(roles) ? roles.includes(userRole) : userRole === roles;
  };

  // Show a global spinner while AuthProvider is initializing session/profile
  if (isLoading && !profile && !session) { // More specific condition for initial load
    return (
      <div className="flex items-center justify-center h-screen">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ session, authUser, profile, isLoading, login, logout, hasRole }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};