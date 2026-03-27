import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { mkdir, unlink, writeFile } from "fs/promises";
import path from "path";
import { serializeDocument } from "@/lib/api-serializers";
import { db } from "@/lib/db";
import { stringifyJson } from "@/lib/json";

export const runtime = "nodejs";

function sanitizeFileName(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9.-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");

    if (!projectId) {
      return NextResponse.json(
        { success: false, error: "Project ID is required" },
        { status: 400 }
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

    const uploadDirectory = path.join(process.cwd(), "public", "uploads", "documents");
    await mkdir(uploadDirectory, { recursive: true });

    const extension = path.extname(file.name);
    const originalBaseName = path.basename(file.name, extension);
    const safeName = sanitizeFileName(originalBaseName || "document");
    const fileName = `${Date.now()}-${randomUUID().slice(0, 8)}-${safeName}${extension.toLowerCase()}`;
    const absolutePath = path.join(uploadDirectory, fileName);
    const publicPath = `/uploads/documents/${fileName}`;

    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(absolutePath, buffer);

    const document = await db.document.create({
      data: {
        projectId,
        name: file.name,
        originalName: file.name,
        type: file.type,
        path: publicPath,
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
    const body = await request.json();
    const { id, analyzed, analysisResult, trade, category, pageNumber } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Document ID is required" },
        { status: 400 }
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
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Document ID is required" },
        { status: 400 }
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

    if (document.path.startsWith("/uploads/documents/")) {
      const diskPath = path.join(process.cwd(), "public", document.path.replace(/^\/+/, ""));
      await unlink(diskPath).catch(() => undefined);
    }

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
