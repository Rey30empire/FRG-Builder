import { NextRequest, NextResponse } from "next/server";
import { serializeProject } from "@/lib/api-serializers";
import { db } from "@/lib/db";
import { DEFAULT_USER_ID, ensureDefaultUser } from "@/lib/default-user";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId") || DEFAULT_USER_ID;
    const status = searchParams.get("status");

    const where: Record<string, unknown> = { userId };
    if (status) {
      where.status = status;
    }

    const projects = await db.project.findMany({
      where,
      include: {
        documents: true,
        estimates: {
          include: {
            takeoffItems: true,
          },
        },
        emails: true,
        projectMemory: true,
      },
      orderBy: { updatedAt: "desc" },
    });

    return NextResponse.json({
      success: true,
      data: projects.map((project) => serializeProject(project)),
    });
  } catch (error) {
    console.error("Get projects error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, address, client, clientEmail, clientPhone, deadline, userId } = body;

    if (!name) {
      return NextResponse.json(
        { success: false, error: "Project name is required" },
        { status: 400 }
      );
    }

    if (!userId) {
      await ensureDefaultUser();
    }

    const project = await db.project.create({
      data: {
        userId: userId || DEFAULT_USER_ID,
        name,
        address,
        client,
        clientEmail,
        clientPhone,
        deadline: deadline ? new Date(deadline) : undefined,
        projectMemory: {
          create: {},
        },
      },
      include: {
        projectMemory: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: serializeProject(project),
    });
  } catch (error) {
    console.error("Create project error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Project ID is required" },
        { status: 400 }
      );
    }

    const project = await db.project.update({
      where: { id },
      data: {
        ...updates,
        clientEmail: updates.clientEmail,
        clientPhone: updates.clientPhone,
        deadline: updates.deadline ? new Date(updates.deadline) : undefined,
      },
    });

    return NextResponse.json({
      success: true,
      data: serializeProject(project),
    });
  } catch (error) {
    console.error("Update project error:", error);
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
        { success: false, error: "Project ID is required" },
        { status: 400 }
      );
    }

    await db.project.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: "Project deleted successfully",
    });
  } catch (error) {
    console.error("Delete project error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
