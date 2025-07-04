import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

function generateShareCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

export const createSession = mutation({
  args: {
    name: v.string(),
    groupId: v.optional(v.id("groups")),
    selectedMembers: v.optional(v.array(v.id("users"))),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const shareCode = generateShareCode();
    
    const sessionId = await ctx.db.insert("sessions", {
      name: args.name,
      creatorId: userId,
      active: true,
      createdAt: Date.now(),
      shareCode,
      groupId: args.groupId,
      selectedMembers: args.selectedMembers,
      alertTypes: [
        { id: "emergency", label: "Emergency", color: "bg-red-600", emoji: "🚨", category: "critical" },
        { id: "medical", label: "Medical", color: "bg-red-500", emoji: "🏥", category: "critical" },
        { id: "fire", label: "Fire", color: "bg-orange-600", emoji: "🔥", category: "critical" },
        { id: "help", label: "Need Help", color: "bg-yellow-600", emoji: "🆘", category: "assistance" },
        { id: "safe", label: "I'm Safe", color: "bg-green-600", emoji: "✅", category: "status" },
      ],
    });

    // Add creator as participant
    await ctx.db.insert("participants", {
      sessionId,
      userId,
      role: "Admin",
      joinedAt: Date.now(),
    });

    return sessionId;
  },
});

export const joinByCode = mutation({
  args: {
    shareCode: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const session = await ctx.db
      .query("sessions")
      .withIndex("by_share_code", q => q.eq("shareCode", args.shareCode))
      .first();

    if (!session || !session.active) {
      throw new Error("Session not found or inactive");
    }

    // Check if already a participant
    const existingParticipant = await ctx.db
      .query("participants")
      .withIndex("by_session", q => q.eq("sessionId", session._id))
      .filter(q => q.eq(q.field("userId"), userId))
      .first();

    if (existingParticipant) {
      return session._id;
    }

    // Add as participant
    await ctx.db.insert("participants", {
      sessionId: session._id,
      userId,
      role: "Member",
      joinedAt: Date.now(),
    });

    return session._id;
  },
});

export const listSessions = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    // Get all sessions where user is a participant
    const participants = await ctx.db
      .query("participants")
      .withIndex("by_user", q => q.eq("userId", userId))
      .collect();

    const sessions = await Promise.all(
      participants.map(async (participant) => {
        const session = await ctx.db.get(participant.sessionId);
        if (!session) return null;

        // Count participants
        const participantCount = await ctx.db
          .query("participants")
          .withIndex("by_session", q => q.eq("sessionId", session._id))
          .collect();

        return {
          ...session,
          participantCount: participantCount.length,
          isAdmin: participant.role === "Admin",
        };
      })
    );

    return sessions.filter(Boolean).filter(s => s && s.active);
  },
});

export const updateAlertTypes = mutation({
  args: {
    sessionId: v.id("sessions"),
    alertTypes: v.array(v.object({
      id: v.string(),
      label: v.string(),
      color: v.string(),
      emoji: v.string(),
      category: v.optional(v.string()),
      sound: v.optional(v.string()),
    })),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const session = await ctx.db.get(args.sessionId);
    if (!session || session.creatorId !== userId) {
      throw new Error("Not authorized to update this session");
    }

    await ctx.db.patch(args.sessionId, {
      alertTypes: args.alertTypes,
    });
  },
});
