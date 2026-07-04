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
 */

export interface Package {
  id: string;
  name: string;
  price: number;
  currency: string;
  included: string[];
  excluded: string[];
  guestsMin: number | null;
  guestsMax: number | null;
  prepaymentTerms: string;
  cancellationTerms: string;
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
  updatedAt: string | null;
}
