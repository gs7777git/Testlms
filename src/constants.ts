
import { Role, LeadStatus, DealStatus, TaskStatus, TaskPriority, TicketStatus, TicketPriority } from '@/types';

// This global declaration helps TypeScript understand Vite's import.meta.env structure.
// Ideally, this is handled by tsconfig.json: "types": ["vite/client"] or a vite-env.d.ts file.
declare global {
  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }

  interface ImportMetaEnv {
    readonly VITE_SUPABASE_URL: string;
    readonly VITE_SUPABASE_ANON_KEY: string;
    BASE_URL: string; // For Vite's base path, used in src/index.tsx
  }
}


export const APP_NAME = "CRM Pro";

export const LEAD_STATUS_OPTIONS: LeadStatus[] = [
  LeadStatus.NEW,
  LeadStatus.CONTACTED,
  LeadStatus.QUALIFIED,
  LeadStatus.CONVERTED,
  LeadStatus.LOST,
];

export const DEAL_STATUS_OPTIONS: DealStatus[] = [
  DealStatus.DRAFT,
  DealStatus.PRESENTED,
  DealStatus.NEGOTIATION,
  DealStatus.WON,
  DealStatus.LOST,
  DealStatus.CANCELLED,
];

// Simplified user roles based on Supabase schema
export const USER_ROLE_OPTIONS: Role[] = [
  Role.ADMIN,
  Role.USER,
];

export const TASK_STATUS_OPTIONS: TaskStatus[] = [
  TaskStatus.TO_DO,
  TaskStatus.IN_PROGRESS,
  TaskStatus.DONE,
  TaskStatus.BLOCKED,
  TaskStatus.CANCELLED,
];

export const TASK_PRIORITY_OPTIONS: TaskPriority[] = [
  TaskPriority.LOW,
  TaskPriority.MEDIUM,
  TaskPriority.HIGH,
  TaskPriority.URGENT,
];

export const TICKET_STATUS_OPTIONS: TicketStatus[] = [
  TicketStatus.OPEN,
  TicketStatus.IN_PROGRESS,
  TicketStatus.ON_HOLD,
  TicketStatus.RESOLVED,
  TicketStatus.CLOSED,
];

export const TICKET_PRIORITY_OPTIONS: TicketPriority[] = [
  TicketPriority.LOW,
  TicketPriority.MEDIUM,
  TicketPriority.HIGH,
  TicketPriority.URGENT,
];


export const DEFAULT_FILTERS = {
  status: '',
  source: '',
  assignedTo: '', // This might map to owner_user_id
};

export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  const message = "CRITICAL ERROR: Supabase URL or Anon Key is missing. " +
    "The application will not function correctly. " +
    "Please ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set in your .env file (for local development) " +
    "and in your Netlify environment variables (for deployment).";
  console.error(message);
  alert(message); 
}