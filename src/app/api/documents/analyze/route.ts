import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { analyzeStoredDocument, buildDocumentAnalysisContext } from "@/lib/document-analysis";
import { serializeDocument } from "@/lib/api-serializers";
import { canAccessDocument, canAccessProject } from "@/lib/access-control";
import { requireSessionUser } from "@/lib/auth";
import { assertBillingLimit, BillingLimitError, recordBillingUsage } from "@/lib/billing";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const auth = await requireSessionUser(request);
    if ("response" in auth) return auth.response;

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

    if (projectId && !(await canAccessProject(auth.user, projectId))) {
      return NextResponse.json(
        { success: false, error: "Project not found or access denied" },
        { status: 404 }
      );
    }

    if (documentIds.length > 0) {
      for (const documentId of documentIds) {
        const hasAccess = await canAccessDocument(auth.user, documentId);
        if (!hasAccess) {
          return NextResponse.json(
            { success: false, error: "One or more documents were not found or access was denied" },
            { status: 404 }
          );
        }
      }
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

    await assertBillingLimit({
      userId: auth.user.id,
      metricKey: "document_analyses",
      quantity: documents.length,
    });

    const updatedDocuments: Array<Record<string, unknown>> = [];
    const projectIds = [...new Set(documents.map((document) => document.projectId))];
    const projects = await db.project.findMany({
      where: { id: { in: projectIds } },
      include: {
        bidOpportunity: true,
        projectMemory: true,
      },
    });
    const analysisContextByProjectId = new Map(
      projects.map((project) => [project.id, buildDocumentAnalysisContext(project)])
    );

    for (const document of documents) {
      const analyzed = await analyzeStoredDocument(
        document,
        analysisContextByProjectId.get(document.projectId)
      );

      const updated = await db.document.update({
        where: { id: document.id },
        data: {
          analyzed: analyzed.analyzed,
          trade: analyzed.trade,
          category: analyzed.category,
          pageNumber: analyzed.pageNumber,
          relevanceScore: analyzed.relevanceScore,
          selectedForTakeoff: analyzed.selectedForTakeoff,
          selectedForProposalContext: analyzed.selectedForProposalContext,
          requiresHumanReview: analyzed.requiresHumanReview,
          selectionReason: analyzed.selectionReason,
          analysisResult: JSON.stringify(analyzed.analysisResult),
        },
      });

      updatedDocuments.push(serializeDocument(updated) as Record<string, unknown>);
    }

    await recordBillingUsage({
      userId: auth.user.id,
      metricKey: "document_analyses",
      quantity: documents.length,
      source: "documents.analyze",
      referenceId: projectId || documents[0]?.id || null,
      referenceType: projectId ? "project" : "document-batch",
      metadata: {
        projectId,
        documentIds,
      },
    });

    return NextResponse.json({
      success: true,
      data: updatedDocuments,
    });
  } catch (error) {
    console.error("Analyze documents error:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof BillingLimitError
            ? error.message
            : error instanceof Error
              ? error.message
              : "Internal server error",
      },
      { status: error instanceof BillingLimitError ? error.status : 500 }
    );
  }
}
