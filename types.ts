
import React from 'react';
import { User as SupabaseAuthUser } from '@supabase/supabase-js'; // For Supabase auth user type

export enum Role {
  ADMIN = 'admin', // Matches Supabase 'users' table 'role' column
  USER = 'user',   // Matches Supabase 'users' table 'role' column
}

// Represents the structure of your 'public.users' table
export interface UserProfile {
  id: string; // Primary key of 'public.users' table (UUID)
  auth_user_id: string; // Foreign key to supabase.auth.users.id (UUID)
  email: string;
  full_name: string;
  role: Role; // 'admin' or 'user'
  org_id: string; // Foreign key to 'organizations' table (UUID)
  created_at: string; // ISO date string
}

// This will be the user object available in the AuthContext after profile fetch
export type AuthenticatedUser = UserProfile;

export enum LeadStatus {
  NEW = 'New',
  CONTACTED = 'Contacted',
  QUALIFIED = 'Qualified',
  CONVERTED = 'Converted',
  LOST = 'Lost',
}

// Represents the structure of your 'leads' table
export interface Lead {
  id: string; // Primary key of 'leads' table (UUID)
  name: string;
  email: string;
  mobile: string;
  source: string;
  status: LeadStatus;
  stage?: string; // Optional: as per your schema 'stage' field
  org_id: string; // Foreign key to 'organizations' table
  owner_user_id: string | null; // Foreign key to 'public.users.id'
  owner_name?: string; // For display convenience, populated client-side or by join
  notes?: string; // A general notes field on the lead itself
  created_at: string; // ISO date string
  updated_at: string; // ISO date string
}

// Represents the structure of your 'organizations' table
export interface Organization {
  id: string; // Primary key (UUID)
  name: string;
  created_at: string; // ISO date string
}

// Example for lead_notes if you plan to manage them directly in UI
export interface LeadNote {
  id: string; // PK
  content: string;
  user_id: string; // FK to public.users.id
  lead_id: string; // FK to leads.id
  org_id: string; // FK to organizations.id
  created_at: string;
}

// Example for lead_activities if you plan to manage them directly in UI
export interface LeadActivity {
  id: string; // PK
  type: string; // e.g., 'call', 'email', 'meeting'
  details: string;
  lead_id: string; // FK to leads.id
  user_id: string; // FK to public.users.id
  org_id: string; // FK to organizations.id
  created_at: string;
}


export interface NavigationItem {
  name: string;
  href: string;
  icon: React.FC<React.SVGProps<SVGSVGElement>>;
  roles?: Role[]; // Roles that can see this item
  current?: boolean; // For active state styling
}

export interface ChartDataPoint {
  name: string;
  value: number;
}

export interface SalesReportData {
  totalLeads: number;
  convertedLeads: number;
  lostLeads: number;
  conversionRate: number; // Percentage
  leadsByStatus: ChartDataPoint[];
  leadsBySource: ChartDataPoint[];
}

// Export Supabase Auth User type if needed directly in components, though AuthContext will provide it.
export type { SupabaseAuthUser };
