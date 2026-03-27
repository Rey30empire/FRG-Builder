import { describe, expect, it } from "vitest";
import { buildBidFormData, buildBidSubmitPackage, normalizeBidFormDataInput } from "@/lib/bid-package";

describe("bid package helpers", () => {
  it("autofills a usable bid form from opportunity and estimate context", () => {
    const bidFormData = buildBidFormData({
      opportunity: {
        id: "opp_1",
        userId: "user_1",
        name: "Saucy_Frisco",
        scopePackage: "Toilet partitions & bathroom accessories",
        address: "705 University Dr, Frisco, TX 75034",
        bidFormRequired: true,
        bidFormInstructions: "Use one line item and attach the formal proposal.",
        status: "accepted",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      project: {
        id: "proj_1",
        name: "Saucy_Frisco",
        address: "705 University Dr, Frisco, TX 75034",
        client: "20 Twenty Construction",
        clientEmail: "estimating@20twenty.com",
        projectMemory: {
          exclusions: JSON.stringify(["Permit fees"]),
        },
      },
      estimate: {
        id: "est_1",
        version: 2,
        total: 18500,
        duration: 12,
        takeoffItems: [
          {
            trade: "Specialties",
            description: "Toilet partitions package",
            totalCost: 18500,
          },
        ],
      },
      user: {
        email: "builder@frg.local",
        name: "FRG Builder",
        userMemory: {
          emailFromName: "Future Remodeling LLC",
          emailFromAddress: "estimating@future-remodeling.test",
        },
      },
      company: {
        name: "Future Remodeling LLC",
      },
    });

    expect(bidFormData.bidderCompany).toBe("Future Remodeling LLC");
    expect(bidFormData.lineItems).toHaveLength(1);
    expect(bidFormData.lineItems[0].amount).toBe(18500);
    expect(bidFormData.ready).toBe(true);
  });

  it("builds a review package until all bid submission requirements are covered", () => {
    const draft = normalizeBidFormDataInput(
      {
        bidderCompany: "Future Remodeling LLC",
        projectName: "Saucy_Frisco",
        lineItems: [
          {
            id: "base-bid",
            label: "Base bid",
            amount: 0,
          },
        ],
      },
      {
        bidderCompany: "Future Remodeling LLC",
        projectName: "Saucy_Frisco",
        lineItems: [
          {
            id: "base-bid",
            label: "Base bid",
            amount: 0,
          },
        ],
        alternates: [],
        inclusions: [],
        exclusions: [],
        attachments: [],
        ready: false,
      }
    );

    const pkg = buildBidSubmitPackage({
      opportunity: {
        id: "opp_1",
        userId: "user_1",
        name: "Saucy_Frisco",
        bidFormRequired: true,
        clientEmail: "estimating@20twenty.com",
        status: "accepted",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      project: {
        id: "proj_1",
        name: "Saucy_Frisco",
        clientEmail: "estimating@20twenty.com",
        documents: [],
      },
      estimate: {
        id: "est_1",
        version: 2,
        total: 18500,
        takeoffItems: [],
      },
      bidFormData: draft,
      proposalData: {
        title: "Saucy_Frisco Proposal",
        intro: "Intro",
        scopeSummary: "Scope summary",
        inclusions: [],
        exclusions: [],
        schedule: "10 calendar days",
        terms: [],
        template: "commercial",
        highlights: [],
      },
    });

    expect(pkg.readyForSubmit).toBe(false);
    expect(pkg.status).toBe("review");
    expect(pkg.checklist.some((item) => item.key === "bid-form" && !item.done)).toBe(true);
  });
});
