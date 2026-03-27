import { NextRequest, NextResponse } from "next/server";
import {
  BILLING_PLANS,
  createOrUpdateStripeCustomer,
  ensureBillingAccount,
  getPlanDefinition,
  updateBillingAccountFromStripe,
} from "@/lib/billing";
import { requireSessionUser } from "@/lib/auth";
import { getAppBaseUrl, getStripeClient, getStripePriceId } from "@/lib/stripe";
import type { BillingInterval, BillingPlanKey } from "@/types";

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
          error: "Stripe is not configured yet. Add STRIPE_SECRET_KEY and price IDs first.",
        },
        { status: 503 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const planKey =
      body?.planKey === "starter" || body?.planKey === "pro" || body?.planKey === "growth"
        ? (body.planKey as BillingPlanKey)
        : null;
    const interval =
      body?.interval === "monthly" || body?.interval === "yearly"
        ? (body.interval as BillingInterval)
        : "monthly";

    if (!planKey) {
      return NextResponse.json(
        { success: false, error: "A valid billing plan is required." },
        { status: 400 }
      );
    }

    if (planKey === "starter") {
      return NextResponse.json(
        { success: false, error: "Starter is the default free tier and does not require checkout." },
        { status: 400 }
      );
    }

    const existingAccount = await ensureBillingAccount(auth.user.id);
    if (
      existingAccount.planKey === planKey &&
      existingAccount.billingInterval === interval &&
      (existingAccount.status === "active" || existingAccount.status === "trialing")
    ) {
      return NextResponse.json(
        {
          success: false,
          error: `The ${BILLING_PLANS[planKey].label} ${interval} plan is already active for this account.`,
        },
        { status: 400 }
      );
    }

    const priceId = getStripePriceId(planKey, interval);
    if (!priceId) {
      return NextResponse.json(
        {
          success: false,
          error: `Stripe price ID for ${planKey} ${interval} is missing from the environment.`,
        },
        { status: 503 }
      );
    }

    const { customerId } = await createOrUpdateStripeCustomer({
      userId: auth.user.id,
      email: auth.user.email,
      name: auth.user.name || undefined,
    });

    const baseUrl = getAppBaseUrl(new URL(request.url).origin);
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${baseUrl}/?billing=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/?billing=cancelled`,
      allow_promotion_codes: true,
      metadata: {
        userId: auth.user.id,
        planKey,
        billingInterval: interval,
      },
      subscription_data: {
        metadata: {
          userId: auth.user.id,
          planKey,
          billingInterval: interval,
        },
      },
    });

    const plan = getPlanDefinition(planKey);
    await updateBillingAccountFromStripe({
      userId: auth.user.id,
      stripeCustomerId: customerId,
      stripeCheckoutSessionId: session.id,
      stripePriceId: priceId,
      planKey,
      status: "incomplete",
      billingInterval: interval,
      amountCents: Math.round(plan.intervalPrices[interval] * 100),
      currency: "usd",
      metadata: {
        checkoutMode: "subscription",
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        url: session.url,
      },
    });
  } catch (error) {
    console.error("Create checkout session error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unable to create checkout session",
      },
      { status: 500 }
    );
  }
}
