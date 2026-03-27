import { NextRequest, NextResponse } from "next/server";
import { serializeUser } from "@/lib/api-serializers";
import { normalizeEmail, requireSessionUser } from "@/lib/auth";
import { canUsePipelineAutomationForAccount, ensureBillingAccount } from "@/lib/billing";
import { db } from "@/lib/db";
import { buildWorkspaceMemoryDefaults, loadUserWorkspaceSettings, normalizeAgentWorkspaceConfig, normalizeSenderSettings, serializeWorkspaceConfig } from "@/lib/user-workspace";
import type { AppUser } from "@/types";

interface WorkspaceSettingsResponse {
  user?: AppUser;
  sender: ReturnType<typeof normalizeSenderSettings>;
  agentWorkspaceConfig: ReturnType<typeof normalizeAgentWorkspaceConfig>;
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireSessionUser(request);
    if ("response" in auth) return auth.response;

    const workspace = await loadUserWorkspaceSettings(auth.user.id);

    return NextResponse.json({
      success: true,
      data: {
        user: serializeUser(workspace.user) as AppUser,
        sender: workspace.sender,
        agentWorkspaceConfig: workspace.agentWorkspaceConfig,
      } satisfies WorkspaceSettingsResponse,
    });
  } catch (error) {
    console.error("Get workspace settings error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const auth = await requireSessionUser(request);
    if ("response" in auth) return auth.response;

    const body = await request.json();
    const senderInput = body.sender || {};
    const agentWorkspaceConfig = normalizeAgentWorkspaceConfig(body.agentWorkspaceConfig);
    const billingAccount = await ensureBillingAccount(auth.user.id);

    if (
      (agentWorkspaceConfig.mode === "agentic" || agentWorkspaceConfig.autoRunOnChat) &&
      !canUsePipelineAutomationForAccount(billingAccount)
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Auto-run and full agentic workspace mode require an active Pro or Growth plan.",
        },
        { status: 403 }
      );
    }

    const sender = normalizeSenderSettings(senderInput, {
      fromName: auth.user.userMemory?.emailFromName || undefined,
      fromAddress: auth.user.userMemory?.emailFromAddress || auth.user.email,
      replyTo: auth.user.userMemory?.emailReplyTo || auth.user.email,
      smtpHost: auth.user.userMemory?.smtpHost || undefined,
      smtpPort: auth.user.userMemory?.smtpPort || undefined,
      smtpSecure: auth.user.userMemory?.smtpSecure || false,
      smtpUser: auth.user.userMemory?.smtpUser || undefined,
      hasSmtpPassword: Boolean(auth.user.userMemory?.smtpPassword),
    });
    const smtpPassword =
      typeof senderInput.smtpPassword === "string" ? senderInput.smtpPassword.trim() : undefined;
    const clearSmtpPassword = body.clearSmtpPassword === true;

    const updatedUser = await db.user.update({
      where: { id: auth.user.id },
      data: {
        email:
          typeof body.email === "string" && body.email.trim()
            ? normalizeEmail(body.email)
            : undefined,
        name:
          typeof body.name === "string"
            ? body.name.trim() || null
            : undefined,
        userMemory: {
          upsert: {
            update: {
              emailFromName: sender.fromName || null,
              emailFromAddress: sender.fromAddress || null,
              emailReplyTo: sender.replyTo || null,
              smtpHost: sender.smtpHost || null,
              smtpPort: sender.smtpPort || null,
              smtpSecure: sender.smtpSecure || false,
              smtpUser: sender.smtpUser || null,
              smtpPassword: clearSmtpPassword
                ? null
                : smtpPassword
                  ? smtpPassword
                  : undefined,
              agentWorkspaceConfig: serializeWorkspaceConfig(agentWorkspaceConfig),
            },
            create: {
              ...buildWorkspaceMemoryDefaults(auth.user),
              emailFromName: sender.fromName || null,
              emailFromAddress: sender.fromAddress || null,
              emailReplyTo: sender.replyTo || null,
              smtpHost: sender.smtpHost || null,
              smtpPort: sender.smtpPort || null,
              smtpSecure: sender.smtpSecure || false,
              smtpUser: sender.smtpUser || null,
              smtpPassword: smtpPassword || null,
              agentWorkspaceConfig: serializeWorkspaceConfig(agentWorkspaceConfig),
            },
          },
        },
      },
      include: {
        userMemory: true,
      },
    });

    const workspace = await loadUserWorkspaceSettings(updatedUser.id);

    return NextResponse.json({
      success: true,
      data: {
        user: serializeUser(updatedUser) as AppUser,
        sender: workspace.sender,
        agentWorkspaceConfig: workspace.agentWorkspaceConfig,
      },
    });
  } catch (error) {
    console.error("Update workspace settings error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}
