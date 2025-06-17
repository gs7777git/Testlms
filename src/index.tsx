
import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';

import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { PageShell } from '@/components/PageShell';
import { ProtectedRoute } from '@/components/common/ProtectedRoute';
import ErrorBoundary from '@/components/common/ErrorBoundary';
import { Spinner } from '@/components/common/Spinner';

import { LoginPage } from '@/components/auth/LoginPage';
import { RegisterAdminPage } from '@/components/auth/RegisterAdminPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { LeadsPage } from '@/pages/LeadsPage';
import { DealsPage } from '@/pages/DealsPage'; 
import { UsersPage } from '@/pages/UsersPage';
import { ProductsPage } from '@/pages/ProductsPage';
import { CompaniesPage } from '@/pages/CompaniesPage'; 
import { ContactsPage } from '@/pages/ContactsPage';   
import { TasksPage } from '@/pages/TasksPage'; 
import { SupportPage } from '@/pages/SupportPage';
import { ReportsPage } from '@/pages/ReportsPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { WorkflowsPage } from '@/pages/WorkflowsPage'; // New

import { Role } from '@/types';
import './index.css';

const container = document.getElementById('root');
if (!container) {
  throw new Error("Failed to find the root element. Please ensure your index.html has a div with id 'root'.");
}
const root = createRoot(container);

function App() {
  const { session, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-secondary-100">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <Routes>
      <Route 
        path="/login" 
        element={!session ? <LoginPage /> : <Navigate to="/" replace />} 
      />
      <Route 
        path="/register-organization" 
        element={!session ? <RegisterAdminPage /> : <Navigate to="/" replace />} 
      />

      <Route
        element={
          <ProtectedRoute> 
            <PageShell>    
              <Outlet />   
            </PageShell>
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<DashboardPage />} />
        <Route path="leads" element={<LeadsPage />} />
        <Route path="deals" element={<DealsPage />} />
        <Route path="companies" element={<CompaniesPage />} /> 
        <Route path="contacts" element={<ContactsPage />} />   
        <Route path="tasks" element={<TasksPage />} /> 
        <Route path="workflows" element={<WorkflowsPage />} /> {/* New Route for Workflows */}
        <Route path="support" element={<SupportPage />} /> 
        <Route 
          path="products" 
          element={
            <ProtectedRoute allowedRoles={[Role.ADMIN]}>
              <ProductsPage />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="users" 
          element={
            <ProtectedRoute allowedRoles={[Role.ADMIN]}>
              <UsersPage />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="reports" 
          element={
            <ProtectedRoute allowedRoles={[Role.ADMIN]}>
              <ReportsPage />
            </ProtectedRoute>
          } 
        />
        <Route path="settings" element={<SettingsPage />} />
        
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter basename={(import.meta.env.BASE_URL as string) || '/'}>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>
);
