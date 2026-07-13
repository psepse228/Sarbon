import { describe, expect, it } from "vitest";

import { computeDashboardStats, parseLocalDate, selectRecentActivity, selectUpcomingAvailability } from "@/lib/stats";
import type { AvailabilityEntry, ConversationSummary, Escalation } from "@/lib/types";

function conversation(id: string, lastMessageAt: string | null = null): ConversationSummary {
  return { id, clientId: "client-1", channel: "telegram", status: "active", lastMessageAt, createdAt: "2026-07-01T00:00:00Z" };
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

describe("selectRecentActivity", () => {
  it("returns the most recent conversations first, limited to the given count", () => {
    const conversations = [
      conversation("c1", "2026-07-10T10:00:00Z"),
      conversation("c2", "2026-07-12T09:00:00Z"),
      conversation("c3", "2026-07-11T08:00:00Z"),
    ];

    const result = selectRecentActivity(conversations, [], 2);

    expect(result.map((r) => r.conversationId)).toEqual(["c2", "c3"]);
  });

  it("marks a conversation escalated only while its escalation is unnotified", () => {
    const conversations = [conversation("c1", "2026-07-12T09:00:00Z"), conversation("c2", "2026-07-12T08:00:00Z")];
    const escalations = [escalation("c1", false), escalation("c2", true)];

    const result = selectRecentActivity(conversations, escalations, 5);

    expect(result.find((r) => r.conversationId === "c1")?.status).toBe("escalated");
    expect(result.find((r) => r.conversationId === "c2")?.status).toBe("resolved");
  });

  it("sorts conversations with no lastMessageAt after ones that have it", () => {
    const conversations = [conversation("c1", null), conversation("c2", "2026-07-12T09:00:00Z")];

    const result = selectRecentActivity(conversations, [], 5);

    expect(result.map((r) => r.conversationId)).toEqual(["c2", "c1"]);
  });
});

describe("selectUpcomingAvailability", () => {
  it("drops past dates and returns the soonest ones first, limited to the given count", () => {
    const entries = [
      availability("2020-01-01", true),
      availability("2099-01-03", true),
      availability("2099-01-01", false),
      availability("2099-01-02", true),
    ];

    const result = selectUpcomingAvailability(entries, 2);

    expect(result.map((e) => e.date)).toEqual(["2099-01-01", "2099-01-02"]);
  });
});

describe("parseLocalDate", () => {
  it("does not shift to an adjacent day regardless of local timezone", () => {
    const date = parseLocalDate("2026-07-15");

    expect(date.getFullYear()).toBe(2026);
    expect(date.getMonth()).toBe(6);
    expect(date.getDate()).toBe(15);
  });
});
