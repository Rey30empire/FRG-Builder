import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import {
  resolvePlanKeyFromPriceMap,
  updateBillingAccountFromStripe,
} from "@/lib/billing";
import { getStripeClient, getStripeWebhookSecret } from "@/lib/stripe";

export const runtime = "nodejs";

function toDate(value?: number | null) {
  return typeof value === "number" ? new Date(value * 1000) : null;
}

export async function POST(request: NextRequest) {
  const stripe = getStripeClient();
  const webhookSecret = getStripeWebhookSecret();

  if (!stripe || !webhookSecret) {
    return NextResponse.json(
      { success: false, error: "Stripe webhook is not configured." },
      { status: 503 }
    );
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json(
      { success: false, error: "Missing Stripe signature header." },
      { status: 400 }
    );
  }

  const rawBody = await request.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Invalid Stripe signature",
      },
      { status: 400 }
    );
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const planMeta =
          session.metadata?.planKey === "starter" ||
          session.metadata?.planKey === "pro" ||
          session.metadata?.planKey === "growth"
            ? session.metadata.planKey
            : null;
        const intervalMeta =
          session.metadata?.billingInterval === "monthly" ||
          session.metadata?.billingInterval === "yearly"
            ? session.metadata.billingInterval
            : null;

        if (session.metadata?.userId) {
          await updateBillingAccountFromStripe({
            userId: session.metadata.userId,
            stripeCustomerId:
              typeof session.customer === "string" ? session.customer : session.customer?.id || null,
            stripeSubscriptionId:
              typeof session.subscription === "string"
                ? session.subscription
                : session.subscription?.id || null,
            stripeCheckoutSessionId: session.id,
            planKey: planMeta,
            billingInterval: intervalMeta,
            status: "active",
            checkoutCompletedAt: new Date(),
            metadata: {
              lastCheckoutStatus: session.status,
            },
          });
        }
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const item = subscription.items.data[0];
        const priceId = item?.price?.id || null;
        const resolvedPlan = resolvePlanKeyFromPriceMap({
          priceId,
        });
        const userId = subscription.metadata?.userId || null;

        await updateBillingAccountFromStripe({
          userId,
          stripeCustomerId:
            typeof subscription.customer === "string"
              ? subscription.customer
              : subscription.customer?.id || null,
          stripeSubscriptionId: subscription.id,
          stripePriceId: priceId,
          planKey: resolvedPlan?.planKey || undefined,
          billingInterval: resolvedPlan?.interval || undefined,
          status:
            subscription.status === "trialing"
              ? "trialing"
              : subscription.status === "active"
                ? "active"
                : subscription.status === "past_due"
                  ? "past_due"
                  : subscription.status === "canceled"
                    ? "canceled"
                    : "incomplete",
          cancelAtPeriodEnd: subscription.cancel_at_period_end,
          currentPeriodStart: toDate(item?.current_period_start),
          currentPeriodEnd: toDate(item?.current_period_end),
          trialEndsAt: toDate(subscription.trial_end),
          amountCents: item?.price?.unit_amount || null,
          currency: item?.price?.currency || null,
          metadata: {
            latestInvoiceId:
              typeof subscription.latest_invoice === "string"
                ? subscription.latest_invoice
                : subscription.latest_invoice?.id || null,
          },
        });
        break;
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        const stripeSubscriptionId =
          typeof invoice.parent?.subscription_details?.subscription === "string"
            ? invoice.parent.subscription_details.subscription
            : null;

        if (stripeSubscriptionId) {
          await updateBillingAccountFromStripe({
            stripeSubscriptionId,
            status: "active",
            metadata: {
              latestInvoiceStatus: invoice.status,
              latestInvoiceNumber: invoice.number,
            },
          });
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const stripeSubscriptionId =
          typeof invoice.parent?.subscription_details?.subscription === "string"
            ? invoice.parent.subscription_details.subscription
            : null;

        if (stripeSubscriptionId) {
          await updateBillingAccountFromStripe({
            stripeSubscriptionId,
            status: "past_due",
            metadata: {
              latestInvoiceStatus: invoice.status,
              latestInvoiceNumber: invoice.number,
            },
          });
        }
        break;
      }

      default:
        break;
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Stripe webhook error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Stripe webhook handling failed",
      },
      { status: 500 }
    );
  }
}
