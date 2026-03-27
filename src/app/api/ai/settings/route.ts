import { NextRequest, NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/auth";
import { loadAiSettings, loadAiSettingsResponse, saveAiSettings } from "@/lib/ai-settings";
import type { AiProviderSettings } from "@/types";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireSessionUser(request);
    if ("response" in auth) return auth.response;

    return NextResponse.json({
      success: true,
      data: await loadAiSettingsResponse(auth.user.id),
    });
  } catch (error) {
    console.error("Get AI settings error:", error);
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

    const body = (await request.json()) as Partial<AiProviderSettings>;
    const { settings: currentSettings } = await loadAiSettings(auth.user.id);

    const nextSettings: AiProviderSettings = {
      primary: body.primary || currentSettings.primary,
      providers: {
        openai: {
          enabled:
            body.providers?.openai?.enabled ?? currentSettings.providers.openai.enabled,
          model: body.providers?.openai?.model || currentSettings.providers.openai.model,
        },
        anthropic: {
          enabled:
            body.providers?.anthropic?.enabled ?? currentSettings.providers.anthropic.enabled,
          model: body.providers?.anthropic?.model || currentSettings.providers.anthropic.model,
        },
        gemini: {
          enabled:
            body.providers?.gemini?.enabled ?? currentSettings.providers.gemini.enabled,
          model: body.providers?.gemini?.model || currentSettings.providers.gemini.model,
        },
      },
    };

    await saveAiSettings(nextSettings, auth.user.id);

    return NextResponse.json({
      success: true,
      data: await loadAiSettingsResponse(auth.user.id),
    });
  } catch (error) {
    console.error("Update AI settings error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
