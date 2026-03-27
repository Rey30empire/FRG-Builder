import Stripe from "stripe";
import type { BillingInterval, BillingPlanKey } from "@/types";

let stripeClient: Stripe | null | undefined;

export function getStripeClient() {
  if (stripeClient !== undefined) {
    return stripeClient;
  }

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    stripeClient = null;
    return stripeClient;
  }

  stripeClient = new Stripe(secretKey, {
    apiVersion: "2026-03-25.dahlia",
    typescript: true,
  });

  return stripeClient;
}

export function isStripeConfigured() {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

export function getStripeWebhookSecret() {
  return process.env.STRIPE_WEBHOOK_SECRET || null;
}

export function getStripePublishableKey() {
  return process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || null;
}

export function getStripePriceId(planKey: BillingPlanKey, interval: BillingInterval) {
  const envKey = `STRIPE_PRICE_${planKey.toUpperCase()}_${interval.toUpperCase()}`;
  return process.env[envKey] || null;
}

export function getAppBaseUrl(fallbackOrigin?: string | null) {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXTAUTH_URL ||
    fallbackOrigin ||
    "http://localhost:3000"
  ).replace(/\/+$/, "");
}
