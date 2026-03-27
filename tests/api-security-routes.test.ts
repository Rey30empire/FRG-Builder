import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

describe("api security guards", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("blocks proposal send when the user lacks connected permissions", async () => {
    vi.doMock("@/lib/auth", () => ({
      requireSessionUser: vi.fn().mockResolvedValue({
        user: { id: "user-1", role: "user", level: 2 },
      }),
    }));
    vi.doMock("@/lib/permissions", () => ({
      hasPermissionCapability: vi.fn().mockReturnValue(false),
    }));

    const { POST } = await import("@/app/api/proposals/send/route");
    const response = await POST(
      new NextRequest("http://localhost/api/proposals/send", { method: "POST" })
    );
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload.success).toBe(false);
  });

  it("blocks outreach email sends when the user lacks connected permissions", async () => {
    vi.doMock("@/lib/auth", () => ({
      requireSessionUser: vi.fn().mockResolvedValue({
        user: { id: "user-2", role: "user", level: 2 },
      }),
    }));
    vi.doMock("@/lib/permissions", () => ({
      hasPermissionCapability: vi.fn().mockReturnValue(false),
    }));

    const { POST } = await import("@/app/api/emails/send/route");
    const response = await POST(
      new NextRequest("http://localhost/api/emails/send", { method: "POST" })
    );
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload.success).toBe(false);
  });

  it("does not create a conversation when a safe action is blocked by tool policy", async () => {
    const createConversation = vi.fn();

    vi.doMock("@/lib/auth", () => ({
      requireSessionUser: vi.fn().mockResolvedValue({
        user: { id: "user-3", role: "user", level: 0 },
      }),
    }));
    vi.doMock("@/lib/access-control", () => ({
      canAccessConversation: vi.fn().mockResolvedValue(true),
      canAccessProject: vi.fn().mockResolvedValue(true),
      resolveScopedUserId: vi.fn(),
    }));
    vi.doMock("@/lib/permissions", () => ({
      getToolAccess: vi.fn().mockResolvedValue({
        allowed: false,
        reason: "Blocked by policy",
        tool: null,
      }),
      resolveEnabledSkill: vi.fn(async (value: string) => value),
    }));
    vi.doMock("@/lib/db", () => ({
      db: {
        conversation: {
          findUnique: vi.fn(),
          findMany: vi.fn(),
          create: createConversation,
          update: vi.fn(),
        },
        message: {
          findMany: vi.fn(),
          create: vi.fn(),
        },
      },
    }));

    const { POST } = await import("@/app/api/chat/route");
    const response = await POST(
      new NextRequest("http://localhost/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "create_estimate_draft",
          projectId: "project-1",
        }),
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload.success).toBe(false);
    expect(createConversation).not.toHaveBeenCalled();
  });
});
