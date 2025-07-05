import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import { StorageAPI } from "./lib/storage";

export function SessionCreation({ user, onSessionCreated }: { user: any; onSessionCreated: () => void }) {
  const [name, setName] = useState("");
  const [selectedSession, setSelectedSession] = useState<any>(null);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const session = StorageAPI.createSession(name, user._id);
      setSelectedSession(session);
      setName("");
      onSessionCreated();
      toast.success("Session created");
    } catch (error) {
      toast.error("Failed to create session");
    }
  };

  const handleCopyCode = () => {
    if (selectedSession?.shareCode) {
      navigator.clipboard.writeText(selectedSession.shareCode);
      toast.success("Share code copied to clipboard");
    }
  };

  const handleCopyUrl = () => {
    if (selectedSession?.shareCode) {
      const url = `${window.location.origin}?join=${selectedSession.shareCode}`;
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
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-3 py-2 border"
            required
          />
        </div>

        <button
          type="submit"
          className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Create Session
        </button>
      </form>

      {selectedSession && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full">
            <h3 className="text-lg font-semibold mb-4">Share Session: {selectedSession.name}</h3>
            <div className="flex justify-center mb-4">
              <QRCodeSVG 
                value={`${window.location.origin}?join=${selectedSession.shareCode}`} 
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
                    {selectedSession.shareCode}
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
                    {`${window.location.origin}?join=${selectedSession.shareCode}`}
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