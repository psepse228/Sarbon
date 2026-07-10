import { describe, expect, it } from "vitest";

import { computeDashboardStats } from "@/lib/stats";
import type { AvailabilityEntry, ConversationSummary, Escalation } from "@/lib/types";

function conversation(id: string): ConversationSummary {
  return { id, clientId: "client-1", channel: "telegram", status: "active", lastMessageAt: null, createdAt: "2026-07-01T00:00:00Z" };
}

function escalation(conversationId: string, notifiedOwner: boolean): Escalation {
  return { id: `esc-${conversationId}`, conversationId, reason: "test", notifiedOwner, createdAt: "2026-07-01T00:00:00Z", clientId: "client-1", channel: "telegram" };
}

function availability(date: string, isAvailable: boolean): AvailabilityEntry {
  return { id: `av-${date}`, date, isAvailable, eventDetails: "" };
}

describe("computeDashboardStats", () => {
  it("counts conversations without escalation and open/resolved escalations", () => {
    const conversations = [conversation("c1"), conversation("c2"), conversation("c3")];
    const escalations = [escalation("c1", false), escalation("c2", true)];

    const stats = computeDashboardStats(conversations, escalations, []);

    expect(stats.totalConversations).toBe(3);
    expect(stats.conversationsWithoutEscalation).toBe(1);
    expect(stats.openEscalations).toBe(1);
    expect(stats.resolvedEscalations).toBe(1);
  });

  it("counts only future available dates", () => {
    const past = availability("2020-01-01", true);
    const futureAvailable = availability("2099-01-01", true);
    const futureUnavailable = availability("2099-01-02", false);

    const stats = computeDashboardStats([], [], [past, futureAvailable, futureUnavailable]);

    expect(stats.upcomingAvailable).toBe(1);
  });

  it("handles zero conversations without dividing by zero", () => {
    const stats = computeDashboardStats([], [], []);

    expect(stats.totalConversations).toBe(0);
    expect(stats.conversationsWithoutEscalation).toBe(0);
  });
});
