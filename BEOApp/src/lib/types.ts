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
  team_member: TeamMember | null;
  vendor_company: { id: number; name: string } | null;
  staff_count: number;
  role_on_event: string;
  status: AssignmentStatus;
  notes: string;
  assigned_at: string;
}

// ── Sites + Venues ────────────────────────────────────────────────────────

export type VenueLayout =
  | 'theater' | 'classroom' | 'banquet' | 'reception'
  | 'cocktail' | 'boardroom' | 'ushape' | 'hollow' | 'custom';

export interface Site {
  id: number;
  name: string;
  address_line1: string;
  address_line2: string;
  city: string;
  state_region: string;
  postal_code: string;
  country: string;
  owner_name: string;
  operator_name: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  website: string;
  notes: string;
  updated_at: string;
  venues?: SiteVenue[];
}

export interface SiteVenue {
  id: number;
  site: number;
  site_name: string;
  name: string;
  capacity_min: number;
  capacity_max: number;
  square_footage: number;
  supported_layouts: VenueLayout[];
  has_av: boolean;
  has_stage: boolean;
  has_dance_floor: boolean;
  has_kitchen_access: boolean;
  has_outdoor_access: boolean;
  is_accessible: boolean;
  has_natural_light: boolean;
  photo_urls: string[];
  base_hourly_rate: string;
  notes: string;
  is_active: boolean;
  updated_at: string;
}

export const VENUE_LAYOUT_LABEL: Record<VenueLayout, string> = {
  theater:   'Theater',
  classroom: 'Classroom',
  banquet:   'Banquet (rounds)',
  reception: 'Reception',
  cocktail:  'Cocktail',
  boardroom: 'Boardroom',
  ushape:    'U-shape',
  hollow:    'Hollow square',
  custom:    'Custom',
};

// ── Companies + Contacts ──────────────────────────────────────────────────

export type CompanyKind = 'client' | 'vendor' | 'both';

export interface Company {
  id: number;
  name: string;
  kind: CompanyKind;
  industry: string;
  website: string;
  address: string;
  billing_email: string;
  phone: string;
  services: string[];
  notes: string;
  is_vendor: boolean;
  is_client: boolean;
  updated_at: string;
  contacts?: Array<{
    id: number;
    full_name: string;
    email: string;
    role_title: string;
    is_primary: boolean;
  }>;
}

export interface Contact {
  id: number;
  first_name: string;
  last_name: string;
  full_name: string;
  email: string;
  phone: string;
  title: string;
  tags: string[];
  notes: string;
  updated_at: string;
  companies?: Array<{
    company_id: number;
    company_name: string;
    company_kind: CompanyKind;
    role_title: string;
    is_primary: boolean;
  }>;
}

// ── Events (Calendar) ─────────────────────────────────────────────────────

export type EventCalStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled';

export interface CalendarEvent {
  id: number;
  source_request: number | null;
  name: string;
  event_type: EventType;
  starts_at: string;
  ends_at: string;
  headcount: number;
  status: EventCalStatus;
  food_service: FoodService;
  tech_needs: TechNeeds;
  rsvp_required: boolean;
  description: string;
  color: string;
  contact: { id: number; full_name: string; email: string } | null;
  site_venue: { id: number; name: string; site_name: string } | null;
  updated_at: string;
}

export const EVENT_CAL_STATUS_LABEL: Record<EventCalStatus, string> = {
  scheduled:   'Scheduled',
  in_progress: 'In Progress',
  completed:   'Completed',
  cancelled:   'Cancelled',
};

export const EVENT_CAL_STATUS_TONE: Record<EventCalStatus, { bg: string; text: string }> = {
  scheduled:   { bg: 'bg-brand-50',       text: 'text-brand-700' },
  in_progress: { bg: 'bg-warning-500/10', text: 'text-warning-600' },
  completed:   { bg: 'bg-success-500/10', text: 'text-success-600' },
  cancelled:   { bg: 'bg-ink-200',        text: 'text-ink-700' },
};

// ── Inventory: Perishables + Hardware ────────────────────────────────────

export type PerishableCategory =
  | 'produce' | 'protein' | 'dairy' | 'bakery' | 'dry_goods'
  | 'beverage' | 'alcohol' | 'garnish' | 'other';

export type PerishableStorage = 'pantry' | 'cooler' | 'freezer' | 'cellar';

export interface Perishable {
  id: number;
  kind: 'perishable';
  name: string;
  unit: string;
  quantity_on_hand: string;
  unit_cost: string;
  unit_price: string;
  low_stock_threshold: string;
  is_low_stock: boolean;
  is_active: boolean;
  notes: string;
  category: PerishableCategory;
  storage: PerishableStorage;
  supplier: string;
  lot_number: string;
  expiry_date: string | null;
  last_restocked: string | null;
  allergens: string[];
  is_expired: boolean;
  days_until_expiry: number | null;
  updated_at: string;
}

export type HardwareCategory =
  | 'table' | 'chair' | 'linen' | 'serviceware' | 'av'
  | 'lighting' | 'staging' | 'decor' | 'heating' | 'other';

export type HardwareCondition =
  | 'new' | 'excellent' | 'good' | 'fair' | 'needs_repair' | 'retired';

export interface Hardware {
  id: number;
  kind: 'hardware';
  name: string;
  unit: string;
  quantity_on_hand: string;
  unit_cost: string;
  unit_price: string;
  low_stock_threshold: string;
  is_low_stock: boolean;
  is_active: boolean;
  notes: string;
  category: HardwareCategory;
  condition: HardwareCondition;
  serial_number: string;
  storage_location: string;
  purchase_date: string | null;
  purchase_cost: string;
  last_serviced: string | null;
  service_notes: string;
  updated_at: string;
}

export const PERISHABLE_CATEGORY_LABEL: Record<PerishableCategory, string> = {
  produce: 'Produce', protein: 'Protein', dairy: 'Dairy', bakery: 'Bakery',
  dry_goods: 'Dry goods', beverage: 'Beverages', alcohol: 'Alcohol',
  garnish: 'Garnish', other: 'Other',
};

export const HARDWARE_CATEGORY_LABEL: Record<HardwareCategory, string> = {
  table: 'Tables', chair: 'Chairs', linen: 'Linens',
  serviceware: 'Serviceware', av: 'A/V', lighting: 'Lighting',
  staging: 'Staging', decor: 'Decor', heating: 'Heating', other: 'Other',
};

export const HARDWARE_CONDITION_LABEL: Record<HardwareCondition, string> = {
  new: 'New', excellent: 'Excellent', good: 'Good', fair: 'Fair',
  needs_repair: 'Needs repair', retired: 'Retired',
};

// ── Teammates ─────────────────────────────────────────────────────────────

export type EmploymentType = 'staff' | 'temp';

export const EMPLOYMENT_LABEL: Record<EmploymentType, string> = {
  staff: 'Staff', temp: 'Temp',
};

// ── Message Templates ─────────────────────────────────────────────────────

export type TemplateKind =
  | 'beo' | 'guest_email' | 'guest_sms' | 'vendor_email' | 'vendor_sms'
  | 'internal_email' | 'contract' | 'invoice' | 'other';

export type TemplateChannel = 'email' | 'sms' | 'pdf';

export interface MessageTemplate {
  id: number;
  name: string;
  kind: TemplateKind;
  channel: TemplateChannel;
  subject: string;
  body: string;
  is_active: boolean;
  is_default: boolean;
  updated_at: string;
}

export const TEMPLATE_KIND_LABEL: Record<TemplateKind, string> = {
  beo:              'BEO',
  guest_email:      'Guest email',
  guest_sms:        'Guest SMS',
  vendor_email:     'Vendor email',
  vendor_sms:       'Vendor SMS',
  internal_email:   'Internal email',
  contract:         'Contract',
  invoice:          'Invoice',
  other:            'Other',
};

export interface TokenCatalogEntry {
  path: string;
  label: string;
  example: string;
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
