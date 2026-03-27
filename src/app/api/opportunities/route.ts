import { NextRequest, NextResponse } from "next/server";
import { serializeBidOpportunity } from "@/lib/api-serializers";
import { canAccessBidOpportunity, resolveScopedUserId } from "@/lib/access-control";
import { requireSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import type { BidOpportunityStatus } from "@/types";

const VALID_STATUSES = new Set<BidOpportunityStatus>([
  "undecided",
  "accepted",
  "submitted",
  "won",
  "archived",
]);

function normalizeText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function normalizeDate(value: unknown) {
  if (!value) return undefined;
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function normalizeNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return undefined;
}

function normalizeStatus(value: unknown) {
  return typeof value === "string" && VALID_STATUSES.has(value as BidOpportunityStatus)
    ? (value as BidOpportunityStatus)
    : undefined;
}

function buildOpportunityData(body: Record<string, unknown>) {
  return {
    name: normalizeText(body.name),
    client: normalizeText(body.client),
    clientEmail: normalizeText(body.clientEmail),
    clientPhone: normalizeText(body.clientPhone),
    estimatorContact: normalizeText(body.estimatorContact),
    dueDate: normalizeDate(body.dueDate),
    jobWalkDate: normalizeDate(body.jobWalkDate),
    rfiDueDate: normalizeDate(body.rfiDueDate),
    projectSize: normalizeText(body.projectSize),
    location: normalizeText(body.location),
    address: normalizeText(body.address),
    latitude: normalizeNumber(body.latitude),
    longitude: normalizeNumber(body.longitude),
    scopePackage: normalizeText(body.scopePackage),
    description: normalizeText(body.description),
    tradeInstructions: normalizeText(body.tradeInstructions),
    bidFormRequired:
      typeof body.bidFormRequired === "boolean" ? body.bidFormRequired : undefined,
    bidFormInstructions: normalizeText(body.bidFormInstructions),
    source: normalizeText(body.source),
    externalUrl: normalizeText(body.externalUrl),
    status: normalizeStatus(body.status),
    notes: normalizeText(body.notes),
  };
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireSessionUser(request);
    if ("response" in auth) return auth.response;

    const { searchParams } = new URL(request.url);
    const userId = resolveScopedUserId(auth.user, searchParams.get("userId"));
    const status = normalizeStatus(searchParams.get("status"));

    const opportunities = await db.bidOpportunity.findMany({
      where: {
        userId,
        ...(status ? { status } : {}),
      },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            status: true,
            address: true,
            client: true,
            updatedAt: true,
            _count: {
              select: {
                documents: true,
                estimates: true,
              },
            },
          },
        },
      },
      orderBy: [{ dueDate: "asc" }, { updatedAt: "desc" }],
    });

    return NextResponse.json({
      success: true,
      data: opportunities.map((opportunity) => serializeBidOpportunity(opportunity)),
    });
  } catch (error) {
    console.error("Get opportunities error:", error);
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

    const body = (await request.json()) as Record<string, unknown>;
    const payload = buildOpportunityData(body);

    if (!payload.name) {
      return NextResponse.json(
        { success: false, error: "Opportunity name is required." },
        { status: 400 }
      );
    }

    const opportunity = await db.bidOpportunity.create({
      data: {
        userId: auth.user.id,
        name: payload.name,
        client: payload.client,
        clientEmail: payload.clientEmail,
        clientPhone: payload.clientPhone,
        estimatorContact: payload.estimatorContact,
        dueDate: payload.dueDate,
        jobWalkDate: payload.jobWalkDate,
        rfiDueDate: payload.rfiDueDate,
        projectSize: payload.projectSize,
        location: payload.location,
        address: payload.address,
        latitude: payload.latitude,
        longitude: payload.longitude,
        scopePackage: payload.scopePackage,
        description: payload.description,
        tradeInstructions: payload.tradeInstructions,
        bidFormRequired: payload.bidFormRequired ?? false,
        bidFormInstructions: payload.bidFormInstructions,
        source: payload.source,
        externalUrl: payload.externalUrl,
        status: payload.status || "undecided",
        notes: payload.notes,
      },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            status: true,
            address: true,
            client: true,
            updatedAt: true,
            _count: {
              select: {
                documents: true,
                estimates: true,
              },
            },
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: serializeBidOpportunity(opportunity),
    });
  } catch (error) {
    console.error("Create opportunity error:", error);
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

    const body = (await request.json()) as Record<string, unknown>;
    const id = normalizeText(body.id);

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Opportunity ID is required." },
        { status: 400 }
      );
    }

    const access = await canAccessBidOpportunity(auth.user, id);
    if (!access) {
      return NextResponse.json(
        { success: false, error: "Opportunity not found or access denied" },
        { status: 404 }
      );
    }

    const payload = buildOpportunityData(body);
    const updateData = Object.fromEntries(
      Object.entries({
        ...(payload.name ? { name: payload.name } : {}),
        client: payload.client,
        clientEmail: payload.clientEmail,
        clientPhone: payload.clientPhone,
        estimatorContact: payload.estimatorContact,
        dueDate: payload.dueDate,
        jobWalkDate: payload.jobWalkDate,
        rfiDueDate: payload.rfiDueDate,
        projectSize: payload.projectSize,
        location: payload.location,
        address: payload.address,
        latitude: payload.latitude,
        longitude: payload.longitude,
        scopePackage: payload.scopePackage,
        description: payload.description,
        tradeInstructions: payload.tradeInstructions,
        bidFormRequired: payload.bidFormRequired,
        bidFormInstructions: payload.bidFormInstructions,
        source: payload.source,
        externalUrl: payload.externalUrl,
        status: payload.status,
        notes: payload.notes,
      }).filter(([, value]) => value !== undefined)
    );

    const opportunity = await db.bidOpportunity.update({
      where: { id },
      data: updateData,
      include: {
        project: {
          select: {
            id: true,
            name: true,
            status: true,
            address: true,
            client: true,
            updatedAt: true,
            _count: {
              select: {
                documents: true,
                estimates: true,
              },
            },
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: serializeBidOpportunity(opportunity),
    });
  } catch (error) {
    console.error("Update opportunity error:", error);
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
        { success: false, error: "Opportunity ID is required." },
        { status: 400 }
      );
    }

    const access = await canAccessBidOpportunity(auth.user, id);
    if (!access) {
      return NextResponse.json(
        { success: false, error: "Opportunity not found or access denied" },
        { status: 404 }
      );
    }

    await db.bidOpportunity.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: "Opportunity deleted successfully",
    });
  } catch (error) {
    console.error("Delete opportunity error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
