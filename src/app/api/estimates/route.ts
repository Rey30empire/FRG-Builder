import { NextRequest, NextResponse } from "next/server";
import { serializeEstimate } from "@/lib/api-serializers";
import { db } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");
    const estimateId = searchParams.get("estimateId");

    if (estimateId) {
      const estimate = await db.estimate.findUnique({
        where: { id: estimateId },
        include: {
          takeoffItems: true,
          emails: true,
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

    const estimates = await db.estimate.findMany({
      where: { projectId },
      include: {
        takeoffItems: true,
        emails: true,
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
    const body = await request.json();
    const {
      projectId,
      name,
      materialsCost,
      laborCost,
      equipmentCost,
      duration,
      weatherFactor,
      riskFactor,
      takeoffItems,
    } = body;

    if (!projectId || !name) {
      return NextResponse.json(
        { success: false, error: "Project ID and name are required" },
        { status: 400 }
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
        riskFactor,
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
    const body = await request.json();
    const { id, status, ...updates } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Estimate ID is required" },
        { status: 400 }
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

    const estimate = await db.estimate.update({
      where: { id },
      data: updates,
      include: {
        takeoffItems: true,
        emails: true,
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
