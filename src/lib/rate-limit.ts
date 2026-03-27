import { NextRequest, NextResponse } from "next/server";

export interface RateLimitRule {
  windowMs: number;
  max: number;
}

interface RateLimitBucket {
  count: number;
  resetAt: number;
}

interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
  retryAfterSeconds: number;
}

type RateLimitStore = Map<string, RateLimitBucket>;

const globalRateLimitStore = globalThis as typeof globalThis & {
  __frgRateLimitStore?: RateLimitStore;
};

function getStore() {
  if (!globalRateLimitStore.__frgRateLimitStore) {
    globalRateLimitStore.__frgRateLimitStore = new Map<string, RateLimitBucket>();
  }

  return globalRateLimitStore.__frgRateLimitStore;
}

export function getClientIdentity(request: NextRequest) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");
  const cfIp = request.headers.get("cf-connecting-ip");
  const fallback =
    forwardedFor?.split(",")[0]?.trim() ||
    realIp?.trim() ||
    cfIp?.trim() ||
    "anonymous";

  return fallback;
}

export function consumeRateLimit(
  key: string,
  rule: RateLimitRule,
  now = Date.now(),
  store = getStore()
): RateLimitResult {
  const current = store.get(key);

  if (!current || current.resetAt <= now) {
    const resetAt = now + rule.windowMs;
    store.set(key, {
      count: 1,
      resetAt,
    });

    return {
      allowed: true,
      limit: rule.max,
      remaining: Math.max(rule.max - 1, 0),
      resetAt,
      retryAfterSeconds: Math.ceil(rule.windowMs / 1000),
    };
  }

  if (current.count >= rule.max) {
    return {
      allowed: false,
      limit: rule.max,
      remaining: 0,
      resetAt: current.resetAt,
      retryAfterSeconds: Math.max(Math.ceil((current.resetAt - now) / 1000), 1),
    };
  }

  current.count += 1;
  store.set(key, current);

  return {
    allowed: true,
    limit: rule.max,
    remaining: Math.max(rule.max - current.count, 0),
    resetAt: current.resetAt,
    retryAfterSeconds: Math.max(Math.ceil((current.resetAt - now) / 1000), 1),
  };
}

export function buildRateLimitResponse(result: RateLimitResult, message: string) {
  return NextResponse.json(
    {
      success: false,
      error: message,
    },
    {
      status: 429,
      headers: {
        "Cache-Control": "no-store",
        "Retry-After": String(result.retryAfterSeconds),
        "X-RateLimit-Limit": String(result.limit),
        "X-RateLimit-Remaining": String(result.remaining),
        "X-RateLimit-Reset": String(result.resetAt),
      },
    }
  );
}

export function enforceRateLimit(
  request: NextRequest,
  scope: string,
  rule: RateLimitRule,
  subject?: string
) {
  const identity = subject || getClientIdentity(request);
  const result = consumeRateLimit(`${scope}:${identity}`, rule);

  if (!result.allowed) {
    return buildRateLimitResponse(
      result,
      "Too many requests. Please wait a moment and try again."
    );
  }

  return null;
}
