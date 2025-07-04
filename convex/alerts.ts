import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

export const sendAlert = mutation({
  args: {
    sessionId: v.id("sessions"),
    type: v.string(),
    message: v.optional(v.string()),
    createdBy: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    // Use provided createdBy or get from auth
    let userId = args.createdBy;
    if (!userId) {
      const authUserId = await getAuthUserId(ctx);
      if (!authUserId) throw new Error("Not authenticated");
      userId = authUserId;
    }

    await ctx.db.insert("alerts", {
      sessionId: args.sessionId,
      type: args.type,
      message: args.message,
      createdBy: userId,
      createdAt: Date.now(),
      acknowledged: [],
    });
  },
});

export const getSessionAlerts = query({
  args: {
    sessionId: v.id("sessions"),
  },
  handler: async (ctx, args) => {
    const alerts = await ctx.db
      .query("alerts")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .collect();

    return await Promise.all(alerts.map(async (alert) => {
      const user = await ctx.db.get(alert.createdBy);
      return {
        ...alert,
        createdByUser: user ? {
          name: user.name || "Unknown",
          email: user.email,
        } : null,
      };
    }));
  },
});

export const acknowledgeAlert = mutation({
  args: {
    alertId: v.id("alerts"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const alert = await ctx.db.get(args.alertId);
    if (!alert) throw new Error("Alert not found");

    await ctx.db.patch(args.alertId, {
      acknowledged: [...alert.acknowledged, userId],
    });
  },
});
