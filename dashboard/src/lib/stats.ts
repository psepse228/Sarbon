import type { AvailabilityEntry, ConversationSummary, Escalation } from "./types";

export interface DashboardStats {
  totalConversations: number;
  conversationsWithoutEscalation: number;
  openEscalations: number;
  resolvedEscalations: number;
  upcomingAvailable: number;
}

/** Shared by the mobile Analytics page and the desktop Overview page so the
 * two never quietly compute these numbers differently. */
export function computeDashboardStats(
  conversations: ConversationSummary[],
  escalations: Escalation[],
  availability: AvailabilityEntry[],
): DashboardStats {
  const today = new Date().toISOString().slice(0, 10);
  const escalatedConversationIds = new Set(escalations.map((e) => e.conversationId));
  const withoutEscalation = conversations.filter((c) => !escalatedConversationIds.has(c.id)).length;

  return {
    totalConversations: conversations.length,
    conversationsWithoutEscalation: withoutEscalation,
    openEscalations: escalations.filter((e) => !e.notifiedOwner).length,
    resolvedEscalations: escalations.filter((e) => e.notifiedOwner).length,
    upcomingAvailable: availability.filter((a) => a.isAvailable && a.date >= today).length,
  };
}

export interface RecentActivityItem {
  conversationId: string;
  clientId: string;
  channel: string;
  lastMessageAt: string | null;
  status: "escalated" | "resolved";
}

/** Overview's "Последние диалоги" widget. Escalated means the conversation
 * has an escalation row that hasn't been handled yet (same `notifiedOwner`
 * check computeDashboardStats uses) — there's no third state here, since
 * ConversationSummary has no lead/name/message-snippet field to build one
 * from. */
export function selectRecentActivity(
  conversations: ConversationSummary[],
  escalations: Escalation[],
  limit: number,
): RecentActivityItem[] {
  const openEscalationConversationIds = new Set(
    escalations.filter((e) => !e.notifiedOwner).map((e) => e.conversationId),
  );

  return [...conversations]
    .sort((a, b) => {
      const aTime = a.lastMessageAt ?? "";
      const bTime = b.lastMessageAt ?? "";
      return aTime < bTime ? 1 : aTime > bTime ? -1 : 0;
    })
    .slice(0, limit)
    .map((c) => ({
      conversationId: c.id,
      clientId: c.clientId,
      channel: c.channel,
      lastMessageAt: c.lastMessageAt,
      status: openEscalationConversationIds.has(c.id) ? "escalated" as const : "resolved" as const,
    }));
}

/** Overview's "Ближайшие даты" widget — the next N availability_cache rows
 * from today onward, not literally "the next N calendar days," since rows
 * aren't guaranteed contiguous. */
export function selectUpcomingAvailability(availability: AvailabilityEntry[], count: number): AvailabilityEntry[] {
  const today = new Date().toISOString().slice(0, 10);
  return [...availability]
    .filter((a) => a.date >= today)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
    .slice(0, count);
}

/** Parses a plain "YYYY-MM-DD" date (as stored in availability_cache) as a
 * local calendar date, not a UTC instant — `new Date("2026-07-15")` parses
 * as UTC midnight, which renders as the previous day for any viewer west of
 * UTC. */
export function parseLocalDate(isoDate: string): Date {
  const [year, month, day] = isoDate.split("-").map(Number) as [number, number, number];
  return new Date(year, month - 1, day);
}
