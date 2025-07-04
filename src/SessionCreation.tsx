import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import { Id } from "../convex/_generated/dataModel";

export function SessionCreation() {
  const [name, setName] = useState("");
  const [selectedGroup, setSelectedGroup] = useState<Id<"groups"> | null>(null);
  const [selectedMembers, setSelectedMembers] = useState<Id<"users">[]>([]);
  const [selectedSession, setSelectedSession] = useState<Id<"sessions"> | null>(null);

  const groups = useQuery(api.groups.listGroups) || [];
  const groupMembers = useQuery(
    api.groups.getGroupMembers,
    selectedGroup ? { groupId: selectedGroup } : "skip"
  ) || [];
  
  const createSession = useMutation(api.sessions.createSession);
  const sessions = useQuery(api.sessions.listSessions) || [];

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const sessionId = await createSession({
        name,
        groupId: selectedGroup || undefined,
        selectedMembers: selectedMembers.length > 0 ? selectedMembers : undefined,
      });
      
      setSelectedSession(sessionId);
      setName("");
      setSelectedGroup(null);
      setSelectedMembers([]);
      toast.success("Session created");
    } catch (error) {
      toast.error("Failed to create session");
    }
  };

  const selectedSessionData = selectedSession ? 
    sessions.find(s => s && s._id === selectedSession) : null;

  const handleCopyCode = () => {
    if (selectedSessionData?.shareCode) {
      navigator.clipboard.writeText(selectedSessionData.shareCode);
      toast.success("Share code copied to clipboard");
    }
  };

  const handleCopyUrl = () => {
    if (selectedSessionData?.shareCode) {
      const url = `${window.location.origin}?join=${selectedSessionData.shareCode}`;
      navigator.clipboard.writeText(url);
      toast.success("Share URL copied to clipboard");
    }
  };

  return (
    <div className="space-y-6">
      <form onSubmit={handleCreate} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Session Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">
            Select Group (Optional)
          </label>
          <select
            value={selectedGroup || ""}
            onChange={(e) => {
              const groupId = e.target.value as Id<"groups"> | "";
              setSelectedGroup(groupId || null);
              setSelectedMembers([]);
            }}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          >
            <option value="">No group</option>
            {groups.map((group) => group && (
              <option key={group._id} value={group._id}>
                {group.name}
              </option>
            ))}
          </select>
        </div>

        {selectedGroup && (
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Select Members
            </label>
            <div className="mt-2 space-y-2">
              <button
                type="button"
                onClick={() => setSelectedMembers(groupMembers.map(m => m.userId))}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                Select All
              </button>
              {groupMembers.map((member) => (
                <label key={member.userId} className="flex items-center">
                  <input
                    type="checkbox"
                    checked={selectedMembers.includes(member.userId)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedMembers([...selectedMembers, member.userId]);
                      } else {
                        setSelectedMembers(
                          selectedMembers.filter((id) => id !== member.userId)
                        );
                      }
                    }}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="ml-2">
                    {member.name} ({member.role})
                  </span>
                </label>
              ))}
            </div>
          </div>
        )}

        <button
          type="submit"
          className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Create Session
        </button>
      </form>

      {selectedSession && selectedSessionData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full">
            <h3 className="text-lg font-semibold mb-4">Share Session: {selectedSessionData.name}</h3>
            <div className="flex justify-center mb-4">
              <QRCodeSVG 
                value={`${window.location.origin}?join=${selectedSessionData.shareCode}`} 
                size={200} 
                level="M"
                includeMargin={true}
              />
            </div>
            <div className="space-y-4">
              <div className="text-center">
                <p className="text-sm text-gray-600">Share Code:</p>
                <div className="flex items-center justify-center gap-2">
                  <p className="text-lg font-mono bg-gray-100 px-4 py-2 rounded">
                    {selectedSessionData.shareCode}
                  </p>
                  <button
                    onClick={handleCopyCode}
                    className="p-2 text-blue-600 hover:text-blue-800"
                    title="Copy share code"
                  >
                    📋
                  </button>
                </div>
              </div>
              <div className="text-center">
                <p className="text-sm text-gray-600">Share URL:</p>
                <div className="flex items-center justify-center gap-2">
                  <p className="text-sm font-mono bg-gray-100 px-4 py-2 rounded truncate max-w-xs">
                    {`${window.location.origin}?join=${selectedSessionData.shareCode}`}
                  </p>
                  <button
                    onClick={handleCopyUrl}
                    className="p-2 text-blue-600 hover:text-blue-800"
                    title="Copy share URL"
                  >
                    📋
                  </button>
                </div>
              </div>
            </div>
            <button
              onClick={() => setSelectedSession(null)}
              className="mt-4 w-full px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
