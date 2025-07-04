import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

export const sendMessage = mutation({
  args: {
    sessionId: v.id("sessions"),
    content: v.string(),
    type: v.optional(v.union(v.literal("text"), v.literal("system"), v.literal("alert"))),
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
      throw new Error("Not a participant in this session");
    }

    return await ctx.db.insert("messages", {
      sessionId: args.sessionId,
      userId,
      content: args.content,
      type: args.type || "text",
      timestamp: Date.now(),
    });
  },
});

export const getSessionMessages = query({
  args: {
    sessionId: v.id("sessions"),
    limit: v.optional(v.number()),
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
      throw new Error("Not a participant in this session");
    }

    const messages = await ctx.db
      .query("messages")
      .withIndex("by_session", q => q.eq("sessionId", args.sessionId))
      .order("desc")
      .take(args.limit || 50);

    // Get user info for each message
    const messagesWithUsers = await Promise.all(
      messages.map(async (message) => {
        const user = await ctx.db.get(message.userId);
        return {
          ...message,
          userName: user?.name || "Unknown User",
        };
      })
    );

    return messagesWithUsers.reverse(); // Return in chronological order
  },
});
