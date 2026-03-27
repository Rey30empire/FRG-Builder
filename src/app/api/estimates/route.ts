import { NextRequest, NextResponse } from "next/server";
import { serializeEstimate } from "@/lib/api-serializers";
import { canAccessEstimate, canAccessProject } from "@/lib/access-control";
import { requireSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireSessionUser(request);
    if ("response" in auth) return auth.response;

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");
    const estimateId = searchParams.get("estimateId");

    if (estimateId) {
      if (!(await canAccessEstimate(auth.user, estimateId))) {
        return NextResponse.json(
          { success: false, error: "Estimate not found or access denied" },
          { status: 404 }
        );
      }

      const estimate = await db.estimate.findUnique({
        where: { id: estimateId },
        include: {
          takeoffItems: true,
          emails: true,
          proposalDelivery: true,
        },
      });
      return NextResponse.json({
        success: true,
        data: estimate ? serializeEstimate(estimate) : null,
      });
    }

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

    const estimates = await db.estimate.findMany({
      where: { projectId },
      include: {
        takeoffItems: true,
        emails: true,
        proposalDelivery: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      success: true,
      data: estimates.map((estimate) => serializeEstimate(estimate)),
    });
  } catch (error) {
    console.error("Get estimates error:", error);
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

    const body = await request.json();
    const {
      projectId,
      name,
      materialsCost,
      laborCost,
      equipmentCost,
      duration,
      weatherFactor,
      marketFactor,
      riskFactor,
      regionalContext,
      takeoffItems,
    } = body;

    if (!projectId || !name) {
      return NextResponse.json(
        { success: false, error: "Project ID and name are required" },
        { status: 400 }
      );
    }

    if (!(await canAccessProject(auth.user, projectId))) {
      return NextResponse.json(
        { success: false, error: "Project not found or access denied" },
        { status: 404 }
      );
    }

    // Calculate totals
    const subtotal = (materialsCost || 0) + (laborCost || 0) + (equipmentCost || 0);
    const overhead = subtotal * 0.1; // 10% overhead
    const profit = subtotal * 0.15; // 15% profit
    const total = subtotal + overhead + profit;

    // Get latest version
    const latestEstimate = await db.estimate.findFirst({
      where: { projectId },
      orderBy: { version: "desc" },
    });
    const version = (latestEstimate?.version || 0) + 1;

    const estimate = await db.estimate.create({
      data: {
        projectId,
        name,
        version,
        materialsCost,
        laborCost,
        equipmentCost,
        subtotal,
        overhead,
        profit,
        total,
        duration,
        weatherFactor,
        marketFactor,
        riskFactor,
        regionalContext:
          regionalContext === undefined
            ? undefined
            : typeof regionalContext === "string"
              ? regionalContext
              : JSON.stringify(regionalContext),
        takeoffItems: takeoffItems
          ? {
              create: takeoffItems.map(
                (item: {
                  trade: string;
                  description: string;
                  quantity: number;
                  unit: string;
                  materialCost?: number;
                  laborCost?: number;
                  totalCost?: number;
                }) => ({
                  trade: item.trade,
                  description: item.description,
                  quantity: item.quantity,
                  unit: item.unit,
                  materialCost: item.materialCost,
                  laborCost: item.laborCost,
                  totalCost: item.totalCost,
                })
              ),
            }
          : undefined,
      },
      include: {
        takeoffItems: true,
        emails: true,
        proposalDelivery: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: serializeEstimate(estimate),
    });
  } catch (error) {
    console.error("Create estimate error:", error);
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
    const { id, projectId: _projectId, ...updates } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Estimate ID is required" },
        { status: 400 }
      );
    }

    if (!(await canAccessEstimate(auth.user, id))) {
      return NextResponse.json(
        { success: false, error: "Estimate not found or access denied" },
        { status: 404 }
      );
    }

    // Recalculate totals if costs changed
    if (updates.materialsCost || updates.laborCost || updates.equipmentCost) {
      const existing = await db.estimate.findUnique({ where: { id } });
      if (existing) {
        const materialsCost = updates.materialsCost ?? existing.materialsCost ?? 0;
        const laborCost = updates.laborCost ?? existing.laborCost ?? 0;
        const equipmentCost = updates.equipmentCost ?? existing.equipmentCost ?? 0;
        const subtotal = materialsCost + laborCost + equipmentCost;
        updates.subtotal = subtotal;
        updates.overhead = subtotal * 0.1;
        updates.profit = subtotal * 0.15;
        updates.total = subtotal + updates.overhead + updates.profit;
      }
    }

    if (updates.regionalContext !== undefined && typeof updates.regionalContext !== "string") {
      updates.regionalContext = JSON.stringify(updates.regionalContext);
    }

    const estimate = await db.estimate.update({
      where: { id },
      data: updates,
      include: {
        takeoffItems: true,
        emails: true,
        proposalDelivery: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: serializeEstimate(estimate),
    });
  } catch (error) {
    console.error("Update estimate error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
