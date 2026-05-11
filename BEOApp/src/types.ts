export interface BeoItem {
  id: string;       // uuid-like: Date.now().toString()
  uri: string;      // local file URI from document picker
  name: string;     // display name
  addedAt: string;  // ISO date string
}

export interface WeekFile {
  id: number;
  name: string;
}

export interface BEOWeek {
  id: number;
  label: string;
  week_start: string;   // YYYY-MM-DD
  file_count: number;
  files: WeekFile[];
}

export type EventType    = 'corporate' | 'wedding' | 'conference' | 'social' | 'nonprofit' | 'other';
export type FoodService  = 'none' | 'light' | 'plated' | 'buffet' | 'cocktail';
export type TechNeeds    = 'none' | 'basic_av' | 'full_av' | 'livestream';
export type RequestStatus = 'new' | 'in_review' | 'confirmed' | 'declined' | 'completed';

export interface EventRequest {
  id: number;
  // Client
  client_name:   string;
  client_email:  string;
  client_phone:  string;
  organization:  string;
  // Event
  event_name:    string;
  event_type:    EventType;
  preferred_date: string;       // YYYY-MM-DD
  alternate_date: string | null;
  start_time:    string;        // HH:MM
  end_time:      string;        // HH:MM
  headcount:     number;
  // Selections
  venue_preference: string;
  food_service:  FoodService;
  dietary_notes: string;
  tech_needs:    TechNeeds;
  rsvp_required: boolean;
  notes:         string;
  // Organizer
  status:         RequestStatus;
  organizer_note: string;
  submitted_at:   string;       // ISO
  updated_at:     string;
}

// ── Auth ────────────────────────────────────────────────────────────────────
export interface AuthUser {
  id:       number;
  email:    string;
  username: string;
  name:     string;
}

// ── Inventory ───────────────────────────────────────────────────────────────
export type InventoryCategory =
  | 'table' | 'chair' | 'food' | 'beverage' | 'av' | 'linen' | 'serviceware' | 'other';

export interface InventoryItem {
  id: number;
  name: string;
  category: InventoryCategory;
  unit: string;
  quantity_on_hand: number;
  unit_price: string;            // decimal serialized as string
  low_stock_threshold: number;
  is_low_stock: boolean;
  notes: string;
  updated_at: string;
}

// ── Team ────────────────────────────────────────────────────────────────────
export type TeamRole =
  | 'coordinator' | 'chef' | 'bartender' | 'server' | 'it'
  | 'setup' | 'security' | 'vendor' | 'other';

export interface TeamMember {
  id: number;
  name: string;
  email: string;
  phone: string;
  role: TeamRole;
  is_vendor: boolean;
  company: string;
  notes: string;
}

export type AssignmentStatus = 'assigned' | 'confirmed' | 'declined';

export interface EventAssignment {
  id: number;
  event_request: number;
  team_member: TeamMember;
  role_on_event: string;
  status: AssignmentStatus;
  notes: string;
  assigned_at: string;
}

// ── Workflows ───────────────────────────────────────────────────────────────
export type WorkflowTrigger =
  | 'on_submit'
  | 'on_status_new'
  | 'on_status_in_review'
  | 'on_status_confirmed'
  | 'on_status_declined'
  | 'on_status_completed';

export type WorkflowActionType =
  | 'send_email' | 'add_organizer_note' | 'set_status';

export interface WorkflowAction {
  id: number;
  workflow: number;
  order: number;
  action_type: WorkflowActionType;
  config: Record<string, any>;
}

export interface Workflow {
  id: number;
  name: string;
  trigger: WorkflowTrigger;
  is_active: boolean;
  actions: WorkflowAction[];
  created_at: string;
  updated_at: string;
}

export interface WorkflowRun {
  id: number;
  workflow: number;
  workflow_name: string;
  event_request: number;
  ran_at: string;
  success: boolean;
  log: string;
}
