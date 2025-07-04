import { v } from "convex/values";
import { internalQuery, internalMutation, mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";

// Generate API key for a session
export const generateApiKey = mutation({
  args: {
    sessionId: v.id("sessions"),
    name: v.string(),
    permissions: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Check if user is admin of the session
    const session = await ctx.db.get(args.sessionId);
    if (!session || session.creatorId !== userId) {
      throw new Error("Not authorized");
    }

    const apiKey = `eas_${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`;

    return await ctx.db.insert("apiKeys", {
      sessionId: args.sessionId,
      name: args.name,
      key: apiKey,
      permissions: args.permissions,
      createdBy: userId,
      createdAt: Date.now(),
      active: true,
    });
  },
});

// List API keys for a session
export const listApiKeys = query({
  args: {
    sessionId: v.id("sessions"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Check if user is admin of the session
    const session = await ctx.db.get(args.sessionId);
    if (!session || session.creatorId !== userId) {
      throw new Error("Not authorized");
    }

    return await ctx.db
      .query("apiKeys")
      .withIndex("by_session", q => q.eq("sessionId", args.sessionId))
      .filter(q => q.eq(q.field("active"), true))
      .collect();
  },
});

// Revoke API key
export const revokeApiKey = mutation({
  args: {
    apiKeyId: v.id("apiKeys"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const apiKey = await ctx.db.get(args.apiKeyId);
    if (!apiKey) throw new Error("API key not found");

    const session = await ctx.db.get(apiKey.sessionId);
    if (!session || session.creatorId !== userId) {
      throw new Error("Not authorized");
    }

    await ctx.db.patch(args.apiKeyId, { active: false });
  },
});

// Internal function to verify API key and get session
export const verifyApiKeyAndGetSession = internalQuery({
  args: {
    apiKey: v.string(),
    sessionId: v.id("sessions"),
  },
  handler: async (ctx, args) => {
    const apiKeyRecord = await ctx.db
      .query("apiKeys")
      .withIndex("by_key", q => q.eq("key", args.apiKey))
      .filter(q => q.eq(q.field("active"), true))
      .unique();

    if (!apiKeyRecord || apiKeyRecord.sessionId !== args.sessionId) {
      return null;
    }

    const session = await ctx.db.get(args.sessionId);
    return session;
  },
});

// Internal function to get session locations with API key auth
export const getSessionLocationsWithAuth = internalQuery({
  args: {
    apiKey: v.string(),
    sessionId: v.id("sessions"),
  },
  handler: async (ctx, args) => {
    const apiKeyRecord = await ctx.db
      .query("apiKeys")
      .withIndex("by_key", q => q.eq("key", args.apiKey))
      .filter(q => q.eq(q.field("active"), true))
      .unique();

    if (!apiKeyRecord || apiKeyRecord.sessionId !== args.sessionId) {
      throw new Error("Unauthorized");
    }

    if (!apiKeyRecord.permissions.includes("read:locations")) {
      throw new Error("Insufficient permissions");
    }

    const participants = await ctx.db
      .query("participants")
      .withIndex("by_session", q => q.eq("sessionId", args.sessionId))
      .collect();

    return await Promise.all(
      participants.map(async (p) => {
        const user = await ctx.db.get(p.userId);
        const location = await ctx.db
          .query("locations")
          .withIndex("by_user_session", q => q.eq("userId", p.userId).eq("sessionId", args.sessionId))
          .order("desc")
          .first();
        return {
          userId: p.userId,
          name: user?.name || "Unknown",
          role: p.role,
          location: location?.location,
        };
      })
    );
  },
});

// Internal function to get session alerts with API key auth
export const getSessionAlertsWithAuth = internalQuery({
  args: {
    apiKey: v.string(),
    sessionId: v.id("sessions"),
  },
  handler: async (ctx, args) => {
    const apiKeyRecord = await ctx.db
      .query("apiKeys")
      .withIndex("by_key", q => q.eq("key", args.apiKey))
      .filter(q => q.eq(q.field("active"), true))
      .unique();

    if (!apiKeyRecord || apiKeyRecord.sessionId !== args.sessionId) {
      throw new Error("Unauthorized");
    }

    if (!apiKeyRecord.permissions.includes("read:alerts")) {
      throw new Error("Insufficient permissions");
    }

    const alerts = await ctx.db
      .query("alerts")
      .withIndex("by_session", q => q.eq("sessionId", args.sessionId))
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

// Internal function to get session geofences with API key auth
export const getSessionGeofencesWithAuth = internalQuery({
  args: {
    apiKey: v.string(),
    sessionId: v.id("sessions"),
  },
  handler: async (ctx, args) => {
    const apiKeyRecord = await ctx.db
      .query("apiKeys")
      .withIndex("by_key", q => q.eq("key", args.apiKey))
      .filter(q => q.eq(q.field("active"), true))
      .unique();

    if (!apiKeyRecord || apiKeyRecord.sessionId !== args.sessionId) {
      throw new Error("Unauthorized");
    }

    if (!apiKeyRecord.permissions.includes("read:geofences")) {
      throw new Error("Insufficient permissions");
    }

    return await ctx.db
      .query("geofences")
      .withIndex("by_session", q => q.eq("sessionId", args.sessionId))
      .filter(q => q.eq(q.field("active"), true))
      .collect();
  },
});

// Internal function to send external alert
export const sendExternalAlert = internalMutation({
  args: {
    apiKey: v.string(),
    sessionId: v.id("sessions"),
    type: v.string(),
    message: v.optional(v.string()),
    userId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const apiKeyRecord = await ctx.db
      .query("apiKeys")
      .withIndex("by_key", q => q.eq("key", args.apiKey))
      .filter(q => q.eq(q.field("active"), true))
      .unique();

    if (!apiKeyRecord || apiKeyRecord.sessionId !== args.sessionId) {
      throw new Error("Unauthorized");
    }

    if (!apiKeyRecord.permissions.includes("write:alerts")) {
      throw new Error("Insufficient permissions");
    }

    // Use the provided userId or the API key creator as fallback
    const createdBy = args.userId || apiKeyRecord.createdBy;

    return await ctx.db.insert("alerts", {
      sessionId: args.sessionId,
      type: args.type,
      message: args.message,
      createdBy,
      createdAt: Date.now(),
      acknowledged: [],
    });
  },
});

// Internal function to update external location
export const updateExternalLocation = internalMutation({
  args: {
    apiKey: v.string(),
    sessionId: v.id("sessions"),
    userId: v.id("users"),
    location: v.object({
      lat: v.number(),
      lng: v.number(),
    }),
  },
  handler: async (ctx, args) => {
    const apiKeyRecord = await ctx.db
      .query("apiKeys")
      .withIndex("by_key", q => q.eq("key", args.apiKey))
      .filter(q => q.eq(q.field("active"), true))
      .unique();

    if (!apiKeyRecord || apiKeyRecord.sessionId !== args.sessionId) {
      throw new Error("Unauthorized");
    }

    if (!apiKeyRecord.permissions.includes("write:locations")) {
      throw new Error("Insufficient permissions");
    }

    const participant = await ctx.db
      .query("participants")
      .withIndex("by_session", q => q.eq("sessionId", args.sessionId))
      .filter(q => q.eq(q.field("userId"), args.userId))
      .unique();

    if (!participant) {
      throw new Error("User not in session");
    }

    // Get previous location for geofence checking
    const existingLocation = await ctx.db
      .query("locations")
      .withIndex("by_user_session", q => q.eq("userId", args.userId).eq("sessionId", args.sessionId))
      .order("desc")
      .first();
    
    const previousLocation = existingLocation?.location;

    // Update or create location
    if (existingLocation) {
      await ctx.db.patch(existingLocation._id, {
        location: args.location,
        timestamp: Date.now(),
      });
    } else {
      await ctx.db.insert("locations", {
        sessionId: args.sessionId,
        userId: args.userId,
        location: args.location,
        timestamp: Date.now(),
      });
    }

    // Check for geofence breaches
    await ctx.runMutation(internal.geofences.checkGeofenceEvents, {
      sessionId: args.sessionId,
      userId: args.userId,
      location: args.location,
      previousLocation,
    });
  },
});

// Internal function to process webhook
export const processWebhook = internalMutation({
  args: {
    apiKey: v.string(),
    sessionId: v.id("sessions"),
    payload: v.any(),
  },
  handler: async (ctx, args) => {
    const apiKeyRecord = await ctx.db
      .query("apiKeys")
      .withIndex("by_key", q => q.eq("key", args.apiKey))
      .filter(q => q.eq(q.field("active"), true))
      .unique();

    if (!apiKeyRecord || apiKeyRecord.sessionId !== args.sessionId) {
      throw new Error("Unauthorized");
    }

    if (!apiKeyRecord.permissions.includes("webhook")) {
      throw new Error("Insufficient permissions");
    }

    // Store webhook event
    await ctx.db.insert("webhookEvents", {
      sessionId: args.sessionId,
      apiKeyId: apiKeyRecord._id,
      payload: args.payload,
      timestamp: Date.now(),
    });

    // Process webhook based on payload type
    if (args.payload.type === "location_update" && args.payload.userId && args.payload.location) {
      await ctx.runMutation(internal.api.updateExternalLocation, {
        apiKey: args.apiKey,
        sessionId: args.sessionId,
        userId: args.payload.userId,
        location: args.payload.location,
      });
    } else if (args.payload.type === "alert" && args.payload.alertType) {
      await ctx.runMutation(internal.api.sendExternalAlert, {
        apiKey: args.apiKey,
        sessionId: args.sessionId,
        type: args.payload.alertType,
        message: args.payload.message,
        userId: args.payload.userId,
      });
    }
  },
});

// Verify API key function
export const verifyApiKey = query({
  args: {
    key: v.string(),
  },
  handler: async (ctx, args) => {
    const apiKeyRecord = await ctx.db
      .query("apiKeys")
      .withIndex("by_key", q => q.eq("key", args.key))
      .filter(q => q.eq(q.field("active"), true))
      .unique();

    return apiKeyRecord;
  },
});

// Log webhook event
export const logWebhookEvent = mutation({
  args: {
    sessionId: v.id("sessions"),
    apiKeyId: v.id("apiKeys"),
    payload: v.any(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("webhookEvents", {
      sessionId: args.sessionId,
      apiKeyId: args.apiKeyId,
      payload: args.payload,
      timestamp: Date.now(),
    });
  },
});
