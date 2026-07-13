/**
 * Domain types for the `company_profile` slice of the dashboard.
 *
 * These mirror the jsonb columns on `company_profile`
 * (see supabase/migrations/0001_init_schema.sql) plus a client-generated
 * `id` field on each array item so the dashboard UI has a stable React key
 * and a stable handle for edit/delete — the jsonb blobs themselves have no
 * natural primary key. `backend/app/functions/handlers.py` matches on
 * `name`/`question`/`category`, not `id`, so adding this field is additive
 * and does not change backend behavior. See dashboard/README.md for the
 * "id leaks into function-calling responses" note.
 *
 * `Package`'s non-id fields use the snake_case names already live in
 * Supabase (`includes`/`excludes`/`min_guests`/`max_guests`/`prepayment`/
 * `cancellation_policy`) rather than an invented camelCase — see
 * companyProfile.ts for why (real seeded rows predate this dashboard and
 * don't have an `id`, which is backfilled on read).
 */

export interface Package {
  id: string;
  name: string;
  price: number;
  currency: string;
  includes: string[];
  excludes: string[];
  min_guests: number | null;
  max_guests: number | null;
  prepayment: string;
  cancellation_policy: string;
}

export interface FaqEntry {
  id: string;
  question: string;
  answer: string;
}

export interface Partner {
  id: string;
  category: string;
  name: string;
  contact: string;
}

export interface CompanyProfile {
  tenantId: string;
  packages: Package[];
  faq: FaqEntry[];
  partners: Partner[];
  policies: string;
  activeNotice: string | null;
  companyName: string | null;
  address: string | null;
  phone: string | null;
  socials: string | null;
  disabledSkills: string[];
  updatedAt: string | null;
}

export interface Escalation {
  id: string;
  conversationId: string;
  reason: string;
  notifiedOwner: boolean;
  createdAt: string;
  clientId: string;
  channel: string;
}

export interface KnowledgeGap {
  id: string;
  conversationId: string;
  question: string;
  status: "open" | "answered" | "dismissed";
  answer: string | null;
  createdAt: string;
}

export interface Lead {
  id: string;
  conversationId: string;
  name: string | null;
  phone: string | null;
  preferredDate: string | null;
  guestCount: number | null;
  budget: string | null;
  status: "new" | "contacted" | "booked" | "lost";
  createdAt: string;
}

export interface AvailabilityEntry {
  id: string;
  date: string;
  isAvailable: boolean;
  eventDetails: string;
}

export interface Review {
  id: string;
  conversationId: string;
  rating: number;
  comment: string | null;
  createdAt: string;
}

export type BroadcastAudience = "all" | "leads_new" | "leads_contacted" | "leads_booked";

export interface Broadcast {
  id: string;
  message: string;
  audience: BroadcastAudience;
  recipientCount: number;
  createdAt: string;
}

export interface ConversationSummary {
  id: string;
  clientId: string;
  channel: string;
  status: string;
  lastMessageAt: string | null;
  createdAt: string;
}

export interface ConversationMessage {
  id: string;
  role: string;
  content: string;
  createdAt: string;
}
