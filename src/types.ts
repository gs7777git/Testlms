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
  role: Role; // 'admin' or 'user' (system-level role)
  role_name?: string | null; // Custom display role name, e.g., "Sales Manager"
  org_id: string; // Foreign key to 'organizations' table (UUID)
  parent_user_id?: string | null; // FK to users.id, for manager hierarchy
  manager_name?: string | null; // Denormalized name of the parent_user/manager, populated by service
  created_at: string; // ISO date string
  // Client-side populated or via specific queries:
  manages_users_count?: number;
  dashboard_widgets?: string[]; // For storing user's preferred dashboard widgets
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

// Represents the structure of your 'lead_activities' table
export interface LeadActivity {
  id: string; // PK
  lead_id: string; // FK to leads.id
  user_id: string; // FK to public.users.id (who performed the activity)
  user_full_name?: string; // For display convenience, populated by join
  org_id: string; // FK to organizations.id
  type: string; // e.g., 'call', 'email', 'meeting', 'note_added', 'status_changed', 'follow_up_scheduled', 'follow_up_completed'
  details: string;
  created_at: string; // ISO date string
}

// Represents the structure of your 'lead_follow_ups' table
export enum LeadFollowUpStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}
export interface LeadFollowUp {
  id: string; // PK
  lead_id: string; // FK to leads.id
  user_id: string; // FK to public.users.id (assigned to)
  user_full_name?: string; // For display convenience, populated by join
  org_id: string; // FK to organizations.id
  due_date: string; // ISO date string
  status: LeadFollowUpStatus;
  notes?: string;
  completed_at?: string | null; // ISO date string
  created_at: string; // ISO date string
  updated_at: string; // ISO date string
}

// Represents the structure of your 'products' table
export interface Product {
  id: string; // PK
  org_id: string; // FK to organizations.id
  name: string;
  description?: string;
  price: number; // Default unit price
  created_at: string;
  updated_at: string;
}

// Represents the status of a deal/quotation
export enum DealStatus {
  DRAFT = 'Draft',
  PRESENTED = 'Presented',
  NEGOTIATION = 'Negotiation',
  WON = 'Won',
  LOST = 'Lost',
  CANCELLED = 'Cancelled',
}

// Represents a line item in a deal/quotation
export interface DealItem {
  id: string; // PK for deal_items table
  deal_id: string; // FK to deals.id
  product_id: string; // FK to products.id
  product_name: string; // Denormalized for display
  quantity: number;
  unit_price: number; // Price for this specific deal item (can override product.price)
  total_price: number; // quantity * unit_price
  created_at?: string; // Optional, might not be needed on client always
}

// Represents the structure of your 'companies' table
export interface Company {
  id: string; // PK
  org_id: string; // FK to organizations.id
  name: string;
  industry?: string;
  website?: string;
  phone_office?: string;
  address_street?: string;
  address_city?: string;
  address_state?: string;
  address_postal_code?: string;
  address_country?: string;
  created_at: string;
  updated_at: string;
}

// Represents the structure of your 'contacts' table
export interface Contact {
  id: string; // PK
  org_id: string; // FK to organizations.id
  company_id: string; // FK to companies.id
  company_name?: string; // Denormalized for display convenience
  first_name: string;
  last_name: string;
  email_primary?: string;
  phone_work?: string;
  phone_mobile?: string;
  designation?: string;
  created_at: string;
  updated_at: string;
}


// Represents the structure of your 'deals' table
export interface Deal {
  id: string; // PK
  lead_id: string; // FK to leads.id
  org_id: string; // FK to organizations.id
  deal_name: string;
  status: DealStatus;
  total_value: number; // Sum of all deal_items.total_price
  created_by_user_id: string; // FK to public.users.id
  created_by_user_name?: string; // For display
  company_id?: string | null; // FK to companies.id
  contact_id?: string | null; // FK to contacts.id
  company_name?: string; // Denormalized for display
  contact_name?: string; // Denormalized for display (Contact's full name)
  lead_name?: string; // Denormalized lead name for display on deal card/list
  created_at: string;
  updated_at: string;
  items: DealItem[]; // Deal line items, populated client-side or by join
}


// Represents the structure of your 'leads' table
// Adding optional fields that might come from CSV import directly
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
  company_id?: string | null; // FK to companies.id
  contact_id?: string | null; // FK to contacts.id
  company_name?: string; // Denormalized for display OR direct import if no ID link
  contact_name?: string; // Denormalized for display OR direct import if no ID link
  notes?: string; // A general notes field on the lead itself
  created_at: string; // ISO date string
  updated_at: string; // ISO date string
  activities?: LeadActivity[]; // Populated client-side when viewing details
  follow_ups?: LeadFollowUp[]; // Populated client-side when viewing details
  deals?: Deal[]; // Populated client-side if needed on lead card, or fetched in modal
}

export type ImportedLeadData = Partial<Pick<Lead, 'name' | 'email' | 'mobile' | 'source' | 'status' | 'stage' | 'notes' | 'company_name' | 'contact_name' >> & {
  [key: string]: any; // Allows for other columns from CSV
};


// Represents the structure of your 'organizations' table
export interface Organization {
  id: string; // Primary key (UUID)
  name: string;
  created_at: string; // ISO date string
}

export interface NavigationItem {
  name: string;
  href: string;
  icon: React.FC<React.SVGProps<SVGSVGElement>>;
  roles?: Role[]; // Roles that can see this item
  current?: boolean; // For active state styling
}

// Generic chart data point (can be used if a charting library expects this shape)
export interface ChartDataPoint {
  name: string; // e.g., status name, source name
  value: number; // e.g., count of leads
  total_value?: number; // Optional for deals
}

// Specific report structures for clarity
export interface LeadsByStatusReportItem {
  status: LeadStatus;
  count: number;
}
export interface LeadsBySourceReportItem {
  source: string;
  count: number;
}
export interface DealsByStatusReportItem {
  status: DealStatus;
  count: number;
  total_value: number;
}


export interface SalesReportData {
  totalLeads?: number;
  convertedLeadsCount?: number;
  lostLeadsCount?: number;
  newLeadsCount?: number;
  contactedLeadsCount?: number;
  qualifiedLeadsCount?: number;
  conversionRate?: number; // Percentage ((Converted / (Total Relevant)) * 100)
  leadsByStatus?: LeadsByStatusReportItem[];
  leadsBySource?: LeadsBySourceReportItem[];
  totalDeals?: number;
  totalWonDealsValue?: number;
  dealsByStatus?: DealsByStatusReportItem[];
}

// For Deals Page specific summary
export interface DealPageReportData {
    totalDealsCount: number;
    openDealsValue: number;
    wonDealsValue: number;
    avgWonDealSize: number;
    dealsByStatus?: DealsByStatusReportItem[]; // For the chart on DealsPage
}

// Task Management Types
export enum TaskStatus {
  TO_DO = 'To Do',
  IN_PROGRESS = 'In Progress',
  DONE = 'Done',
  BLOCKED = 'Blocked',
  CANCELLED = 'Cancelled',
}

export enum TaskPriority {
  LOW = 'Low',
  MEDIUM = 'Medium',
  HIGH = 'High',
  URGENT = 'Urgent',
}

export interface TaskComment {
  id: string; // PK
  task_id: string; // FK to tasks.id
  user_id: string; // FK to public.users.id
  user_full_name?: string; // Denormalized
  comment: string;
  created_at: string;
  org_id: string; // Added org_id for RLS consistency
}

export interface Task {
  id: string; // PK
  org_id: string; // FK to organizations.id
  title: string;
  description?: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  assigned_to_user_id: string; // FK to public.users.id
  assigned_to_user_name?: string; // Denormalized
  due_date?: string | null; // ISO date string
  created_by_user_id: string; // FK to public.users.id
  created_by_user_name?: string; // Denormalized
  related_lead_id?: string | null; // Optional FK to leads.id
  related_lead_name?: string | null; // Denormalized
  related_company_id?: string | null; // Optional FK to companies.id
  related_company_name?: string | null; // Denormalized
  related_contact_id?: string | null; // Optional FK to contacts.id
  related_contact_name?: string | null; // Denormalized
  created_at: string;
  updated_at: string;
  comments?: TaskComment[]; // Populated on demand
}

// For Task Dashboard specific summary
export interface TaskDashboardStats {
  totalTasks: number;
  openTasks: number;
  overdueTasks: number;
  tasksByStatus?: { status: TaskStatus; count: number }[];
  tasksByPriority?: { priority: TaskPriority; count: number }[];
}

// Support Ticket Types
export enum TicketStatus {
  OPEN = 'Open',
  IN_PROGRESS = 'In Progress',
  ON_HOLD = 'On Hold',
  RESOLVED = 'Resolved',
  CLOSED = 'Closed',
}

export enum TicketPriority {
  LOW = 'Low',
  MEDIUM = 'Medium',
  HIGH = 'High',
  URGENT = 'Urgent',
}

export interface Ticket {
  id: string; // PK
  ticket_uid: string; // User-friendly ticket ID (e.g., TCK-2023-001)
  org_id: string; // FK to organizations.id
  subject: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  requester_info?: string; // e.g., email or name of external requester, or internal user ID if applicable
  assigned_to_user_id?: string | null; // FK to public.users.id (assigned support agent)
  assigned_to_user_name?: string | null; // Denormalized
  created_by_user_id: string; // FK to public.users.id (who reported/created the ticket)
  created_by_user_name?: string; // Denormalized
  related_lead_id?: string | null;
  related_company_id?: string | null;
  related_contact_id?: string | null;
  created_at: string;
  updated_at: string;
  resolved_at?: string | null;
  closed_at?: string | null;
  // comments?: TicketComment[]; // If you add ticket comments similar to task comments
}


export type { SupabaseAuthUser };