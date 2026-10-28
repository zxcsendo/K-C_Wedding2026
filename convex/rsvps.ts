import { internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";

const COOLDOWN_MS = 60_000;
const MAX_PER_EMAIL_PER_DAY = 5;

/** Tables and catering need a number, so headcount is derived, never typed. */
function headcount(r: { attend: string; seats: number }): number {
  return r.attend === "yes" ? r.seats : 0;
}

/**
 * A guest who replies twice has changed their mind, so only their newest reply is
 * counted, reminded or emailed — the older one stays for the record.
 */
function newestPerEmail<T extends { email: string; at: number }>(rows: T[]): Set<T> {
  const latest = new Map<string, T>();
  for (const row of rows) {
    const seen = latest.get(row.email);
    if (!seen || row.at > seen.at) latest.set(row.email, row);
  }
  return new Set(latest.values());
}

const args = {
  name: v.string(),
  email: v.string(),
  source: v.string(),
  at: v.number(),
  attend: v.string(),
  seats: v.number(),
  guests: v.string(),
};

export const record = internalMutation({
  args,
  handler: async (ctx, r) => {
    const email = r.email.toLowerCase();
    const prior = await ctx.db
      .query("rsvps")
      .withIndex("by_email", (q) => q.eq("email", email))
      .collect();

    const lastAt = prior.reduce((max, row) => Math.max(max, row.at), 0);
    if (prior.length > 0 && r.at - lastAt < COOLDOWN_MS) {
      return { saved: false as const, reason: "cooldown" as const };
    }
    const dayAgo = r.at - 24 * 60 * 60 * 1000;
    if (prior.filter((row) => row.at >= dayAgo).length >= MAX_PER_EMAIL_PER_DAY) {
      return { saved: false as const, reason: "daily-limit" as const };
    }

    const id = await ctx.db.insert("rsvps", {
      ...r,
      email,
      adminEmailOk: false,
      adminMessageId: "",
      seat: "",
      note: "",
      confirmedAt: 0,
      confirmEmailOk: false,
      remindedAt: 0,
    });
    return { saved: true as const, id };
  },
});

export const setAdminMessage = internalMutation({
  args: { id: v.id("rsvps"), adminEmailOk: v.boolean(), adminMessageId: v.string() },
  handler: async (ctx, a) => {
    await ctx.db.patch(a.id, { adminEmailOk: a.adminEmailOk, adminMessageId: a.adminMessageId });
  },
});

/** Stores the seat number and the couple's note, and marks the reply confirmed. */
export const confirm = internalMutation({
  args: { id: v.id("rsvps"), seat: v.string(), note: v.string(), at: v.number() },
  handler: async (ctx, a) => {
    const row = await ctx.db.get(a.id);
    if (!row) return { found: false as const };

    const seat = a.seat.trim().slice(0, 40);
    const note = a.note.trim().slice(0, 600);
    await ctx.db.patch(a.id, { seat, note, confirmedAt: a.at, confirmEmailOk: false });
    return { found: true as const, seat, note };
  },
});

export const setConfirmEmailResult = internalMutation({
  args: { id: v.id("rsvps"), ok: v.boolean() },
  handler: async (ctx, a) => {
    await ctx.db.patch(a.id, { confirmEmailOk: a.ok });
  },
});

export const listForAdmin = internalQuery({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("rsvps").withIndex("by_at", (q) => q.gt("at", 0)).collect();
    const current = newestPerEmail(rows);
    return rows.map((row) => ({
      id: row._id,
      at: row.at,
      name: row.name,
      email: row.email,
      attend: row.attend,
      seats: row.seats,
      guests: row.guests,
      headcount: headcount(row),
      seat: row.seat,
      note: row.note,
      confirmedAt: row.confirmedAt,
      confirmEmailOk: row.confirmEmailOk,
      remindedAt: row.remindedAt,
      outdated: !current.has(row),
    }));
  },
});

export const getForConfirm = internalQuery({
  args: { id: v.id("rsvps") },
  handler: async (ctx, a) => {
    const row = await ctx.db.get(a.id);
    if (!row) return null;
    return {
      _id: row._id,
      name: row.name,
      email: row.email,
      attend: row.attend,
      seats: row.seats,
      guests: row.guests,
    };
  },
});

/** Accepted guests who have not yet had the day-before reminder. */
export const listForReminder = internalQuery({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("rsvps").withIndex("by_at", (q) => q.gt("at", 0)).collect();
    return [...newestPerEmail(rows)]
      .filter((row) => row.attend === "yes" && row.remindedAt === 0)
      .map((row) => ({
        id: row._id,
        name: row.name,
        email: row.email,
        seats: row.seats,
        guests: row.guests,
        seat: row.seat,
      }));
  },
});

export const markReminded = internalMutation({
  args: { id: v.id("rsvps"), at: v.number() },
  handler: async (ctx, a) => {
    await ctx.db.patch(a.id, { remindedAt: a.at });
  },
});

export const countSince = internalQuery({
  args: { since: v.number() },
  handler: async (ctx, a) =>
    (await ctx.db.query("rsvps").withIndex("by_at", (q) => q.gte("at", a.since)).collect()).length,
});
