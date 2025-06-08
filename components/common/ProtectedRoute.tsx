
import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Role } from '@/types';
import { Spinner } from '@/components/common/Spinner'; // Use @/ alias for clarity

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: Role[];
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles }) => {
  const { profile, isLoading, session } = useAuth(); 
  const location = useLocation();
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!session || !profile) { 
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && allowedRoles.length > 0) {
    const userRole = profile.role;
    const isAllowed = allowedRoles.includes(userRole);
    if (!isAllowed) {
      return <Navigate to="/" replace />; 
    }
  }

  return <>{children}</>;
};