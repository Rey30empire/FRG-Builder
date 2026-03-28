import { randomBytes, scryptSync, timingSafeEqual, createHash } from "node:crypto";
import type { NextRequest, NextResponse } from "next/server";
import { db, hasDatabaseUrlConfigured } from "@/lib/db";

export const SESSION_COOKIE_NAME = "frg_session";
const SESSION_DURATION_MS = 1000 * 60 * 60 * 24 * 30;
export const DATABASE_ENV_ERROR =
  "DATABASE_URL is missing in this deployment. Add it in Netlify site environment variables.";

export class DatabaseConfigurationError extends Error {
  status: number;

  constructor(message = DATABASE_ENV_ERROR, status = 503) {
    super(message);
    this.name = "DatabaseConfigurationError";
    this.status = status;
  }
}

export function createDatabaseUnavailableResponse() {
  return Response.json(
    {
      success: false,
      error: DATABASE_ENV_ERROR,
    },
    { status: 503 }
  );
}

export type SessionUser = NonNullable<
  Awaited<ReturnType<typeof getSessionUser>>
>;

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function hashPassword(password: string, salt = randomBytes(16).toString("hex")) {
  const derived = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, passwordHash?: string | null) {
  if (!passwordHash) {
    return false;
  }

  const [salt, expectedHash] = passwordHash.split(":");

  if (!salt || !expectedHash) {
    return false;
  }

  const actualHash = scryptSync(password, salt, 64);
  const expectedBuffer = Buffer.from(expectedHash, "hex");

  if (actualHash.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(actualHash, expectedBuffer);
}

export function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(userId: string) {
  if (!hasDatabaseUrlConfigured()) {
    throw new DatabaseConfigurationError();
  }

  const token = randomBytes(32).toString("base64url");
  const tokenHash = hashSessionToken(token);
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);

  await db.session.create({
    data: {
      userId,
      tokenHash,
      expiresAt,
    },
  });

  return { token, expiresAt };
}

export async function deleteSession(token?: string | null) {
  if (!hasDatabaseUrlConfigured()) {
    return;
  }

  if (!token) {
    return;
  }

  await db.session
    .deleteMany({
      where: {
        tokenHash: hashSessionToken(token),
      },
    })
    .catch(() => undefined);
}

export async function getSessionUser(request: NextRequest) {
  if (!hasDatabaseUrlConfigured()) {
    throw new DatabaseConfigurationError();
  }

  const sessionToken = request.cookies.get(SESSION_COOKIE_NAME)?.value;

  if (!sessionToken) {
    return null;
  }

  const session = await db.session.findUnique({
    where: {
      tokenHash: hashSessionToken(sessionToken),
    },
    include: {
      user: {
        include: {
          userMemory: true,
        },
      },
    },
  });

  if (!session) {
    return null;
  }

  if (session.expiresAt.getTime() <= Date.now()) {
    await deleteSession(sessionToken);
    return null;
  }

  return session.user;
}

export async function requireSessionUser(request: NextRequest) {
  if (!hasDatabaseUrlConfigured()) {
    return {
      response: createDatabaseUnavailableResponse(),
    };
  }

  const user = await getSessionUser(request);

  if (!user) {
    return {
      response: Response.json(
        { success: false, error: "Authentication required" },
        { status: 401 }
      ),
    };
  }

  return { user };
}

export async function requireAdminSessionUser(request: NextRequest) {
  if (!hasDatabaseUrlConfigured()) {
    return {
      response: createDatabaseUnavailableResponse(),
    };
  }

  const auth = await requireSessionUser(request);

  if ("response" in auth) {
    return auth;
  }

  if (!isAdminUser(auth.user)) {
    return {
      response: Response.json(
        { success: false, error: "Admin access required" },
        { status: 403 }
      ),
    };
  }

  return auth;
}

export function applySessionCookie(response: NextResponse, token: string, expiresAt: Date) {
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(0),
  });
}

export function isAdminUser(user: { role?: string | null; level?: number | null }) {
  return user.role === "admin" || (user.level ?? 0) >= 4;
}
