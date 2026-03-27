import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("ops maintenance route", () => {
  const originalSecret = process.env.OPS_CRON_SECRET;

  beforeEach(() => {
    vi.resetModules();
    process.env.OPS_CRON_SECRET = "top-secret";
  });

  afterEach(() => {
    process.env.OPS_CRON_SECRET = originalSecret;
  });

  it("allows cron-triggered maintenance with a valid secret", async () => {
    const runMaintenanceTask = vi.fn().mockResolvedValue({
      id: "run-1",
      action: "health-scan",
      trigger: "cron",
      status: "completed",
    });

    vi.doMock("@/lib/auth", () => ({
      requireAdminSessionUser: vi.fn(),
    }));
    vi.doMock("@/lib/rate-limit", () => ({
      enforceRateLimit: vi.fn().mockReturnValue(null),
    }));
    vi.doMock("@/lib/operations", () => ({
      runMaintenanceTask,
    }));

    const { POST } = await import("@/app/api/ops/maintenance/route");
    const response = await POST(
      new NextRequest("http://localhost/api/ops/maintenance", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-cron-secret": "top-secret",
        },
        body: JSON.stringify({
          action: "health-scan",
        }),
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(runMaintenanceTask).toHaveBeenCalledWith({
      action: "health-scan",
      trigger: "cron",
      actorId: null,
    });
  });
});
