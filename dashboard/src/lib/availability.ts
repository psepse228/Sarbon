import "server-only";

import { getServiceSupabaseClient } from "./supabase/server";
import type { AvailabilityEntry } from "./types";

interface RawAvailabilityRow {
  id: string;
  date: string;
  is_available: boolean | null;
  event_details: string | null;
}

export async function fetchAvailability(tenantId: string): Promise<AvailabilityEntry[]> {
  const client = getServiceSupabaseClient();
  const { data, error } = await client
    .from("availability_cache")
    .select("id,date,is_available,event_details")
    .eq("tenant_id", tenantId)
    .order("date", { ascending: true })
    .returns<RawAvailabilityRow[]>();

  if (error) {
    throw new Error(`Failed to load availability: ${error.message}`);
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    date: row.date,
    isAvailable: row.is_available ?? true,
    eventDetails: row.event_details ?? "",
  }));
}

export async function upsertAvailability(
  tenantId: string,
  date: string,
  isAvailable: boolean,
  eventDetails: string,
): Promise<void> {
  const client = getServiceSupabaseClient();

  const { data: existing, error: selectError } = await client
    .from("availability_cache")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("date", date)
    .maybeSingle<{ id: string }>();

  if (selectError) {
    throw new Error(`Failed to look up date: ${selectError.message}`);
  }

  if (existing) {
    const { error } = await client
      .from("availability_cache")
      .update({ is_available: isAvailable, event_details: eventDetails, synced_at: new Date().toISOString() })
      .eq("id", existing.id);
    if (error) {
      throw new Error(`Failed to update date: ${error.message}`);
    }
    return;
  }

  const { error } = await client
    .from("availability_cache")
    .insert({ tenant_id: tenantId, date, is_available: isAvailable, event_details: eventDetails });
  if (error) {
    throw new Error(`Failed to create date: ${error.message}`);
  }
}

export async function deleteAvailability(tenantId: string, id: string): Promise<void> {
  const client = getServiceSupabaseClient();
  const { error } = await client
    .from("availability_cache")
    .delete()
    .eq("id", id)
    .eq("tenant_id", tenantId);

  if (error) {
    throw new Error(`Failed to delete date: ${error.message}`);
  }
}
