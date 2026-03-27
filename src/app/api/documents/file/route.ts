import { NextRequest, NextResponse } from "next/server";
import { canAccessDocument } from "@/lib/access-control";
import { requireSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { resolveStoredFileAccessUrl } from "@/lib/storage";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireSessionUser(request);
    if ("response" in auth) return auth.response;

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Document ID is required" },
        { status: 400 }
      );
    }

    if (!(await canAccessDocument(auth.user, id))) {
      return NextResponse.json(
        { success: false, error: "Document not found or access denied" },
        { status: 404 }
      );
    }

    const document = await db.document.findUnique({
      where: { id },
      select: {
        id: true,
        path: true,
      },
    });

    if (!document) {
      return NextResponse.json(
        { success: false, error: "Document not found" },
        { status: 404 }
      );
    }

    const accessUrl = await resolveStoredFileAccessUrl(document.path);
    return NextResponse.redirect(
      accessUrl.startsWith("http://") || accessUrl.startsWith("https://")
        ? accessUrl
        : new URL(accessUrl, request.url)
    );
  } catch (error) {
    console.error("Get document file error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}
