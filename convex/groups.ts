import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

export const createGroup = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const groupId = await ctx.db.insert("groups", {
      name: args.name,
      description: args.description,
      createdBy: userId,
      createdAt: Date.now(),
      settings: {
        allowMemberInvites: false,
        requireApproval: true,
        defaultRole: "Member",
      },
    });

    // Add creator as admin member
    await ctx.db.insert("groupMembers", {
      groupId,
      userId,
      role: "Admin",
      joinedAt: Date.now(),
      status: "active",
    });

    return groupId;
  },
});

export const searchUsers = query({
  args: {
    query: v.string(),
  },
  handler: async (ctx, args) => {
    const users = await ctx.db
      .query("users")
      .filter(q => 
        q.or(
          q.gt(q.field("name"), args.query),
          q.gt(q.field("email"), args.query)
        )
      )
      .take(10);

    return users.map(user => ({
      _id: user._id,
      name: user.name,
      email: user.email,
    }));
  },
});

export const addMember = mutation({
  args: {
    groupId: v.id("groups"),
    userId: v.id("users"),
    role: v.string(),
  },
  handler: async (ctx, args) => {
    const currentUserId = await getAuthUserId(ctx);
    if (!currentUserId) throw new Error("Not authenticated");

    const group = await ctx.db.get(args.groupId);
    if (!group || group.createdBy !== currentUserId) {
      throw new Error("Unauthorized");
    }

    // Check if user is already a member
    const existingMember = await ctx.db
      .query("groupMembers")
      .withIndex("by_group", q => q.eq("groupId", args.groupId))
      .filter(q => q.eq(q.field("userId"), args.userId))
      .first();

    if (existingMember) {
      throw new Error("User already in group");
    }

    await ctx.db.insert("groupMembers", {
      groupId: args.groupId,
      userId: args.userId,
      role: args.role,
      joinedAt: Date.now(),
      invitedBy: currentUserId,
      status: "active",
    });
  },
});

export const updateMemberRole = mutation({
  args: {
    groupId: v.id("groups"),
    userId: v.id("users"),
    role: v.string(),
  },
  handler: async (ctx, args) => {
    const currentUserId = await getAuthUserId(ctx);
    if (!currentUserId) throw new Error("Not authenticated");

    const group = await ctx.db.get(args.groupId);
    if (!group || group.createdBy !== currentUserId) {
      throw new Error("Unauthorized");
    }

    const member = await ctx.db
      .query("groupMembers")
      .withIndex("by_group", q => q.eq("groupId", args.groupId))
      .filter(q => q.eq(q.field("userId"), args.userId))
      .first();

    if (!member) {
      throw new Error("Member not found");
    }

    await ctx.db.patch(member._id, { role: args.role });
  },
});

export const removeMember = mutation({
  args: {
    groupId: v.id("groups"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const currentUserId = await getAuthUserId(ctx);
    if (!currentUserId) throw new Error("Not authenticated");

    const group = await ctx.db.get(args.groupId);
    if (!group || group.createdBy !== currentUserId) {
      throw new Error("Unauthorized");
    }

    if (args.userId === group.createdBy) {
      throw new Error("Cannot remove group creator");
    }

    const member = await ctx.db
      .query("groupMembers")
      .withIndex("by_group", q => q.eq("groupId", args.groupId))
      .filter(q => q.eq(q.field("userId"), args.userId))
      .first();

    if (member) {
      await ctx.db.delete(member._id);
    }
  },
});

export const listGroups = query({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const memberships = await ctx.db
      .query("groupMembers")
      .withIndex("by_user", q => q.eq("userId", userId))
      .filter(q => q.eq(q.field("status"), "active"))
      .collect();

    return await Promise.all(
      memberships.map(async (membership) => {
        const group = await ctx.db.get(membership.groupId);
        return group ? { ...group, userRole: membership.role } : null;
      })
    ).then(groups => groups.filter(Boolean));
  },
});

export const getGroupMembers = query({
  args: {
    groupId: v.id("groups"),
  },
  handler: async (ctx, args) => {
    const group = await ctx.db.get(args.groupId);
    if (!group) throw new Error("Group not found");

    const memberships = await ctx.db
      .query("groupMembers")
      .withIndex("by_group", q => q.eq("groupId", args.groupId))
      .filter(q => q.eq(q.field("status"), "active"))
      .collect();

    return await Promise.all(
      memberships.map(async (membership) => {
        const user = await ctx.db.get(membership.userId);
        return {
          userId: membership.userId,
          name: user?.name || "Unknown",
          email: user?.email,
          role: membership.role,
          joinedAt: membership.joinedAt,
          isCreator: group.createdBy === membership.userId,
        };
      })
    );
  },
});
