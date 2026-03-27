import { NextRequest, NextResponse } from "next/server";
import { ensureBillingAccount, updateBillingAccountFromStripe } from "@/lib/billing";
import { requireSessionUser } from "@/lib/auth";
import { getAppBaseUrl, getStripeClient } from "@/lib/stripe";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const auth = await requireSessionUser(request);
    if ("response" in auth) return auth.response;

    const stripe = getStripeClient();
    if (!stripe) {
      return NextResponse.json(
        {
          success: false,
          error: "Stripe is not configured yet. Add STRIPE_SECRET_KEY first.",
        },
        { status: 503 }
      );
    }

    const account = await ensureBillingAccount(auth.user.id);
    if (!account.stripeCustomerId) {
      return NextResponse.json(
        {
          success: false,
          error: "This account does not have a Stripe customer yet. Start checkout first.",
        },
        { status: 400 }
      );
    }

    const baseUrl = getAppBaseUrl(new URL(request.url).origin);
    const session = await stripe.billingPortal.sessions.create({
      customer: account.stripeCustomerId,
      return_url: `${baseUrl}/?billing=portal-return`,
    });

    await updateBillingAccountFromStripe({
      userId: auth.user.id,
      portalAccessedAt: new Date(),
    });

    return NextResponse.json({
      success: true,
      data: {
        url: session.url,
      },
    });
  } catch (error) {
    console.error("Create billing portal session error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unable to open billing portal",
      },
      { status: 500 }
    );
  }
}
