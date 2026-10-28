import { httpRouter } from "convex/server";
import { httpAction, type ActionCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
  ADMIN_EMAIL,
  adminHtml,
  adminSubject,
  confirmHtml,
  confirmSubject,
  notifyCopies,
  reminderHtml,
  reminderSubject,
  sendViaBrevo,
  type Rsvp,
} from "./brevo";

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, GET, OPTIONS",
  "access-control-allow-headers": "content-type, x-kc-key",
  "access-control-max-age": "86400",
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// Brevo's free plan allows 300 sends/day. Stop mailing before that runs out;
// the reply is still saved, only the notification is skipped.
const MAX_MAILED_PER_DAY = 280;

// The reminder walks the guest list a few at a time so one HTTP action never
// runs long enough to hit Convex's action timeout.
const REMINDER_BATCH = 12;

// One reply can only claim this many seats; bigger parties message us directly.
const MAX_SEATS_PER_REPLY = 8;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...CORS },
  });
}

function text(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function startOfManilaDay(at: number): number {
  const offset = 8 * 60 * 60 * 1000; // Asia/Manila is UTC+8 year-round
  return Math.floor((at + offset) / 86_400_000) * 86_400_000 - offset;
}

/** Brevo returns message ids wrapped in angle brackets. */
function messageIdOf(value: string): string {
  return value.trim().replace(/^</, "").replace(/>$/, "");
}

async function handleSubmit(ctx: ActionCtx, request: Request): Promise<Response> {
  let raw: Record<string, unknown>;
  try {
    raw = (await request.json()) as Record<string, unknown>;
  } catch {
    return json({ ok: false, error: "Send a JSON body." }, 400);
  }

  // Hidden field no guest sees; a filled one means a bot, so accept it silently
  // rather than teach the bot anything.
  if (text(raw.company, 200) !== "") return json({ ok: true });

  const name = text(raw.name, 120);
  const email = text(raw.email, 160).toLowerCase();
  const attend = text(raw.attend, 10).toLowerCase();
  const seats = attend === "yes" ? Math.min(MAX_SEATS_PER_REPLY, Math.max(1, Math.round(Number(raw.seats)) || 1)) : 0;
  const guests = seats > 1 ? text(raw.guests, 160) : "";
  const source = text(raw.page, 60) || "rsvp-page";

  if (name.length < 2) return json({ ok: false, error: "Please tell us your full name." }, 400);
  if (!EMAIL.test(email)) return json({ ok: false, error: "Please check your email address." }, 400);
  if (attend !== "yes" && attend !== "no")
    return json({ ok: false, error: "Please tell us whether you can come." }, 400);
  if (seats > 1 && guests.length < 2)
    return json({ ok: false, error: "Please name the people coming with you." }, 400);

  const at = Date.now();
  const saved = await ctx.runMutation(internal.rsvps.record, {
    name,
    email,
    source,
    at,
    attend,
    seats,
    guests,
  });
  if (!saved.saved) {
    return json(
      {
        ok: false,
        error:
          saved.reason === "cooldown"
            ? "That reply was just received — please wait a few seconds before sending again."
            : "We've had too many replies from this email today. Please try again tomorrow.",
      },
      429,
    );
  }

  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) {
    console.error("[rsvp] saved but BREVO_API_KEY is not set — the couple was not emailed");
    return json({ ok: true });
  }

  const mailedToday = await ctx.runQuery(internal.rsvps.countSince, { since: startOfManilaDay(at) });
  if (mailedToday > MAX_MAILED_PER_DAY) {
    console.error(`[rsvp] saved but today's Brevo budget is spent (${mailedToday} replies)`);
    return json({ ok: true });
  }

  const rsvp: Rsvp = { name, email, attend, seats, guests };
  const admin = await sendViaBrevo(apiKey, {
    to: ADMIN_EMAIL,
    toName: "Wedding RSVP",
    alsoTo: notifyCopies(),
    fromName: "Wedding RSVP · Dec 12",
    subject: adminSubject(rsvp),
    html: adminHtml(rsvp, at),
    // Reply straight to the guest from the notification.
    replyTo: { email, name },
    tag: "admin",
  });
  if (!admin.ok) console.error(`[rsvp] admin email failed for ${email}: ${admin.error}`);

  await ctx.runMutation(internal.rsvps.setAdminMessage, {
    id: saved.id,
    adminEmailOk: admin.ok,
    adminMessageId: admin.ok ? messageIdOf(admin.messageId ?? "") : "",
  });

  return json({ ok: true });
}

/** Emails the day-before reminder to a slice of the guests who still need it. */
async function handleReminder(ctx: ActionCtx, apiKey: string): Promise<Response> {
  const queue = await ctx.runQuery(internal.rsvps.listForReminder, {});
  if (queue.length === 0) return json({ ok: true, sent: 0, failed: 0, remaining: 0 });

  const batch = queue.slice(0, REMINDER_BATCH);
  const results = await Promise.all(
    batch.map(async (row) => {
      const rsvp: Rsvp = {
        name: row.name,
        email: row.email,
        attend: "yes",
        seats: row.seats,
        guests: row.guests,
      };
      const sent = await sendViaBrevo(apiKey, {
        to: row.email,
        toName: row.name,
        subject: reminderSubject(),
        html: reminderHtml(rsvp),
        tag: "reminder",
      });
      return { row, ok: sent.ok, error: sent.error ?? "" };
    }),
  );

  const at = Date.now();
  let sentCount = 0;
  for (const one of results) {
    // A guest who was not reached keeps remindedAt at 0, so the next run retries them.
    if (!one.ok) {
      console.error(`[reminder] failed for ${one.row.email}: ${one.error}`);
      continue;
    }
    await ctx.runMutation(internal.rsvps.markReminded, { id: one.row.id, at });
    sentCount += 1;
  }

  return json({
    ok: true,
    sent: sentCount,
    failed: results.length - sentCount,
    remaining: Math.max(queue.length - batch.length, 0),
  });
}

/**
 * The admin panel's whole API. Guarded by the couple's password, which is
 * checked here rather than in the page so the guest list never ships to a
 * browser that has not supplied it.
 */
async function handleAdmin(ctx: ActionCtx, request: Request): Promise<Response> {
  const secret = process.env.RSVP_ADMIN_KEY;
  const key = request.headers.get("x-kc-key") ?? "";
  if (!secret || key !== secret) {
    console.error("[admin] rejected a request with a missing or wrong key");
    return json({ ok: false, error: "wrong-key" }, 401);
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return json({ ok: false, error: "Send a JSON body." }, 400);
  }

  const action = text(body.action, 20);

  if (action === "list") {
    const rows = await ctx.runQuery(internal.rsvps.listForAdmin, {});
    return json({ ok: true, rows });
  }

  if (action === "reminder") {
    const apiKey = process.env.BREVO_API_KEY;
    if (!apiKey) return json({ ok: false, error: "Brevo is not connected." }, 500);
    return handleReminder(ctx, apiKey);
  }

  if (action !== "confirm") return json({ ok: false, error: "Unknown action." }, 400);

  const id = text(body.id, 64);
  if (!/^[a-z0-9]{10,80}$/.test(id)) return json({ ok: false, error: "Bad reply id." }, 400);

  const seat = text(body.seat, 40);
  const note = text(body.note, 600);

  const row = await ctx.runQuery(internal.rsvps.getForConfirm, { id: id as Id<"rsvps"> });
  if (!row) return json({ ok: false, error: "That reply no longer exists." }, 404);

  // A guest who is coming needs a seat before they can be confirmed; a regret
  // is just recorded.
  if (seat === "" && row.attend === "yes")
    return json({ ok: false, error: "Please give a seat number." }, 400);

  const at = Date.now();
  await ctx.runMutation(internal.rsvps.confirm, { id: row._id, seat, note, at });

  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) {
    console.error("[admin] confirmed but BREVO_API_KEY is not set — the guest was not emailed");
    return json({ ok: true, id, seat, note, confirmedAt: at, emailed: false });
  }

  const rsvp: Rsvp = {
    name: row.name,
    email: row.email,
    attend: row.attend === "yes" ? "yes" : "no",
    seats: row.seats,
    guests: row.guests,
  };
  const guest = await sendViaBrevo(apiKey, {
    to: row.email,
    toName: row.name,
    subject: confirmSubject(rsvp, seat),
    html: confirmHtml(rsvp, seat, note, at),
    tag: "confirm",
  });
  await ctx.runMutation(internal.rsvps.setConfirmEmailResult, { id: row._id, ok: guest.ok });
  if (!guest.ok) console.error(`[admin] confirmation email failed for ${row.email}: ${guest.error}`);

  return json({ ok: true, id, seat, note, confirmedAt: at, emailed: guest.ok });
}

const submit = httpAction(async (ctx, request) => {
  try {
    return await handleSubmit(ctx, request);
  } catch (err) {
    // Without this, a thrown bug reaches the browser as a headerless 500 that
    // reads exactly like a CORS failure.
    console.error(`[rsvp] unexpected failure: ${String(err)}`);
    return json({ ok: false, error: "Something went wrong on our side. Please try again." }, 500);
  }
});

const admin = httpAction(async (ctx, request) => {
  try {
    return await handleAdmin(ctx, request);
  } catch (err) {
    console.error(`[admin] unexpected failure: ${String(err)}`);
    return json({ ok: false, error: "The admin request failed." }, 500);
  }
});

const http = httpRouter();

http.route({ path: "/rsvp", method: "POST", handler: submit });
http.route({ path: "/admin", method: "POST", handler: admin });

const noContent = httpAction(async () => new Response(null, { status: 204, headers: CORS }));
http.route({ path: "/rsvp", method: "OPTIONS", handler: noContent });
http.route({ path: "/admin", method: "OPTIONS", handler: noContent });

http.route({
  path: "/rsvp",
  method: "GET",
  handler: httpAction(async () => json({ ok: true, service: "rsvp", accepts: "POST" })),
});

export default http;
