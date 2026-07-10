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
