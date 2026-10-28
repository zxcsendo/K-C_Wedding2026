export const ADMIN_EMAIL = "december12wedding2026@gmail.com";
const BREVO_URL = "https://api.brevo.com/v3/smtp/email";
const SENDER_NAME = "Kenneth & Catherine";

const EVENT = {
  couple: "Kenneth & Catherine",
  day: "Saturday, 12 December 2026",
  time: "1:00 PM",
  venue: "Edgie's Restaurant and Events",
  address: "Pasolo Rd, Metro Manila, Philippines",
};

/** Printed on every acceptance unless the couple adds their own note on top. */
const COUPLE_NOTE = [
  "Thank you for accepting our wedding invitation and for being part of our special day. We feel truly blessed to share this beautiful milestone with you as we begin our journey as husband and wife.",
  "We look forward to celebrating with you!",
  "With love and gratitude,",
  "Kenneth & Cath \u{1F90D}",
].join("\n");

const REMINDER_HEAD = "\u{1F90D} TOMORROW IS THE DAY! \u{1F48D}";
const REMINDER_LINES = [
  "Just a little reminder that our wedding is happening tomorrow!",
  "\u{1F4C5} December 12, 2026",
  "\u{23F0} 1 PM",
  "\u{1F4CD} Edgies's Restaurant and Events",
  "Kindly arrive on time and remember our dress code.",
  "Please note that parking is limited at the venue.",
  "We're excited to celebrate this special day with you! See you tomorrow!",
];

/** The only questions the RSVP form asks, so the only answers worth mailing. */
export type Rsvp = {
  name: string;
  email: string;
  attend: "yes" | "no";
  seats: number;
  guests: string;
};

/** Brevo renders our copy as HTML, so anything a guest typed must be escaped. */
export function esc(value: string): string {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function when(at: number): string {
  try {
    return (
      new Intl.DateTimeFormat("en-GB", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Asia/Manila",
      }).format(new Date(at)) + " PHT"
    );
  } catch {
    return new Date(at).toISOString();
  }
}

function shell(heading: string, body: string): string {
  return [
    `<div style="font-family:Georgia,'Times New Roman',serif;color:#2c2a28;background:#faf8f5;padding:28px 16px">`,
    `<div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e6ded3;border-radius:10px;padding:30px 26px">`,
    `<p style="margin:0 0 4px;letter-spacing:.18em;text-transform:uppercase;font-size:11px;color:#a08a6d">${EVENT.couple}</p>`,
    `<h1 style="margin:0 0 18px;font-size:23px;font-weight:normal;line-height:1.3">${heading}</h1>`,
    body,
    `<p style="margin:26px 0 0;font-size:12px;color:#8b8378;line-height:1.6">${EVENT.day} &middot; ${EVENT.time} &middot; ${esc(EVENT.venue)}, ${esc(EVENT.address)}</p>`,
    `</div></div>`,
  ].join("");
}

function rows(pairs: [string, string][]): string {
  const cells = pairs
    .map(
      ([label, value]) =>
        `<tr><td style="padding:9px 0;border-bottom:1px solid #f0eae1;color:#8b8378;font-size:11px;text-transform:uppercase;letter-spacing:.08em;width:34%;vertical-align:top">${label}</td>` +
        `<td style="padding:9px 0;border-bottom:1px solid #f0eae1;font-size:15px;line-height:1.6">${value}</td></tr>`,
    )
    .join("");
  return `<table style="width:100%;border-collapse:collapse">${cells}</table>`;
}

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || "there";
}

function paragraph(text: string): string {
  return `<p style="margin:0 0 14px;font-size:16px;line-height:1.8">${esc(text).replace(/\r?\n/g, "<br/>")}</p>`;
}

function replyText(r: Rsvp): string {
  return r.attend === "yes" ? "Accepts with pleasure" : "Regretfully declines";
}

function seatsText(r: Rsvp): string {
  if (r.attend !== "yes") return "&mdash;";
  return `${r.seats} ${r.seats === 1 ? "seat" : "seats"}`;
}

function guestsText(r: Rsvp): string {
  if (r.attend !== "yes") return "&mdash;";
  return r.guests ? esc(r.guests) : "Coming alone";
}

/** Guest-typed name lists get long; a subject line does not. */
function shortList(guests: string): string {
  const names = guests.split(",").map((name) => name.trim()).filter(Boolean);
  if (names.length <= 2) return names.join(", ");
  return `${names[0]} +${names.length - 1} more`;
}

export function adminSubject(r: Rsvp): string {
  if (r.attend !== "yes") return `Regrets — ${r.name}`;
  return `Coming (${r.seats}) — ${r.name}${r.guests ? ` + ${shortList(r.guests)}` : ""}`;
}

export function adminHtml(r: Rsvp, at: number): string {
  return shell(
    "A new RSVP has arrived",
    rows([
      ["Name", esc(r.name)],
      ["Email", `<a href="mailto:${esc(r.email)}" style="color:#8a6f4e">${esc(r.email)}</a>`],
      ["Reply", replyText(r)],
      ["How many", seatsText(r)],
      ["With whom", guestsText(r)],
      ["Received", esc(when(at))],
    ]),
  );
}

export function confirmSubject(r: Rsvp, seat: string): string {
  if (r.attend !== "yes") return "Thank you for letting us know";
  return seat ? `Your RSVP is confirmed — Seat ${seat}` : "Your RSVP is confirmed";
}

export function confirmHtml(r: Rsvp, seat: string, note: string, at: number): string {
  const declines = r.attend !== "yes";
  const companion = r.guests ? firstName(r.guests.split(",")[0] ?? "") : "";
  const lead = declines
    ? `<p style="margin:0 0 16px;font-size:15px;line-height:1.75">Thank you for replying, ${esc(firstName(r.name))}. We'll miss you at the celebration, and we'll raise a toast to you from the floor.</p>`
    : `<p style="margin:0 0 16px;font-size:15px;line-height:1.75">Good news, ${esc(firstName(r.name))}${companion ? ` and ${esc(companion)}` : ""} — we have read your reply and your place is saved.</p>`;

  const table = rows(
    declines
      ? [
          ["Name", esc(r.name)],
          ["Reply", "Regretfully declines"],
          ["Confirmed on", esc(when(at))],
        ]
      : [
          ["Name", esc(r.name)],
          ["Reply", "Accepts with pleasure"],
          ["How many", seatsText(r)],
          ...(r.guests ? ([["With whom", guestsText(r)]] as [string, string][]) : []),
          ...(seat ? [["Seat number", `<strong style="font-size:19px">${esc(seat)}</strong>`] as [string, string]] : []),
          ["Confirmed on", esc(when(at))],
        ],
  );

  // The couple's standing note, then anything personal they typed for this guest.
  const label = (t: string) =>
    `<p style="margin:22px 0 0;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#8b8378">${t}</p>`;

  const personal = note
    ? `${label("A personal note")}<p style="margin:6px 0 0;font-size:16px;line-height:1.75;font-style:italic">${esc(note).replace(/\r?\n/g, "<br/>")}</p>`
    : "";
  const standing = declines ? "" : `${label("A note from us")}${paragraph(COUPLE_NOTE)}`;

  const closing = declines
    ? "Nothing more is needed from you. Should anything change, just reply to this email."
    : "Please keep this email — your seat number is on it. If anything changes, just reply to this email.";

  return shell(
    declines ? "Your reply is noted" : "You're on the list",
    `${lead}${table}${personal}${standing}<p style="margin:18px 0 0;font-size:15px;line-height:1.75">${closing}</p>`,
  );
}

export function reminderSubject(): string {
  return REMINDER_HEAD;
}

export function reminderHtml(r: Rsvp): string {
  const seats =
    r.attend === "yes" && r.guests
      ? `<p style="margin:18px 0 0;font-size:14px;line-height:1.7;color:#8b8378">This reminder is for ${esc(r.name)} and ${esc(r.guests)}.</p>`
      : "";
  return shell(
    REMINDER_HEAD,
    `${REMINDER_LINES.map(paragraph).join("")}${seats}`,
  );
}

/**
 * Brevo rewrites our From to `december12wedding2026@…brevosend.com`, which mirrors the
 * couple's own address, so Gmail spam-folds it as self-impersonation. RSVP_NOTIFY_EMAILS
 * copies each notification to a mailbox without that problem (Outlook, iCloud, a phone email).
 */
export function notifyCopies(): string[] {
  const extra = (process.env.RSVP_NOTIFY_EMAILS ?? "")
    .split(/[,;\s]+/)
    .map((address) => address.trim().toLowerCase())
    .filter((address) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(address) && address !== ADMIN_EMAIL);
  return Array.from(new Set(extra));
}

type Send = {
  to: string;
  toName: string;
  alsoTo?: string[];
  /** The couple's copy must not read as self-mail: a From name equal to their own
   *  name is exactly what Gmail's spam filter keys on. */
  fromName?: string;
  subject: string;
  html: string;
  replyTo?: { email: string; name: string };
  tag: string;
};

export async function sendViaBrevo(
  apiKey: string,
  s: Send,
): Promise<{ ok: boolean; messageId?: string; error?: string }> {
  let res: Response;
  try {
    res = await fetch(BREVO_URL, {
      method: "POST",
      headers: { "api-key": apiKey, "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        sender: { name: s.fromName ?? SENDER_NAME, email: ADMIN_EMAIL },
        to: [{ email: s.to, name: s.toName }, ...(s.alsoTo ?? []).map((email) => ({ email, name: s.toName }))],
        subject: s.subject,
        htmlContent: s.html,
        tags: [`rsvp-${s.tag}`],
        ...(s.replyTo ? { replyTo: s.replyTo } : {}),
      }),
      signal: AbortSignal.timeout(15_000),
    });
  } catch (e) {
    return { ok: false, error: `network: ${String(e)}` };
  }
  if (res.ok) {
    const body = (await res.json().catch(() => null)) as { messageId?: string } | null;
    return { ok: true, messageId: body?.messageId ?? "" };
  }
  const text = (await res.text().catch(() => "")).slice(0, 300);
  return { ok: false, error: `HTTP ${res.status}: ${text}` };
}
