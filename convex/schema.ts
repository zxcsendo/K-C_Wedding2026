import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  rsvps: defineTable({
    // What the guest fills in on the RSVP form.
    name: v.string(),
    email: v.string(),
    source: v.string(),
    at: v.number(),
    attend: v.string(), // "yes" or "no"
    seats: v.number(), // how many seats this reply needs, 0 when they decline
    guests: v.string(), // who else is coming, "" when it is just them
    // Set when the couple is notified.
    adminEmailOk: v.boolean(),
    adminMessageId: v.string(),
    // Filled in by the couple in the admin panel.
    seat: v.string(),
    note: v.string(),
    confirmedAt: v.number(),
    confirmEmailOk: v.boolean(),
    // Day the Dec 11 reminder went out to this guest; 0 until then.
    remindedAt: v.number(),
  })
    .index("by_email", ["email"])
    .index("by_at", ["at"]),
});
