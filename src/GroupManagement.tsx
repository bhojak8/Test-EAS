import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { toast } from "sonner";
import { Id } from "../convex/_generated/dataModel";

export function GroupManagement() {
  const groups = useQuery(api.groups.listGroups) || [];
  const createGroup = useMutation(api.groups.createGroup);
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createGroup({ name: newGroupName });
      setNewGroupName("");
      setShowNewGroup(false);
      toast.success("Group created");
    } catch (error) {
      toast.error("Failed to create group");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Groups</h2>
        <button
          onClick={() => setShowNewGroup(!showNewGroup)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          {showNewGroup ? "Cancel" : "New Group"}
        </button>
      </div>

      {showNewGroup && (
        <form onSubmit={handleCreateGroup} className="space-y-4">
          <input
            type="text"
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
            placeholder="Group name"
            className="w-full p-2 border rounded"
          />
          <button
            type="submit"
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
          >
            Create Group
          </button>
        </form>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {groups.map((group) => group && (
          <GroupCard key={group._id} group={group} />
        ))}
      </div>
    </div>
  );
}

function GroupCard({ group }: { group: any }) {
  const members = useQuery(api.groups.getGroupMembers, { groupId: group._id }) || [];
  const searchUsers = useQuery(api.groups.searchUsers, { query: "" }) || [];
  const addMember = useMutation(api.groups.addMember);
  const updateRole = useMutation(api.groups.updateMemberRole);
  const removeMember = useMutation(api.groups.removeMember);
  
  const [showMembers, setShowMembers] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRole, setSelectedRole] = useState("member");

  const handleAddMember = async (userId: Id<"users">) => {
    try {
      await addMember({
        groupId: group._id,
        userId,
        role: selectedRole,
      });
      setShowAddMember(false);
      toast.success("Member added");
    } catch (error) {
      toast.error("Failed to add member");
    }
  };

  const handleUpdateRole = async (userId: Id<"users">, newRole: string) => {
    try {
      await updateRole({
        groupId: group._id,
        userId,
        role: newRole,
      });
      toast.success("Role updated");
    } catch (error) {
      toast.error("Failed to update role");
    }
  };

  const handleRemoveMember = async (userId: Id<"users">) => {
    try {
      await removeMember({
        groupId: group._id,
        userId,
      });
      toast.success("Member removed");
    } catch (error) {
      toast.error("Failed to remove member");
    }
  };

  return (
    <div className="p-4 bg-white rounded-lg shadow">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl font-semibold">{group.name}</h3>
        <div className="flex gap-2">
          <button
            onClick={() => setShowAddMember(!showAddMember)}
            className="text-blue-600 hover:text-blue-800"
          >
            Add Member
          </button>
          <button
            onClick={() => setShowMembers(!showMembers)}
            className="text-blue-600 hover:text-blue-800"
          >
            {showMembers ? "Hide Members" : "Show Members"}
          </button>
        </div>
      </div>

      {showAddMember && (
        <div className="mb-4 p-4 bg-gray-50 rounded">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search users..."
            className="w-full p-2 border rounded mb-2"
          />
          <select
            value={selectedRole}
            onChange={(e) => setSelectedRole(e.target.value)}
            className="w-full p-2 border rounded mb-2"
          >
            <option value="member">Member</option>
            <option value="admin">Admin</option>
            <option value="moderator">Moderator</option>
          </select>
          <div className="max-h-40 overflow-y-auto">
            {searchUsers.map((user) => (
              <button
                key={user._id}
                onClick={() => handleAddMember(user._id)}
                className="w-full p-2 text-left hover:bg-gray-100 rounded"
              >
                <div>{user.name}</div>
                <div className="text-sm text-gray-600">{user.email}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {showMembers && (
        <div className="space-y-2">
          {members.map((member) => (
            <div
              key={member.userId}
              className="flex items-center justify-between p-2 bg-gray-50 rounded"
            >
              <div>
                <div>{member.name}</div>
                <div className="text-sm text-gray-600">{member.email}</div>
              </div>
              <div className="flex items-center gap-2">
                {!member.isCreator && (
                  <>
                    <select
                      value={member.role}
                      onChange={(e) => handleUpdateRole(member.userId, e.target.value)}
                      className="p-1 text-sm border rounded"
                    >
                      <option value="member">Member</option>
                      <option value="admin">Admin</option>
                      <option value="moderator">Moderator</option>
                    </select>
                    <button
                      onClick={() => handleRemoveMember(member.userId)}
                      className="text-red-600 hover:text-red-800"
                    >
                      Remove
                    </button>
                  </>
                )}
                {member.isCreator && (
                  <span className="text-sm text-gray-600">Creator</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
