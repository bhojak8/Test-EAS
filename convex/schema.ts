import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

const applicationTables = {
  sessions: defineTable({
    name: v.string(),
    creatorId: v.id("users"),
    active: v.boolean(),
    createdAt: v.number(),
    shareCode: v.string(),
    groupId: v.optional(v.id("groups")),
    selectedMembers: v.optional(v.array(v.id("users"))),
    alertTypes: v.array(v.object({
      id: v.string(),
      label: v.string(),
      color: v.string(),
      emoji: v.string(),
      category: v.optional(v.string()),
      sound: v.optional(v.string()),
    })),
  }).index("by_share_code", ["shareCode"]),

  participants: defineTable({
    sessionId: v.id("sessions"),
    userId: v.id("users"),
    role: v.string(),
    joinedAt: v.number(),
  })
    .index("by_session", ["sessionId"])
    .index("by_user", ["userId"]),

  locations: defineTable({
    sessionId: v.id("sessions"),
    userId: v.id("users"),
    location: v.object({
      lat: v.number(),
      lng: v.number(),
    }),
    timestamp: v.optional(v.number()),
    accuracy: v.optional(v.number()),
    // Legacy fields for backward compatibility
    lastSeen: v.optional(v.number()),
    updatedAt: v.optional(v.number()),
  })
    .index("by_session", ["sessionId"])
    .index("by_user_session", ["userId", "sessionId"])
    .index("by_timestamp", ["timestamp"]),

  alerts: defineTable({
    sessionId: v.id("sessions"),
    createdBy: v.id("users"),
    type: v.string(),
    message: v.optional(v.string()),
    createdAt: v.number(),
    acknowledged: v.array(v.id("users")),
    location: v.optional(v.object({
      lat: v.number(),
      lng: v.number(),
    })),
    priority: v.optional(v.string()),
  })
    .index("by_session", ["sessionId"])
    .index("by_user", ["createdBy"])
    .index("by_timestamp", ["createdAt"]),

  geofences: defineTable({
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
    active: v.boolean(),
    createdAt: v.number(),
    createdBy: v.id("users"),
    // Enhanced scheduling features
    schedule: v.optional(v.object({
      enabled: v.boolean(),
      startTime: v.string(), // HH:MM format
      endTime: v.string(),   // HH:MM format
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
    // User-specific rules
    userRules: v.optional(v.array(v.object({
      userId: v.id("users"),
      alertOnEntry: v.boolean(),
      alertOnExit: v.boolean(),
      customMessage: v.optional(v.string()),
      priority: v.optional(v.union(v.literal("low"), v.literal("medium"), v.literal("high"), v.literal("critical"))),
    }))),
  })
    .index("by_session", ["sessionId"])
    .index("by_active", ["active"])
    .index("by_created", ["createdAt"]),

  // New table for geofence violations and events
  geofenceEvents: defineTable({
    sessionId: v.id("sessions"),
    geofenceId: v.id("geofences"),
    userId: v.id("users"),
    eventType: v.union(v.literal("entry"), v.literal("exit"), v.literal("violation")),
    timestamp: v.number(),
    location: v.object({
      lat: v.number(),
      lng: v.number(),
    }),
    alertSent: v.boolean(),
    acknowledged: v.boolean(),
    acknowledgedBy: v.optional(v.id("users")),
    acknowledgedAt: v.optional(v.number()),
    metadata: v.optional(v.object({
      duration: v.optional(v.number()), // For exit events, how long they were inside
      distance: v.optional(v.number()), // Distance from geofence boundary
      speed: v.optional(v.number()),    // User's speed at time of event
      accuracy: v.optional(v.number()), // GPS accuracy
    })),
  })
    .index("by_session", ["sessionId"])
    .index("by_geofence", ["geofenceId"])
    .index("by_user", ["userId"])
    .index("by_timestamp", ["timestamp"])
    .index("by_event_type", ["eventType"])
    .index("by_user_geofence", ["userId", "geofenceId"]),

  // Enhanced groups table
  groups: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
    createdBy: v.id("users"),
    createdAt: v.number(),
    settings: v.optional(v.object({
      allowMemberInvites: v.boolean(),
      requireApproval: v.boolean(),
      defaultRole: v.string(),
    })),
  }).index("by_creator", ["createdBy"]),

  groupMembers: defineTable({
    groupId: v.id("groups"),
    userId: v.id("users"),
    role: v.string(),
    joinedAt: v.number(),
    invitedBy: v.optional(v.id("users")),
    status: v.union(v.literal("active"), v.literal("pending"), v.literal("inactive")),
  })
    .index("by_group", ["groupId"])
    .index("by_user", ["userId"])
    .index("by_status", ["status"]),

  messages: defineTable({
    sessionId: v.id("sessions"),
    userId: v.id("users"),
    content: v.string(),
    timestamp: v.number(),
    type: v.union(v.literal("text"), v.literal("system"), v.literal("alert")),
    metadata: v.optional(v.object({
      alertId: v.optional(v.id("alerts")),
      geofenceEventId: v.optional(v.id("geofenceEvents")),
    })),
  })
    .index("by_session", ["sessionId"])
    .index("by_timestamp", ["timestamp"]),

  notifications: defineTable({
    userId: v.id("users"),
    sessionId: v.optional(v.id("sessions")),
    type: v.string(),
    title: v.string(),
    message: v.string(),
    read: v.boolean(),
    createdAt: v.number(),
    data: v.optional(v.object({
      alertId: v.optional(v.id("alerts")),
      geofenceEventId: v.optional(v.id("geofenceEvents")),
      sessionId: v.optional(v.id("sessions")),
    })),
  })
    .index("by_user", ["userId"])
    .index("by_read", ["read"])
    .index("by_timestamp", ["createdAt"]),

  apiKeys: defineTable({
    sessionId: v.id("sessions"),
    name: v.string(),
    key: v.string(),
    permissions: v.array(v.string()),
    createdBy: v.id("users"),
    createdAt: v.number(),
    lastUsed: v.optional(v.number()),
    active: v.boolean(),
  })
    .index("by_session", ["sessionId"])
    .index("by_key", ["key"]),

  webhookEvents: defineTable({
    sessionId: v.id("sessions"),
    apiKeyId: v.id("apiKeys"),
    payload: v.any(),
    timestamp: v.number(),
  })
    .index("by_session", ["sessionId"])
    .index("by_api_key", ["apiKeyId"])
    .index("by_timestamp", ["timestamp"]),
};

export default defineSchema({
  ...authTables,
  ...applicationTables,
});
