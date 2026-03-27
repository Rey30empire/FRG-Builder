import { NextRequest, NextResponse } from "next/server";
import { serializeBidOpportunity, serializeProject } from "@/lib/api-serializers";
import { canAccessBidOpportunity } from "@/lib/access-control";
import { requireSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { stringifyJson } from "@/lib/json";

export async function POST(request: NextRequest) {
  try {
    const auth = await requireSessionUser(request);
    if ("response" in auth) return auth.response;

    const body = (await request.json()) as {
      opportunityId?: string;
    };

    if (!body.opportunityId) {
      return NextResponse.json(
        { success: false, error: "Opportunity ID is required." },
        { status: 400 }
      );
    }

    const access = await canAccessBidOpportunity(auth.user, body.opportunityId);
    if (!access) {
      return NextResponse.json(
        { success: false, error: "Opportunity not found or access denied" },
        { status: 404 }
      );
    }

    const opportunity = await db.bidOpportunity.findUnique({
      where: { id: body.opportunityId },
      include: {
        project: {
          include: {
            documents: true,
            estimates: {
              include: {
                takeoffItems: true,
                emails: true,
                proposalDelivery: true,
              },
            },
            emails: true,
            projectMemory: true,
          },
        },
      },
    });

    if (!opportunity) {
      return NextResponse.json(
        { success: false, error: "Opportunity not found." },
        { status: 404 }
      );
    }

    if (opportunity.project) {
      return NextResponse.json({
        success: true,
        data: {
          opportunity: serializeBidOpportunity(opportunity),
          project: serializeProject(opportunity.project),
        },
      });
    }

    const project = await db.project.create({
      data: {
        userId: auth.user.id,
        name: opportunity.name,
        address: opportunity.address,
        client: opportunity.client,
        clientEmail: opportunity.clientEmail,
        clientPhone: opportunity.clientPhone,
        deadline: opportunity.dueDate,
        status: "active",
        projectMemory: {
          create: {
            notes: [
              opportunity.description || "",
              opportunity.tradeInstructions ? `Trade instructions: ${opportunity.tradeInstructions}` : "",
              opportunity.bidFormInstructions ? `Bid form: ${opportunity.bidFormInstructions}` : "",
              opportunity.externalUrl ? `Source URL: ${opportunity.externalUrl}` : "",
            ]
              .filter(Boolean)
              .join("\n\n"),
            addendas: stringifyJson([]),
            versions: stringifyJson({
              createdFromOpportunity: opportunity.id,
              source: opportunity.source || "manual-intake",
            }),
            exclusions: stringifyJson([]),
          },
        },
      },
      include: {
        documents: true,
        estimates: {
          include: {
            takeoffItems: true,
            emails: true,
            proposalDelivery: true,
          },
        },
        emails: true,
        projectMemory: true,
      },
    });

    const updatedOpportunity = await db.bidOpportunity.update({
      where: { id: opportunity.id },
      data: {
        projectId: project.id,
        status: opportunity.status === "undecided" ? "accepted" : opportunity.status,
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
      data: {
        opportunity: serializeBidOpportunity(updatedOpportunity),
        project: serializeProject(project),
      },
    });
  } catch (error) {
    console.error("Convert opportunity error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}
