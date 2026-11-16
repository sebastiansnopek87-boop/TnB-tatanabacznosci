import nodemailer from "npm:nodemailer@^9";

export type SmtpMessage = {
  to: string;
  from: string;
  replyTo?: string | null;
  subject: string;
  html: string;
  text: string;
};

type SmtpConfig = {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
};

function env(name: string): string {
  return (Deno.env.get(name) ?? "").trim();
}

export function smtpConfig(): { configured: boolean; host: string | null; port: number | null; secure: boolean; reason: string | null } {
  const host = env("SMTP_HOST") || env("SMTP_HOSTNAME");
  const portRaw = env("SMTP_PORT");
  const port = portRaw ? Number(portRaw) : 0;
  const user = env("SMTP_USERNAME") || env("SMTP_USER");
  const password = Deno.env.get("SMTP_PASSWORD") ?? Deno.env.get("SMTP_PASS") ?? "";
  const secureRaw = env("SMTP_SECURE").toLowerCase();
  const secure = secureRaw ? secureRaw === "true" || secureRaw === "1" : port === 465;

  if (!host || !Number.isInteger(port) || port < 1 || port > 65535 || !user || !password) {
    return { configured: false, host: host || null, port: port || null, secure, reason: "smtp_credentials_missing" };
  }
  // Supabase Edge Functions block outbound SMTP ports 25 and 587.
  if (port === 25 || port === 587) {
    return { configured: false, host, port, secure, reason: "smtp_port_blocked_on_supabase_edge" };
  }
  return { configured: true, host, port, secure, reason: null };
}

let cachedTransport: ReturnType<typeof nodemailer.createTransport> | null = null;
let cachedFingerprint = "";

function transport(config: SmtpConfig) {
  const fingerprint = [config.host, config.port, config.secure, config.user, config.password].join("|");
  if (!cachedTransport || cachedFingerprint !== fingerprint) {
    cachedTransport = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: { user: config.user, pass: config.password },
      connectionTimeout: 12_000,
      greetingTimeout: 12_000,
      socketTimeout: 25_000,
      tls: { minVersion: "TLSv1.2" },
    });
    cachedFingerprint = fingerprint;
  }
  return cachedTransport;
}

export async function verifySmtp(): Promise<void> {
  const state = smtpConfig();
  if (!state.configured) throw new Error(state.reason ?? "smtp_not_configured");
  const config: SmtpConfig = {
    host: state.host!,
    port: state.port!,
    secure: state.secure,
    user: env("SMTP_USERNAME") || env("SMTP_USER"),
    password: Deno.env.get("SMTP_PASSWORD") ?? Deno.env.get("SMTP_PASS") ?? "",
  };
  await transport(config).verify();
}

export async function sendSmtpMail(message: SmtpMessage): Promise<{ messageId: string | null }> {
  const state = smtpConfig();
  if (!state.configured) throw new Error(state.reason ?? "smtp_not_configured");
  const config: SmtpConfig = {
    host: state.host!,
    port: state.port!,
    secure: state.secure,
    user: env("SMTP_USERNAME") || env("SMTP_USER"),
    password: Deno.env.get("SMTP_PASSWORD") ?? Deno.env.get("SMTP_PASS") ?? "",
  };
  const result = await transport(config).sendMail({
    from: env("SMTP_FROM") || message.from,
    to: message.to,
    ...(message.replyTo ? { replyTo: message.replyTo } : {}),
    subject: message.subject,
    html: message.html,
    text: message.text,
  });
  return { messageId: typeof result.messageId === "string" ? result.messageId : null };
}
