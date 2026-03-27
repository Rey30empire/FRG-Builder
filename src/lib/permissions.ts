import { db } from "@/lib/db";
import { isAdminUser, type SessionUser } from "@/lib/auth";
import type { PermissionLevel, SkillName, ToolName } from "@/types";

export type PermissionCapability = "read" | "write" | "export" | "connected" | "admin";

const CAPABILITY_LEVEL: Record<PermissionCapability, PermissionLevel> = {
  read: 0,
  write: 1,
  export: 2,
  connected: 3,
  admin: 4,
};

export function hasPermissionCapability(
  user: { role?: string | null; level?: number | null },
  capability: PermissionCapability
) {
  return isAdminUser(user) || (user.level ?? 0) >= CAPABILITY_LEVEL[capability];
}

export function getCapabilitiesForLevel(level: PermissionLevel) {
  return (Object.keys(CAPABILITY_LEVEL) as PermissionCapability[]).filter(
    (capability) => level >= CAPABILITY_LEVEL[capability]
  );
}

export async function getToolAccess(user: SessionUser, toolName: ToolName) {
  const tool = await db.tool.findUnique({
    where: { name: toolName },
  });

  if (!tool) {
    return {
      allowed: true,
      reason: null,
      tool: null,
    };
  }

  if (!tool.enabled) {
    return {
      allowed: false,
      reason: `${tool.displayName} is disabled in Admin.`,
      tool,
    };
  }

  if (!isAdminUser(user) && (user.level ?? 0) < tool.requiredLevel) {
    return {
      allowed: false,
      reason: `${tool.displayName} requires permission level ${tool.requiredLevel}.`,
      tool,
    };
  }

  return {
    allowed: true,
    reason: null,
    tool,
  };
}

export async function resolveEnabledSkill(skillName: SkillName) {
  const skill = await db.skill.findUnique({
    where: { name: skillName },
  });

  if (skill && !skill.enabled) {
    return "local_model_skill" as SkillName;
  }

  return skillName;
}
