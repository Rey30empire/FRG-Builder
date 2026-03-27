import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { NextRequest, NextResponse } from "next/server";
import { requireAdminSessionUser } from "@/lib/auth";
import { enforceRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

const execFileAsync = promisify(execFile);

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdminSessionUser(request);
    if ("response" in auth) return auth.response;

    const limited = enforceRateLimit(
      request,
      "admin-operation",
      {
        windowMs: 1000 * 60 * 10,
        max: 6,
      },
      auth.user.id
    );
    if (limited) return limited;

    const body = await request.json();
    const action = typeof body.action === "string" ? body.action : "";

    if (action !== "backup-local") {
      return NextResponse.json(
        { success: false, error: "Unsupported admin operation" },
        { status: 400 }
      );
    }

    const result = await execFileAsync(process.execPath, ["scripts/backup-local-data.mjs"], {
      cwd: process.cwd(),
    });

    return NextResponse.json({
      success: true,
      data: {
        action,
        output: result.stdout.trim(),
      },
    });
  } catch (error) {
    console.error("Admin operation error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}
