import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";

export const updateLocation = mutation({
  args: {
    sessionId: v.id("sessions"),
    location: v.object({
      lat: v.number(),
      lng: v.number(),
    }),
    accuracy: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Verify user is participant in session
    const participant = await ctx.db
      .query("participants")
      .withIndex("by_session", q => q.eq("sessionId", args.sessionId))
      .filter(q => q.eq(q.field("userId"), userId))
      .first();

    if (!participant) {
      throw new Error("Not authorized to update location in this session");
    }

    // Get previous location for geofence checking
    const previousLocation = await ctx.db
      .query("locations")
      .withIndex("by_user_session", q => q.eq("userId", userId).eq("sessionId", args.sessionId))
      .order("desc")
      .first();

    // Insert new location
    await ctx.db.insert("locations", {
      sessionId: args.sessionId,
      userId,
      location: args.location,
      timestamp: Date.now(),
      accuracy: args.accuracy,
    });

    // Check geofence events
    await ctx.scheduler.runAfter(0, internal.geofences.checkGeofenceEvents, {
      sessionId: args.sessionId,
      userId,
      location: args.location,
      previousLocation: previousLocation?.location,
    });
  },
});

export const getSessionLocations = query({
  args: {
    sessionId: v.id("sessions"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    // Verify user has access to session
    const participant = await ctx.db
      .query("participants")
      .withIndex("by_session", q => q.eq("sessionId", args.sessionId))
      .filter(q => q.eq(q.field("userId"), userId))
      .first();

    if (!participant) return [];

    // Get all participants
    const participants = await ctx.db
      .query("participants")
      .withIndex("by_session", q => q.eq("sessionId", args.sessionId))
      .collect();

    // Get latest location for each participant
    const locations = await Promise.all(
      participants.map(async (participant) => {
        const user = await ctx.db.get(participant.userId);
        const location = await ctx.db
          .query("locations")
          .withIndex("by_user_session", q => q.eq("userId", participant.userId).eq("sessionId", args.sessionId))
          .order("desc")
          .first();

        return {
          userId: participant.userId,
          name: user?.name || "Unknown",
          role: participant.role,
          location: location?.location,
          lastSeen: location?.timestamp,
          accuracy: location?.accuracy,
        };
      })
    );

    return locations.filter(l => l.location);
  },
});

export const getUserLocationHistory = query({
  args: {
    sessionId: v.id("sessions"),
    userId: v.optional(v.id("users")),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const currentUserId = await getAuthUserId(ctx);
    if (!currentUserId) return [];

    // Verify user has access to session
    const participant = await ctx.db
      .query("participants")
      .withIndex("by_session", q => q.eq("sessionId", args.sessionId))
      .filter(q => q.eq(q.field("userId"), currentUserId))
      .first();

    if (!participant) return [];

    const targetUserId = args.userId || currentUserId;

    const locations = await ctx.db
      .query("locations")
      .withIndex("by_user_session", q => q.eq("userId", targetUserId).eq("sessionId", args.sessionId))
      .order("desc")
      .take(args.limit || 100);

    return locations;
  },
});
