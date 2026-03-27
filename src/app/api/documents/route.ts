import { NextRequest, NextResponse } from "next/server";
import { serializeDocument } from "@/lib/api-serializers";
import { canAccessDocument, canAccessProject } from "@/lib/access-control";
import { requireSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { stringifyJson } from "@/lib/json";
import { deleteStoredFile, storeDocumentUpload } from "@/lib/storage";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireSessionUser(request);
    if ("response" in auth) return auth.response;

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");

    if (!projectId) {
      return NextResponse.json(
        { success: false, error: "Project ID is required" },
        { status: 400 }
      );
    }

    if (!(await canAccessProject(auth.user, projectId))) {
      return NextResponse.json(
        { success: false, error: "Project not found or access denied" },
        { status: 404 }
      );
    }

    const documents = await db.document.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      success: true,
      data: documents.map((document) => serializeDocument(document)),
    });
  } catch (error) {
    console.error("Get documents error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireSessionUser(request);
    if ("response" in auth) return auth.response;

    const formData = await request.formData();
    const file = formData.get("file") as File;
    const projectId = formData.get("projectId") as string;
    const trade = formData.get("trade") as string;
    const category = formData.get("category") as string;

    if (!file || !projectId) {
      return NextResponse.json(
        { success: false, error: "File and project ID are required" },
        { status: 400 }
      );
    }

    if (!(await canAccessProject(auth.user, projectId))) {
      return NextResponse.json(
        { success: false, error: "Project not found or access denied" },
        { status: 404 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const storedFile = await storeDocumentUpload({
      originalName: file.name,
      buffer,
      contentType: file.type,
    });

    const document = await db.document.create({
      data: {
        projectId,
        name: file.name,
        originalName: file.name,
        type: file.type,
        path: storedFile.path,
        size: file.size,
        trade,
        category,
        analyzed: false,
      },
    });

    return NextResponse.json({
      success: true,
      data: serializeDocument(document),
    });
  } catch (error) {
    console.error("Upload document error:", error);
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
    const {
      id,
      analyzed,
      analysisResult,
      trade,
      category,
      pageNumber,
      relevanceScore,
      selectedForTakeoff,
      selectedForProposalContext,
      requiresHumanReview,
      selectionReason,
    } = body;

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

    const document = await db.document.update({
      where: { id },
      data: {
        analyzed,
        analysisResult:
          analysisResult === undefined
            ? undefined
            : typeof analysisResult === "string"
              ? analysisResult
              : stringifyJson(analysisResult),
        trade,
        category,
        pageNumber,
        relevanceScore,
        selectedForTakeoff,
        selectedForProposalContext,
        requiresHumanReview,
        selectionReason,
      },
    });

    return NextResponse.json({
      success: true,
      data: serializeDocument(document),
    });
  } catch (error) {
    console.error("Update document error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
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
    });

    if (!document) {
      return NextResponse.json(
        { success: false, error: "Document not found" },
        { status: 404 }
      );
    }

    await db.document.delete({ where: { id } });
    await deleteStoredFile(document.path).catch(() => undefined);

    return NextResponse.json({
      success: true,
      message: "Document deleted successfully",
    });
  } catch (error) {
    console.error("Delete document error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
