
import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import { Session, User as SupabaseAuthUser, Subscription } from '@supabase/supabase-js'; 
import { UserProfile, Role } from '@/types';
import { authService, UserCredentials } from '@/services/api';
import { Spinner } from '@/components/common/Spinner';

interface AuthContextType {
  session: Session | null;
  authUser: SupabaseAuthUser | null; 
  profile: UserProfile | null; 
  isLoading: boolean;
  login: (credentials: UserCredentials) => Promise<void>;
  logout: () => Promise<void>;
  hasRole: (role: Role | Role[]) => boolean;
  setProfile: (profile: UserProfile | null) => void; // Added to allow manual profile updates if needed
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [authUser, setAuthUser] = useState<SupabaseAuthUser | null>(null);
  const [profile, setProfileState] = useState<UserProfile | null>(null); // Renamed to avoid conflict
  const [isLoading, setIsLoading] = useState(true);

  const internalSetProfile = (newProfile: UserProfile | null) => {
    setProfileState(newProfile);
  };

  useEffect(() => {
    setIsLoading(true);
    authService.getSession().then(({ session: initialSession, authUser: initialAuthUser }) => {
      setSession(initialSession);
      setAuthUser(initialAuthUser);
      if (initialAuthUser) {
        authService.getUserProfile(initialAuthUser.id).then(initialProfile => {
          internalSetProfile(initialProfile);
          setIsLoading(false);
        }).catch(() => setIsLoading(false));
      } else {
        setIsLoading(false);
      }
    }).catch(() => setIsLoading(false));

    const { data: authListener } = authService.onAuthStateChange(
      async (_newSession, newAuthUserParam) => { // event param removed as not used
        setSession(_newSession);
        setAuthUser(newAuthUserParam);
        if (newAuthUserParam) {
          // Fetch profile whenever auth state changes and there's a user
          // This ensures profile is up-to-date if user_metadata changes (e.g., name update)
          try {
            const newProfileData = await authService.getUserProfile(newAuthUserParam.id);
            internalSetProfile(newProfileData);
          } catch (error) {
            console.error("Error fetching profile on auth state change:", error);
            internalSetProfile(null);
          }
        } else {
          internalSetProfile(null);
        }
        if (!_newSession) setIsLoading(false);
      }
    );

    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, []);

  const login = async (credentials: UserCredentials) => {
    setIsLoading(true);
    try {
      const { session: newSession, authUser: newAuthUser, profile: newProfile } = await authService.login(credentials);
      setSession(newSession);
      setAuthUser(newAuthUser);
      internalSetProfile(newProfile);
    } catch (error) {
      console.error('AuthProvider: login failed', error);
      setSession(null);
      setAuthUser(null);
      internalSetProfile(null);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      await authService.logout();
      // Auth listener will handle clearing session, authUser, and profile
    } catch (error) {
      console.error("AuthProvider: Logout failed:", error);
    } 
    // Auth listener should set isLoading to false eventually.
    // If relying purely on listener, no setIsLoading(false) here.
  };

  const hasRole = (roles: Role | Role[]): boolean => {
    if (!profile) return false;
    const userRole = profile.role;
    return Array.isArray(roles) ? roles.includes(userRole) : userRole === roles;
  };

  if (isLoading && !profile && !session) { 
    return (
      <div className="flex items-center justify-center h-screen">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ session, authUser, profile, isLoading, login, logout, hasRole, setProfile: internalSetProfile }}>
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