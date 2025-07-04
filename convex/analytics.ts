
import { v } from "convex/values";
import { query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

export const getSessionAnalytics = query({
  args: {
    sessionId: v.id("sessions"),
    timeRange: v.union(v.literal("1h"), v.literal("24h"), v.literal("7d"), v.literal("30d")),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    return {
      totalAlerts: 0,
      totalLocations: 0,
      totalBreaches: 0,
      timeRange: args.timeRange,
    };
  },
});