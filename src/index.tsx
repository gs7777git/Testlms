import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';

import { AuthProvider } from '@/contexts/AuthContext';
import { PageShell } from '@/components/PageShell';
import { LoginPage } from '@/components/auth/LoginPage';
import { RegisterAdminPage } from '@/components/auth/RegisterAdminPage';
import { ProtectedRoute } from '@/components/common/ProtectedRoute';
import ErrorBoundary from '@/components/common/ErrorBoundary';

import { DashboardPage } from '@/pages/DashboardPage';
import { LeadsPage } from '@/pages/LeadsPage';
import { UsersPage } from '@/pages/UsersPage';
import { ReportsPage } from '@/pages/ReportsPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { Role } from '@/types'; 

import './index.css'; // Import global CSS including Tailwind

console.log('index.tsx: script starting');

const AppLayout: React.FC = () => {
  return (
    <ProtectedRoute>
      <PageShell>
        <Outlet /> {/* Child routes will render here */}
      </PageShell>
    </ProtectedRoute>
  );
};

const App: React.FC = () => {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register-organization" element={<RegisterAdminPage />} />
      <Route element={<AppLayout />}>
        <Route path="/" element={<DashboardPage />} />
        <Route 
          path="/leads" 
          element={
            <ProtectedRoute allowedRoles={[Role.ADMIN, Role.USER]}>
              <LeadsPage />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/users" 
          element={
            <ProtectedRoute allowedRoles={[Role.ADMIN]}>
              <UsersPage />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/reports" 
          element={
            <ProtectedRoute allowedRoles={[Role.ADMIN]}>
              <ReportsPage />
            </ProtectedRoute>
          } 
        />
        <Route 
            path="/settings" 
            element={
            <ProtectedRoute allowedRoles={[Role.ADMIN, Role.USER]}>
                <SettingsPage />
            </ProtectedRoute>
            } 
        />
        <Route path="*" element={<Navigate to="/" replace />} /> 
      </Route>
    </Routes>
  );
};

const container = document.getElementById('root');
if (container) {
  console.log('index.tsx: Root container (#root) found.');
  const root = createRoot(container);
  // For Netlify, basename is typically '/', which is default for BrowserRouter.
  // If deploying to a subfolder and Vite's `base` config isn't enough,
  // you might set it here, e.g., <BrowserRouter basename="/my-app">
  const appBasename = import.meta.env.BASE_URL || '/';
  console.log('index.tsx: appBasename from import.meta.env.BASE_URL:', appBasename);


  root.render(
    <React.StrictMode>
      <BrowserRouter basename={appBasename}>
        <ErrorBoundary>
          <AuthProvider>
            <App />
          </AuthProvider>
        </ErrorBoundary>
      </BrowserRouter>
    </React.StrictMode>
  );
  console.log('index.tsx: React app rendered.');
} else {
  console.error('index.tsx: Failed to find the root element (#root). App cannot be rendered.');
}