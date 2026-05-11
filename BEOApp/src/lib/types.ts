// Domain types — must mirror the Django serializers in api/views.py.

export type UserRole = 'client' | 'planner';

export interface Organization {
  id: number;
  name: string;
  slug: string;
  brand_color: string;
  logo_url: string;
}

export interface User {
  id: number;
  email: string;
  username: string;
  name: string;
  role: UserRole;
  organization?: Organization;
}

export type EventType =
  | 'corporate' | 'wedding' | 'conference' | 'social' | 'nonprofit' | 'other';

export type FoodService =
  | 'none' | 'light' | 'plated' | 'buffet' | 'cocktail';

export type TechNeeds =
  | 'none' | 'basic_av' | 'full_av' | 'livestream';

export type EventStatus =
  | 'new' | 'in_review' | 'confirmed' | 'declined' | 'completed';

export interface EventRequest {
  id: number;
  client_name: string;
  client_email: string;
  client_phone: string;
  client_org: string;
  event_name: string;
  event_type: EventType;
  preferred_date: string | null;
  alternate_date: string | null;
  start_time: string | null;
  end_time: string | null;
  headcount: number;
  venue_preference: string;
  food_service: FoodService;
  dietary_notes: string;
  tech_needs: TechNeeds;
  rsvp_required: boolean;
  notes: string;
  status: EventStatus;
  organizer_note: string;
  submitted_at: string;
  updated_at: string;
  organization?: Organization;
}

export type InventoryCategory =
  | 'table' | 'chair' | 'food' | 'beverage' | 'av' | 'linen' | 'serviceware' | 'other';

export interface InventoryItem {
  id: number;
  name: string;
  category: InventoryCategory;
  unit: string;
  quantity_on_hand: number;
  unit_price: string;
  low_stock_threshold: number;
  is_low_stock: boolean;
  notes: string;
  updated_at: string;
}

export type TeamRole =
  | 'coordinator' | 'chef' | 'bartender' | 'server' | 'it' | 'setup' | 'security' | 'vendor' | 'other';

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

// Display labels — single source of truth so screens don't redefine these.
export const EVENT_TYPE_LABEL: Record<EventType, string> = {
  corporate:  'Corporate',
  wedding:    'Wedding',
  conference: 'Conference',
  social:     'Social / Private',
  nonprofit:  'Nonprofit',
  other:      'Other',
};

export const FOOD_SERVICE_LABEL: Record<FoodService, string> = {
  none:     'No food',
  light:    'Light bites',
  plated:   'Plated meal',
  buffet:   'Buffet',
  cocktail: 'Cocktail apps',
};

export const TECH_NEEDS_LABEL: Record<TechNeeds, string> = {
  none:       'None',
  basic_av:   'Basic A/V',
  full_av:    'Full A/V',
  livestream: 'Livestream',
};

export const STATUS_LABEL: Record<EventStatus, string> = {
  new:       'New',
  in_review: 'In Review',
  confirmed: 'Confirmed',
  declined:  'Declined',
  completed: 'Completed',
};

// Status tinting for badges. Tailwind classes.
export const STATUS_TONE: Record<EventStatus, { bg: string; text: string }> = {
  new:       { bg: 'bg-brand-50',  text: 'text-brand-700' },
  in_review: { bg: 'bg-warning-500/10', text: 'text-warning-600' },
  confirmed: { bg: 'bg-success-500/10', text: 'text-success-600' },
  declined:  { bg: 'bg-danger-500/10',  text: 'text-danger-600' },
  completed: { bg: 'bg-ink-200', text: 'text-ink-700' },
};
