import { v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";

// Helper function to check if a point is inside a circle
function isPointInCircle(point: { lat: number; lng: number }, center: { lat: number; lng: number }, radius: number): boolean {
  const R = 6371000; // Earth's radius in meters
  const dLat = (point.lat - center.lat) * Math.PI / 180;
  const dLng = (point.lng - center.lng) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(center.lat * Math.PI / 180) * Math.cos(point.lat * Math.PI / 180) *
    Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const distance = R * c;
  return distance <= radius;
}

// Helper function to check if a point is inside a polygon
function isPointInPolygon(point: { lat: number; lng: number }, polygon: Array<{ lat: number; lng: number }>): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    if (((polygon[i].lat > point.lat) !== (polygon[j].lat > point.lat)) &&
        (point.lng < (polygon[j].lng - polygon[i].lng) * (point.lat - polygon[i].lat) / (polygon[j].lat - polygon[i].lat) + polygon[i].lng)) {
      inside = !inside;
    }
  }
  return inside;
}

// Helper function to check if geofence is active based on schedule
function isGeofenceActiveNow(schedule?: any): boolean {
  if (!schedule || !schedule.enabled) return true;
  
  const now = new Date();
  const currentDay = now.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
  const currentTime = now.toTimeString().slice(0, 5); // HH:MM format
  
  // Check if current day is in the schedule
  if (!schedule.days.includes(currentDay)) return false;
  
  // Check if current time is within the schedule
  const startTime = schedule.startTime;
  const endTime = schedule.endTime;
  
  if (startTime <= endTime) {
    // Same day schedule (e.g., 09:00 to 17:00)
    return currentTime >= startTime && currentTime <= endTime;
  } else {
    // Overnight schedule (e.g., 22:00 to 06:00)
    return currentTime >= startTime || currentTime <= endTime;
  }
}

export const createGeofence = mutation({
  args: {
    sessionId: v.id("sessions"),
    name: v.string(),
    type: v.union(v.literal("safe_zone"), v.literal("restricted_zone"), v.literal("alert_zone")),
    shape: v.union(v.literal("circle"), v.literal("polygon")),
    center: v.optional(v.object({
      lat: v.number(),
      lng: v.number(),
    })),
    radius: v.optional(v.number()),
    coordinates: v.optional(v.array(v.object({
      lat: v.number(),
      lng: v.number(),
    }))),
    alertOnEntry: v.boolean(),
    alertOnExit: v.boolean(),
    description: v.optional(v.string()),
    schedule: v.optional(v.object({
      enabled: v.boolean(),
      startTime: v.string(),
      endTime: v.string(),
      days: v.array(v.union(
        v.literal("monday"),
        v.literal("tuesday"), 
        v.literal("wednesday"),
        v.literal("thursday"),
        v.literal("friday"),
        v.literal("saturday"),
        v.literal("sunday")
      )),
      timezone: v.optional(v.string()),
    })),
    userRules: v.optional(v.array(v.object({
      userId: v.id("users"),
      alertOnEntry: v.boolean(),
      alertOnExit: v.boolean(),
      customMessage: v.optional(v.string()),
      priority: v.optional(v.union(v.literal("low"), v.literal("medium"), v.literal("high"), v.literal("critical"))),
    }))),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Verify user has access to the session
    const participant = await ctx.db
      .query("participants")
      .withIndex("by_session", q => q.eq("sessionId", args.sessionId))
      .filter(q => q.eq(q.field("userId"), userId))
      .first();

    if (!participant) {
      throw new Error("Not authorized to create geofences in this session");
    }

    const geofenceId = await ctx.db.insert("geofences", {
      sessionId: args.sessionId,
      name: args.name,
      type: args.type,
      shape: args.shape,
      center: args.center,
      radius: args.radius,
      coordinates: args.coordinates,
      alertOnEntry: args.alertOnEntry,
      alertOnExit: args.alertOnExit,
      description: args.description,
      active: true,
      createdAt: Date.now(),
      createdBy: userId,
      schedule: args.schedule,
      userRules: args.userRules,
    });

    return geofenceId;
  },
});

export const updateGeofence = mutation({
  args: {
    geofenceId: v.id("geofences"),
    sessionId: v.id("sessions"),
    name: v.string(),
    type: v.union(v.literal("safe_zone"), v.literal("restricted_zone"), v.literal("alert_zone")),
    shape: v.union(v.literal("circle"), v.literal("polygon")),
    center: v.optional(v.object({
      lat: v.number(),
      lng: v.number(),
    })),
    radius: v.optional(v.number()),
    coordinates: v.optional(v.array(v.object({
      lat: v.number(),
      lng: v.number(),
    }))),
    alertOnEntry: v.boolean(),
    alertOnExit: v.boolean(),
    description: v.optional(v.string()),
    schedule: v.optional(v.object({
      enabled: v.boolean(),
      startTime: v.string(),
      endTime: v.string(),
      days: v.array(v.union(
        v.literal("monday"),
        v.literal("tuesday"), 
        v.literal("wednesday"),
        v.literal("thursday"),
        v.literal("friday"),
        v.literal("saturday"),
        v.literal("sunday")
      )),
      timezone: v.optional(v.string()),
    })),
    userRules: v.optional(v.array(v.object({
      userId: v.id("users"),
      alertOnEntry: v.boolean(),
      alertOnExit: v.boolean(),
      customMessage: v.optional(v.string()),
      priority: v.optional(v.union(v.literal("low"), v.literal("medium"), v.literal("high"), v.literal("critical"))),
    }))),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const geofence = await ctx.db.get(args.geofenceId);
    if (!geofence) throw new Error("Geofence not found");

    // Check if user has permission to update
    const participant = await ctx.db
      .query("participants")
      .withIndex("by_session", q => q.eq("sessionId", args.sessionId))
      .filter(q => q.eq(q.field("userId"), userId))
      .first();

    if (!participant || (geofence.createdBy !== userId && participant.role !== "Admin")) {
      throw new Error("Not authorized to update this geofence");
    }

    await ctx.db.patch(args.geofenceId, {
      name: args.name,
      type: args.type,
      shape: args.shape,
      center: args.center,
      radius: args.radius,
      coordinates: args.coordinates,
      alertOnEntry: args.alertOnEntry,
      alertOnExit: args.alertOnExit,
      description: args.description,
      schedule: args.schedule,
      userRules: args.userRules,
    });
  },
});

export const deleteGeofence = mutation({
  args: {
    geofenceId: v.id("geofences"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const geofence = await ctx.db.get(args.geofenceId);
    if (!geofence) throw new Error("Geofence not found");

    // Check if user has permission to delete
    const participant = await ctx.db
      .query("participants")
      .withIndex("by_session", q => q.eq("sessionId", geofence.sessionId))
      .filter(q => q.eq(q.field("userId"), userId))
      .first();

    if (!participant || (geofence.createdBy !== userId && participant.role !== "Admin")) {
      throw new Error("Not authorized to delete this geofence");
    }

    await ctx.db.delete(args.geofenceId);
  },
});

export const getSessionGeofences = query({
  args: {
    sessionId: v.id("sessions"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    // Verify user has access to the session
    const participant = await ctx.db
      .query("participants")
      .withIndex("by_session", q => q.eq("sessionId", args.sessionId))
      .filter(q => q.eq(q.field("userId"), userId))
      .first();

    if (!participant) return [];

    const geofences = await ctx.db
      .query("geofences")
      .withIndex("by_session", q => q.eq("sessionId", args.sessionId))
      .collect();

    return geofences.map(geofence => ({
      ...geofence,
      isActive: isGeofenceActiveNow(geofence.schedule),
    }));
  },
});

export const bulkUpdateGeofences = mutation({
  args: {
    sessionId: v.id("sessions"),
    geofenceIds: v.array(v.id("geofences")),
    updates: v.object({
      active: v.optional(v.boolean()),
      alertOnEntry: v.optional(v.boolean()),
      alertOnExit: v.optional(v.boolean()),
    }),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Verify user has admin access to the session
    const participant = await ctx.db
      .query("participants")
      .withIndex("by_session", q => q.eq("sessionId", args.sessionId))
      .filter(q => q.eq(q.field("userId"), userId))
      .first();

    if (!participant || participant.role !== "Admin") {
      throw new Error("Not authorized to bulk update geofences");
    }

    // Update each geofence
    for (const geofenceId of args.geofenceIds) {
      const geofence = await ctx.db.get(geofenceId);
      if (geofence && geofence.sessionId === args.sessionId) {
        await ctx.db.patch(geofenceId, args.updates);
      }
    }
  },
});

// Check location against geofences and create events
export const checkGeofenceEvents = internalMutation({
  args: {
    sessionId: v.id("sessions"),
    userId: v.id("users"),
    location: v.object({
      lat: v.number(),
      lng: v.number(),
    }),
    previousLocation: v.optional(v.object({
      lat: v.number(),
      lng: v.number(),
    })),
  },
  handler: async (ctx, args) => {
    // Get all active geofences for the session
    const geofences = await ctx.db
      .query("geofences")
      .withIndex("by_session", q => q.eq("sessionId", args.sessionId))
      .filter(q => q.eq(q.field("active"), true))
      .collect();

    const activeGeofences = geofences.filter(g => isGeofenceActiveNow(g.schedule));

    for (const geofence of activeGeofences) {
      const isCurrentlyInside = geofence.shape === 'circle' && geofence.center && geofence.radius
        ? isPointInCircle(args.location, geofence.center, geofence.radius)
        : geofence.shape === 'polygon' && geofence.coordinates
        ? isPointInPolygon(args.location, geofence.coordinates)
        : false;

      const wasInside = args.previousLocation && (
        geofence.shape === 'circle' && geofence.center && geofence.radius
          ? isPointInCircle(args.previousLocation, geofence.center, geofence.radius)
          : geofence.shape === 'polygon' && geofence.coordinates
          ? isPointInPolygon(args.previousLocation, geofence.coordinates)
          : false
      );

      // Check for entry/exit events
      if (isCurrentlyInside && !wasInside) {
        // Entry event
        const shouldAlert = geofence.alertOnEntry || 
          geofence.userRules?.find(rule => rule.userId === args.userId)?.alertOnEntry;

        const eventId = await ctx.db.insert("geofenceEvents", {
          sessionId: args.sessionId,
          geofenceId: geofence._id,
          userId: args.userId,
          eventType: "entry",
          timestamp: Date.now(),
          location: args.location,
          alertSent: !!shouldAlert,
          acknowledged: false,
        });

        if (shouldAlert) {
          // Schedule alert creation
          await ctx.scheduler.runAfter(0, internal.geofences.createGeofenceAlert, {
            eventId,
            geofenceId: geofence._id,
            userId: args.userId,
            eventType: "entry",
          });
        }
      } else if (!isCurrentlyInside && wasInside) {
        // Exit event
        const shouldAlert = geofence.alertOnExit || 
          geofence.userRules?.find(rule => rule.userId === args.userId)?.alertOnExit;

        // Calculate duration inside
        const lastEntry = await ctx.db
          .query("geofenceEvents")
          .withIndex("by_user_geofence", q => q.eq("userId", args.userId).eq("geofenceId", geofence._id))
          .filter(q => q.eq(q.field("eventType"), "entry"))
          .order("desc")
          .first();

        const duration = lastEntry ? Date.now() - lastEntry.timestamp : undefined;

        const eventId = await ctx.db.insert("geofenceEvents", {
          sessionId: args.sessionId,
          geofenceId: geofence._id,
          userId: args.userId,
          eventType: "exit",
          timestamp: Date.now(),
          location: args.location,
          alertSent: !!shouldAlert,
          acknowledged: false,
          metadata: {
            duration,
          },
        });

        if (shouldAlert) {
          // Schedule alert creation
          await ctx.scheduler.runAfter(0, internal.geofences.createGeofenceAlert, {
            eventId,
            geofenceId: geofence._id,
            userId: args.userId,
            eventType: "exit",
          });
        }
      }

      // Check for violations (being in restricted zones)
      if (isCurrentlyInside && geofence.type === "restricted_zone") {
        // Check if we already have a recent violation event
        const recentViolation = await ctx.db
          .query("geofenceEvents")
          .withIndex("by_user_geofence", q => q.eq("userId", args.userId).eq("geofenceId", geofence._id))
          .filter(q => q.eq(q.field("eventType"), "violation"))
          .order("desc")
          .first();

        // Only create violation if no recent one (within 5 minutes)
        if (!recentViolation || Date.now() - recentViolation.timestamp > 300000) {
          const eventId = await ctx.db.insert("geofenceEvents", {
            sessionId: args.sessionId,
            geofenceId: geofence._id,
            userId: args.userId,
            eventType: "violation",
            timestamp: Date.now(),
            location: args.location,
            alertSent: true,
            acknowledged: false,
          });

          // Always send alert for violations
          await ctx.scheduler.runAfter(0, internal.geofences.createGeofenceAlert, {
            eventId,
            geofenceId: geofence._id,
            userId: args.userId,
            eventType: "violation",
          });
        }
      }
    }
  },
});

export const createGeofenceAlert = internalMutation({
  args: {
    eventId: v.id("geofenceEvents"),
    geofenceId: v.id("geofences"),
    userId: v.id("users"),
    eventType: v.union(v.literal("entry"), v.literal("exit"), v.literal("violation")),
  },
  handler: async (ctx, args) => {
    const geofence = await ctx.db.get(args.geofenceId);
    const user = await ctx.db.get(args.userId);
    const event = await ctx.db.get(args.eventId);

    if (!geofence || !user || !event) return;

    // Get user-specific rule if exists
    const userRule = geofence.userRules?.find(rule => rule.userId === args.userId);
    const customMessage = userRule?.customMessage;
    const priority = userRule?.priority || "medium";

    // Create alert message
    const getAlertMessage = () => {
      if (customMessage) return customMessage;
      
      switch (args.eventType) {
        case "entry":
          return `${user.name} entered ${geofence.name}`;
        case "exit":
          return `${user.name} exited ${geofence.name}`;
        case "violation":
          return `🚨 VIOLATION: ${user.name} is in restricted zone ${geofence.name}`;
        default:
          return `Geofence event: ${user.name} - ${geofence.name}`;
      }
    };

    // Create alert
    const alertId = await ctx.db.insert("alerts", {
      sessionId: geofence.sessionId,
      createdBy: args.userId,
      type: args.eventType === "violation" ? "emergency" : "geofence",
      message: getAlertMessage(),
      createdAt: Date.now(),
      acknowledged: [],
      location: event.location,
      priority,
    });

    // Create system message in chat
    await ctx.db.insert("messages", {
      sessionId: geofence.sessionId,
      userId: args.userId,
      content: getAlertMessage(),
      timestamp: Date.now(),
      type: "system",
      metadata: {
        alertId,
        geofenceEventId: args.eventId,
      },
    });

    // Create notifications for session participants
    const participants = await ctx.db
      .query("participants")
      .withIndex("by_session", q => q.eq("sessionId", geofence.sessionId))
      .collect();

    for (const participant of participants) {
      if (participant.userId !== args.userId) { // Don't notify the user who triggered the event
        await ctx.db.insert("notifications", {
          userId: participant.userId,
          sessionId: geofence.sessionId,
          type: "geofence_alert",
          title: `Geofence ${args.eventType.charAt(0).toUpperCase() + args.eventType.slice(1)}`,
          message: getAlertMessage(),
          read: false,
          createdAt: Date.now(),
          data: {
            alertId,
            geofenceEventId: args.eventId,
            sessionId: geofence.sessionId,
          },
        });
      }
    }
  },
});

export const getGeofenceEvents = query({
  args: {
    sessionId: v.id("sessions"),
    limit: v.optional(v.number()),
    eventType: v.optional(v.union(v.literal("entry"), v.literal("exit"), v.literal("violation"))),
    userId: v.optional(v.id("users")),
    geofenceId: v.optional(v.id("geofences")),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    // Verify user has access to the session
    const participant = await ctx.db
      .query("participants")
      .withIndex("by_session", q => q.eq("sessionId", args.sessionId))
      .filter(q => q.eq(q.field("userId"), userId))
      .first();

    if (!participant) return [];

    let query = ctx.db
      .query("geofenceEvents")
      .withIndex("by_session", q => q.eq("sessionId", args.sessionId));

    if (args.eventType) {
      query = query.filter(q => q.eq(q.field("eventType"), args.eventType));
    }

    if (args.userId) {
      query = query.filter(q => q.eq(q.field("userId"), args.userId));
    }

    if (args.geofenceId) {
      query = query.filter(q => q.eq(q.field("geofenceId"), args.geofenceId));
    }

    const events = await query
      .order("desc")
      .take(args.limit || 100);

    // Enrich events with user and geofence data
    const enrichedEvents = await Promise.all(
      events.map(async (event) => {
        const user = await ctx.db.get(event.userId);
        const geofence = await ctx.db.get(event.geofenceId);
        
        return {
          ...event,
          userName: user?.name || "Unknown User",
          geofenceName: geofence?.name || "Unknown Geofence",
          geofenceType: geofence?.type,
        };
      })
    );

    return enrichedEvents;
  },
});

export const acknowledgeGeofenceEvent = mutation({
  args: {
    eventId: v.id("geofenceEvents"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const event = await ctx.db.get(args.eventId);
    if (!event) throw new Error("Event not found");

    // Verify user has access to the session
    const participant = await ctx.db
      .query("participants")
      .withIndex("by_session", q => q.eq("sessionId", event.sessionId))
      .filter(q => q.eq(q.field("userId"), userId))
      .first();

    if (!participant) {
      throw new Error("Not authorized to acknowledge this event");
    }

    await ctx.db.patch(args.eventId, {
      acknowledged: true,
      acknowledgedBy: userId,
      acknowledgedAt: Date.now(),
    });
  },
});

export const getGeofenceAnalytics = query({
  args: {
    sessionId: v.id("sessions"),
    timeRange: v.optional(v.union(v.literal("24h"), v.literal("7d"), v.literal("30d"))),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    // Verify user has access to the session
    const participant = await ctx.db
      .query("participants")
      .withIndex("by_session", q => q.eq("sessionId", args.sessionId))
      .filter(q => q.eq(q.field("userId"), userId))
      .first();

    if (!participant) return null;

    const timeRange = args.timeRange || "24h";
    const now = Date.now();
    const timeRangeMs = {
      "24h": 24 * 60 * 60 * 1000,
      "7d": 7 * 24 * 60 * 60 * 1000,
      "30d": 30 * 24 * 60 * 60 * 1000,
    }[timeRange];

    const startTime = now - timeRangeMs;

    // Get events in time range
    const events = await ctx.db
      .query("geofenceEvents")
      .withIndex("by_session", q => q.eq("sessionId", args.sessionId))
      .filter(q => q.gte(q.field("timestamp"), startTime))
      .collect();

    // Get geofences
    const geofences = await ctx.db
      .query("geofences")
      .withIndex("by_session", q => q.eq("sessionId", args.sessionId))
      .collect();

    // Calculate analytics
    const totalEvents = events.length;
    const violations = events.filter(e => e.eventType === "violation").length;
    const entries = events.filter(e => e.eventType === "entry").length;
    const exits = events.filter(e => e.eventType === "exit").length;

    // Events by geofence
    const eventsByGeofence = geofences.map(geofence => {
      const geofenceEvents = events.filter(e => e.geofenceId === geofence._id);
      return {
        geofenceId: geofence._id,
        name: geofence.name,
        type: geofence.type,
        totalEvents: geofenceEvents.length,
        violations: geofenceEvents.filter(e => e.eventType === "violation").length,
        entries: geofenceEvents.filter(e => e.eventType === "entry").length,
        exits: geofenceEvents.filter(e => e.eventType === "exit").length,
      };
    });

    // Events by user
    const userEvents = new Map();
    for (const event of events) {
      const user = await ctx.db.get(event.userId);
      if (user) {
        const existing = userEvents.get(event.userId) || {
          userId: event.userId,
          name: user.name,
          totalEvents: 0,
          violations: 0,
          entries: 0,
          exits: 0,
        };
        
        existing.totalEvents++;
        if (event.eventType === "violation") existing.violations++;
        else if (event.eventType === "entry") existing.entries++;
        else if (event.eventType === "exit") existing.exits++;
        
        userEvents.set(event.userId, existing);
      }
    }

    return {
      summary: {
        totalEvents,
        violations,
        entries,
        exits,
        totalGeofences: geofences.length,
        activeGeofences: geofences.filter(g => g.active).length,
      },
      eventsByGeofence,
      eventsByUser: Array.from(userEvents.values()),
      timeRange,
    };
  },
});
