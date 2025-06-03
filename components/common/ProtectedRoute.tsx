
import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Role } from '../../types';
import { Spinner } from './Spinner';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: Role[];
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles }) => {
  const { profile, isLoading, session } = useAuth(); // Using profile for roles, session for auth check
  const location = useLocation();
  
  // console.log(
  //   'ProtectedRoute: Path:', location.pathname,
  //   'isLoading:', isLoading, 
  //   'Session exists:', !!session,
  //   'Profile exists:', !!profile,
  //   'Profile role:', profile?.role,
  //   'Allowed roles:', allowedRoles
  // );

  if (isLoading) {
    // console.log('ProtectedRoute: Auth isLoading is true, rendering Spinner.');
    return (
      <div className="flex items-center justify-center h-screen">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!session || !profile) { // User must have a session AND a profile
    // console.log('ProtectedRoute: User not authenticated or profile missing. Redirecting to /login.');
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Role check uses profile.role
  if (allowedRoles && allowedRoles.length > 0) {
    const userRole = profile.role;
    const isAllowed = allowedRoles.includes(userRole);
    if (!isAllowed) {
    //   console.log('ProtectedRoute: User does not have required role. User role:', userRole, 'Allowed roles:', allowedRoles, 'Redirecting to / (dashboard).');
      return <Navigate to="/" replace />; // Redirect to dashboard or a specific "access denied" page
    }
  }

  // console.log('ProtectedRoute: User authenticated and has required role (if any). Rendering children for path:', location.pathname);
  return <>{children}</>;
};