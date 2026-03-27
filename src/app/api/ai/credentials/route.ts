import { NextRequest, NextResponse } from "next/server";
import { loadAiSettingsResponse } from "@/lib/ai-settings";
import { deleteUserAiCredential, saveUserAiCredential } from "@/lib/ai-credentials";
import { requireSessionUser } from "@/lib/auth";
import type { AiProviderName } from "@/types";

const VALID_PROVIDERS = new Set<AiProviderName>(["openai", "anthropic", "gemini"]);

function isProvider(value: unknown): value is AiProviderName {
  return typeof value === "string" && VALID_PROVIDERS.has(value as AiProviderName);
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireSessionUser(request);
    if ("response" in auth) return auth.response;

    const body = (await request.json()) as {
      provider?: string;
      apiKey?: string;
    };

    if (!isProvider(body.provider)) {
      return NextResponse.json(
        { success: false, error: "A valid AI provider is required." },
        { status: 400 }
      );
    }

    if (typeof body.apiKey !== "string" || !body.apiKey.trim()) {
      return NextResponse.json(
        { success: false, error: "API key is required." },
        { status: 400 }
      );
    }

    await saveUserAiCredential({
      userId: auth.user.id,
      provider: body.provider,
      apiKey: body.apiKey,
    });

    return NextResponse.json({
      success: true,
      data: await loadAiSettingsResponse(auth.user.id),
    });
  } catch (error) {
    console.error("Save AI credential error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireSessionUser(request);
    if ("response" in auth) return auth.response;

    const body = (await request.json().catch(() => null)) as {
      provider?: string;
    } | null;

    if (!isProvider(body?.provider)) {
      return NextResponse.json(
        { success: false, error: "A valid AI provider is required." },
        { status: 400 }
      );
    }

    await deleteUserAiCredential(auth.user.id, body.provider);

    return NextResponse.json({
      success: true,
      data: await loadAiSettingsResponse(auth.user.id),
    });
  } catch (error) {
    console.error("Delete AI credential error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}
