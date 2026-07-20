import { describe, expect, it } from "vitest";

import {
  computeDashboardStats,
  parseLocalDate,
  selectDailyTrend,
  selectRecentActivity,
  selectUpcomingAvailability,
} from "@/lib/stats";
import type { AvailabilityEntry, ConversationSummary, Escalation, Lead, Review } from "@/lib/types";

function conversation(id: string, lastMessageAt: string | null = null): ConversationSummary {
  return { id, clientId: "client-1", channel: "telegram", status: "active", lastMessageAt, createdAt: "2026-07-01T00:00:00Z" };
}

function escalation(conversationId: string, notifiedOwner: boolean): Escalation {
  return { id: `esc-${conversationId}`, conversationId, reason: "test", notifiedOwner, createdAt: "2026-07-01T00:00:00Z", clientId: "client-1", channel: "telegram" };
}

function availability(date: string, isAvailable: boolean): AvailabilityEntry {
  return { id: `av-${date}`, date, isAvailable, eventDetails: "" };
}

function lead(id: string, status: Lead["status"]): Lead {
  return {
    id,
    conversationId: `conv-${id}`,
    name: "Тест",
    phone: null,
    preferredDate: null,
    guestCount: null,
    budget: null,
    status,
    notes: null,
    createdAt: "2026-07-01T00:00:00Z",
  };
}

function review(id: string, rating: number): Review {
  return { id, conversationId: `conv-${id}`, rating, comment: null, createdAt: "2026-07-01T00:00:00Z" };
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

  it("counts leads captured and booked separately", () => {
    const leads = [lead("l1", "new"), lead("l2", "booked"), lead("l3", "booked"), lead("l4", "lost")];

    const stats = computeDashboardStats([], [], [], leads, []);

    expect(stats.leadsCaptured).toBe(4);
    expect(stats.leadsBooked).toBe(2);
  });

  it("computes the average rating rounded to one decimal", () => {
    const reviews = [review("r1", 5), review("r2", 4), review("r3", 5)];

    const stats = computeDashboardStats([], [], [], [], reviews);

    expect(stats.reviewsCaptured).toBe(3);
    expect(stats.averageRating).toBe(4.7);
  });

  it("reports a null average rating when there are no reviews yet", () => {
    const stats = computeDashboardStats([], [], [], [], []);

    expect(stats.reviewsCaptured).toBe(0);
    expect(stats.averageRating).toBeNull();
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

describe("selectDailyTrend", () => {
  it("buckets timestamps into the last N days, oldest first, filling gaps with zero", () => {
    const items = [
      { createdAt: "2026-07-12T09:00:00Z" },
      { createdAt: "2026-07-12T14:00:00Z" },
      { createdAt: "2026-07-14T10:00:00Z" },
    ];

    const result = selectDailyTrend(items, 3, (item) => item.createdAt, () => new Date("2026-07-14T12:00:00Z"));

    // Window is [07-12 (oldest), 07-13, 07-14 (today)]: two items land on
    // 07-12, none on 07-13 (the gap), one on 07-14 (today).
    expect(result).toEqual([2, 0, 1]);
  });

  it("returns an all-zero array when there are no items", () => {
    const result = selectDailyTrend([], 4, () => "", () => new Date("2026-07-14T12:00:00Z"));

    expect(result).toEqual([0, 0, 0, 0]);
  });
});
