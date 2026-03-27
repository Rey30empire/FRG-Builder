import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { analyzeStoredDocument } from "@/lib/document-analysis";
import { serializeDocument } from "@/lib/api-serializers";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const projectId = typeof body.projectId === "string" ? body.projectId : null;
    const documentIds = Array.isArray(body.documentIds)
      ? body.documentIds.filter((value): value is string => typeof value === "string")
      : [];

    if (!projectId && documentIds.length === 0) {
      return NextResponse.json(
        { success: false, error: "Project ID or document IDs are required" },
        { status: 400 }
      );
    }

    const documents = await db.document.findMany({
      where: {
        ...(projectId ? { projectId } : {}),
        ...(documentIds.length > 0 ? { id: { in: documentIds } } : {}),
      },
      orderBy: { createdAt: "asc" },
    });

    if (documents.length === 0) {
      return NextResponse.json(
        { success: false, error: "No documents found to analyze" },
        { status: 404 }
      );
    }

    const updatedDocuments: Array<Record<string, unknown>> = [];

    for (const document of documents) {
      const analyzed = await analyzeStoredDocument(document);

      const updated = await db.document.update({
        where: { id: document.id },
        data: {
          analyzed: analyzed.analyzed,
          trade: analyzed.trade,
          category: analyzed.category,
          pageNumber: analyzed.pageNumber,
          analysisResult: JSON.stringify(analyzed.analysisResult),
        },
      });

      updatedDocuments.push(serializeDocument(updated) as Record<string, unknown>);
    }

    return NextResponse.json({
      success: true,
      data: updatedDocuments,
    });
  } catch (error) {
    console.error("Analyze documents error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
