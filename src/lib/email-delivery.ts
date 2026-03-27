import { randomUUID } from "node:crypto";
import nodemailer from "nodemailer";

export interface EmailAttachmentInput {
  filename: string;
  content: Buffer;
  contentType?: string;
}

export interface EmailSenderInput {
  fromName?: string;
  fromAddress?: string;
  replyTo?: string;
  smtpHost?: string;
  smtpPort?: number;
  smtpSecure?: boolean;
  smtpUser?: string;
  smtpPassword?: string;
}

export interface SendTransactionalEmailInput {
  to: string | string[];
  subject: string;
  text: string;
  html: string;
  replyTo?: string;
  attachments?: EmailAttachmentInput[];
  sender?: EmailSenderInput;
}

export interface SendTransactionalEmailResult {
  provider: string;
  messageId: string;
}

type EmailProvider = "log" | "resend" | "smtp";

function extractEmailAddress(value?: string | null) {
  if (!value) return "";
  const match = value.match(/<([^>]+)>/);
  return (match?.[1] || value).trim().toLowerCase();
}

function buildMailbox(name?: string, address?: string) {
  if (!address) return undefined;
  return name?.trim() ? `${name.trim()} <${address}>` : address;
}

function detectEmailProvider(): EmailProvider {
  const configuredProvider = process.env.EMAIL_PROVIDER;

  if (configuredProvider === "resend" || configuredProvider === "smtp" || configuredProvider === "log") {
    return configuredProvider;
  }

  if (process.env.RESEND_API_KEY) {
    return "resend";
  }

  if (process.env.SMTP_HOST) {
    return "smtp";
  }

  return "log";
}

function getFromAddress() {
  return process.env.EMAIL_FROM || "FRG Builder <noreply@frg.local>";
}

function resolveSenderProfile(input: SendTransactionalEmailInput, provider: EmailProvider) {
  const defaultFrom = getFromAddress();
  const defaultReplyTo = process.env.EMAIL_REPLY_TO || undefined;
  const configuredFromAddress = extractEmailAddress(defaultFrom);
  const configuredDomain = configuredFromAddress.split("@")[1] || "";
  const requestedFromAddress = extractEmailAddress(input.sender?.fromAddress);
  const requestedDomain = requestedFromAddress.split("@")[1] || "";
  const usingUserSmtp = Boolean(input.sender?.smtpHost?.trim());

  const canUseExactFrom =
    provider === "log" ||
    usingUserSmtp ||
    (requestedFromAddress && requestedDomain && requestedDomain === configuredDomain);

  return {
    from:
      canUseExactFrom && requestedFromAddress
        ? buildMailbox(input.sender?.fromName, requestedFromAddress) || defaultFrom
        : defaultFrom,
    replyTo:
      input.sender?.replyTo ||
      (canUseExactFrom ? input.replyTo : requestedFromAddress) ||
      input.replyTo ||
      defaultReplyTo,
    smtp: usingUserSmtp
      ? {
          host: input.sender?.smtpHost?.trim() || "",
          port: Number(input.sender?.smtpPort || 587),
          secure: Boolean(input.sender?.smtpSecure),
          user: input.sender?.smtpUser?.trim() || undefined,
          pass: input.sender?.smtpPassword?.trim() || undefined,
        }
      : null,
  };
}

function normalizeRecipients(to: string | string[]) {
  return Array.isArray(to) ? to : [to];
}

async function sendWithResend(input: SendTransactionalEmailInput) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY is required when EMAIL_PROVIDER=resend.");
  }

  const sender = resolveSenderProfile(input, "resend");

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: sender.from,
      to: normalizeRecipients(input.to),
      subject: input.subject,
      text: input.text,
      html: input.html,
      reply_to: sender.replyTo,
      attachments: input.attachments?.map((attachment) => ({
        filename: attachment.filename,
        content: attachment.content.toString("base64"),
      })),
    }),
  });

  const payload = (await response.json().catch(() => null)) as
    | { id?: string; message?: string; name?: string }
    | null;

  if (!response.ok || !payload?.id) {
    throw new Error(payload?.message || payload?.name || "Resend email send failed.");
  }

  return {
    provider: "resend",
    messageId: payload.id,
  } satisfies SendTransactionalEmailResult;
}

async function sendWithSmtp(input: SendTransactionalEmailInput) {
  const sender = resolveSenderProfile(input, "smtp");
  const host = sender.smtp?.host || process.env.SMTP_HOST;
  const port = sender.smtp?.port || Number(process.env.SMTP_PORT || 587);
  const secure = typeof sender.smtp?.secure === "boolean"
    ? sender.smtp.secure
    : process.env.SMTP_SECURE === "true";
  const user = sender.smtp?.user || process.env.SMTP_USER;
  const pass = sender.smtp?.pass || process.env.SMTP_PASSWORD;

  if (!host) {
    throw new Error("SMTP_HOST is required when EMAIL_PROVIDER=smtp.");
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: user && pass ? { user, pass } : undefined,
  });

  const result = await transporter.sendMail({
    from: sender.from,
    to: normalizeRecipients(input.to).join(", "),
    subject: input.subject,
    text: input.text,
    html: input.html,
    replyTo: sender.replyTo,
    attachments: input.attachments?.map((attachment) => ({
      filename: attachment.filename,
      content: attachment.content,
      contentType: attachment.contentType,
    })),
  });

  return {
    provider: "smtp",
    messageId: result.messageId || `smtp-${randomUUID()}`,
  } satisfies SendTransactionalEmailResult;
}

async function sendWithLog(input: SendTransactionalEmailInput) {
  const sender = resolveSenderProfile(input, "log");

  console.log("[email-log] Transactional email preview", {
    provider: "log",
    from: sender.from,
    replyTo: sender.replyTo,
    to: normalizeRecipients(input.to),
    subject: input.subject,
    text: input.text,
    attachments: input.attachments?.map((attachment) => attachment.filename) || [],
  });

  return {
    provider: "log",
    messageId: `log-${randomUUID()}`,
  } satisfies SendTransactionalEmailResult;
}

export async function sendTransactionalEmail(input: SendTransactionalEmailInput) {
  const provider = detectEmailProvider();

  if (provider === "resend") {
    return sendWithResend(input);
  }

  if (provider === "smtp") {
    return sendWithSmtp(input);
  }

  return sendWithLog(input);
}
