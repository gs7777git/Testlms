
import { Role, LeadStatus } from './types';

export const APP_NAME = "CRM Pro";

export const LEAD_STATUS_OPTIONS: LeadStatus[] = [
  LeadStatus.NEW,
  LeadStatus.CONTACTED,
  LeadStatus.QUALIFIED,
  LeadStatus.CONVERTED,
  LeadStatus.LOST,
];

// Simplified user roles based on Supabase schema
export const USER_ROLE_OPTIONS: Role[] = [
  Role.ADMIN,
  Role.USER,
];

export const DEFAULT_FILTERS = {
  status: '',
  source: '',
  assignedTo: '', // This might map to owner_user_id
};

// Supabase Configuration 
export const SUPABASE_URL = 'https://rmstjseenlcnfwhhikml.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJtc3Rqc2VlbmxjbmZ3aGhpa21sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg5MzAxNzUsImV4cCI6MjA2NDUwNjE3NX0.d599J5lWmwVLwZprMI7Cd572NmLdFHH_ApyzKcAwdSc';