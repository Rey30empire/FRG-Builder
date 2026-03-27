import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

describe("support routes", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("creates a support ticket for the authenticated user", async () => {
    const create = vi.fn().mockResolvedValue({
      id: "ticket-1",
      userId: "user-1",
      title: "Need help",
      description: "Proposal workflow issue",
      status: "open",
      priority: "high",
      channel: "internal",
      tags: "[]",
      lastResponseAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    vi.doMock("@/lib/auth", () => ({
      requireSessionUser: vi.fn().mockResolvedValue({
        user: { id: "user-1", role: "user", level: 1 },
      }),
      isAdminUser: vi.fn().mockReturnValue(false),
    }));
    vi.doMock("@/lib/rate-limit", () => ({
      enforceRateLimit: vi.fn().mockReturnValue(null),
    }));
    vi.doMock("@/lib/activity-log", () => ({
      logActivity: vi.fn().mockResolvedValue(undefined),
    }));
    vi.doMock("@/lib/db", () => ({
      db: {
        supportTicket: {
          create,
          findMany: vi.fn(),
          update: vi.fn(),
        },
      },
    }));

    const { POST } = await import("@/app/api/support/route");
    const response = await POST(
      new NextRequest("http://localhost/api/support", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: "Need help",
          description: "Proposal workflow issue",
          priority: "high",
        }),
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(payload.success).toBe(true);
    expect(create).toHaveBeenCalled();
  });
});
