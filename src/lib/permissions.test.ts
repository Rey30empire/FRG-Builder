import { describe, expect, it } from "vitest";
import { getCapabilitiesForLevel, hasPermissionCapability } from "@/lib/permissions";

describe("permissions", () => {
  it("maps capabilities by permission level", () => {
    expect(getCapabilitiesForLevel(0)).toEqual(["read"]);
    expect(getCapabilitiesForLevel(3)).toEqual(["read", "write", "export", "connected"]);
    expect(getCapabilitiesForLevel(4)).toEqual([
      "read",
      "write",
      "export",
      "connected",
      "admin",
    ]);
  });

  it("allows or denies capabilities according to the level", () => {
    expect(hasPermissionCapability({ level: 2, role: "user" }, "export")).toBe(true);
    expect(hasPermissionCapability({ level: 2, role: "user" }, "connected")).toBe(false);
  });

  it("grants full access to admin users", () => {
    expect(hasPermissionCapability({ level: 1, role: "admin" }, "admin")).toBe(true);
    expect(hasPermissionCapability({ level: 1, role: "admin" }, "connected")).toBe(true);
  });
});
