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

// Supabase Configuration - Use environment variables
// These will be replaced by Vite during the build process.
// You need to set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file (for local dev)
// and in your Netlify environment settings.
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error(
    "Supabase URL or Anon Key is missing. " +
    "Make sure to set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your environment variables."
  );
  // Optionally, throw an error to halt execution if these are critical
  // throw new Error("Supabase configuration is missing.");
}
