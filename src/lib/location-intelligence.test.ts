import { describe, expect, it } from "vitest";
import { resolveRegionalContext } from "@/lib/location-intelligence";

describe("location intelligence", () => {
  it("detects Dallas-Fort Worth pricing context from north Texas addresses", () => {
    const context = resolveRegionalContext({
      address: "705 University Dr, Frisco, TX 75034",
      dueDate: "2026-07-15",
      trades: ["Concrete", "Painting"],
      companyWorkZones: ["Frisco", "Plano", "Dallas-Fort Worth"],
    });

    expect(context.pricingRegion).toBe("Dallas-Fort Worth");
    expect(context.state).toBe("TX");
    expect(context.marketFactor).toBeGreaterThan(1);
    expect(context.weatherFactor).toBeGreaterThan(1);
    expect(context.coordinateSource).not.toBe("none");
  });

  it("keeps California metro work in a premium coastal pricing lane", () => {
    const context = resolveRegionalContext({
      address: "123 Main St, Los Angeles, CA 90012",
      dueDate: "2026-04-12",
      trades: ["Electrical", "Drywall"],
      companyWorkZones: ["Los Angeles", "Orange County"],
    });

    expect(context.pricingRegion).toBe("Los Angeles Metro");
    expect(context.marketTier).toBe("premium");
    expect(context.laborIndex).toBeGreaterThan(1.1);
    expect(context.logisticsFactor).toBeGreaterThanOrEqual(1);
    expect(context.logisticsFactor).toBeLessThanOrEqual(1.02);
  });
});
