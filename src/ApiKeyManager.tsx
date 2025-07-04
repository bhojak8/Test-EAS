import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";
import { toast } from "sonner";

interface ApiKeyManagerProps {
  sessionId: Id<"sessions">;
}

const AVAILABLE_PERMISSIONS = [
  { id: "read:locations", label: "Read Locations", description: "Access team member locations" },
  { id: "read:alerts", label: "Read Alerts", description: "Access session alerts" },
  { id: "read:geofences", label: "Read Geofences", description: "Access geofence definitions" },
  { id: "write:alerts", label: "Send Alerts", description: "Send alerts to the session" },
  { id: "write:locations", label: "Update Locations", description: "Update member locations" },
  { id: "webhook", label: "Webhook Access", description: "Receive webhook events" },
];

export function ApiKeyManager({ sessionId }: ApiKeyManagerProps) {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    permissions: [] as string[],
  });

  const apiKeys = useQuery(api.api.listApiKeys, { sessionId }) || [];
  const generateApiKey = useMutation(api.api.generateApiKey);
  const revokeApiKey = useMutation(api.api.revokeApiKey);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.permissions.length === 0) {
      toast.error("Please select at least one permission");
      return;
    }

    try {
      await generateApiKey({
        sessionId,
        name: formData.name,
        permissions: formData.permissions,
      });
      
      setShowCreateForm(false);
      setFormData({ name: "", permissions: [] });
      toast.success("API key created");
    } catch (error) {
      toast.error("Failed to create API key");
    }
  };

  const handleRevoke = async (apiKeyId: Id<"apiKeys">) => {
    try {
      await revokeApiKey({ apiKeyId });
      toast.success("API key revoked");
    } catch (error) {
      toast.error("Failed to revoke API key");
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  const togglePermission = (permission: string) => {
    setFormData(prev => ({
      ...prev,
      permissions: prev.permissions.includes(permission)
        ? prev.permissions.filter(p => p !== permission)
        : [...prev.permissions, permission]
    }));
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-semibold">API Keys</h3>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          {showCreateForm ? "Cancel" : "Create API Key"}
        </button>
      </div>

      {showCreateForm && (
        <form onSubmit={handleCreate} className="bg-gray-50 p-4 rounded-lg space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              placeholder="e.g., Mobile App Integration"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Permissions</label>
            <div className="space-y-2">
              {AVAILABLE_PERMISSIONS.map((permission) => (
                <label key={permission.id} className="flex items-start">
                  <input
                    type="checkbox"
                    checked={formData.permissions.includes(permission.id)}
                    onChange={() => togglePermission(permission.id)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 mt-1"
                  />
                  <div className="ml-2">
                    <div className="font-medium">{permission.label}</div>
                    <div className="text-sm text-gray-600">{permission.description}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <button
            type="submit"
            className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            Create API Key
          </button>
        </form>
      )}

      <div className="space-y-4">
        {apiKeys.map((apiKey) => (
          <div key={apiKey._id} className="bg-white p-4 rounded-lg border border-gray-200">
            <div className="flex justify-between items-start mb-2">
              <div>
                <h4 className="font-semibold">{apiKey.name}</h4>
                <div className="text-sm text-gray-600">
                  Created {new Date(apiKey.createdAt).toLocaleDateString()}
                  {apiKey.lastUsed && (
                    <span> • Last used {new Date(apiKey.lastUsed).toLocaleDateString()}</span>
                  )}
                </div>
              </div>
              <button
                onClick={() => handleRevoke(apiKey._id)}
                className="text-red-600 hover:text-red-800 text-sm"
              >
                Revoke
              </button>
            </div>
            
            <div className="mb-2">
              <div className="text-sm font-medium text-gray-700">API Key:</div>
              <div className="flex items-center gap-2">
                <code className="bg-gray-100 px-2 py-1 rounded text-sm font-mono">
                  {apiKey.key}
                </code>
                <button
                  onClick={() => copyToClipboard(apiKey.key)}
                  className="text-blue-600 hover:text-blue-800 text-sm"
                >
                  Copy
                </button>
              </div>
            </div>
            
            <div>
              <div className="text-sm font-medium text-gray-700 mb-1">Permissions:</div>
              <div className="flex flex-wrap gap-1">
                {apiKey.permissions.map((permission) => (
                  <span
                    key={permission}
                    className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded"
                  >
                    {permission}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ))}
        
        {apiKeys.length === 0 && (
          <div className="text-gray-500 text-center py-8">
            No API keys created yet
          </div>
        )}
      </div>

      <div className="bg-blue-50 p-4 rounded-lg">
        <h4 className="font-semibold text-blue-900 mb-2">API Documentation</h4>
        <div className="text-sm text-blue-800 space-y-1">
          <div><strong>Base URL:</strong> {window.location.origin}/api</div>
          <div><strong>Authentication:</strong> Include API key in <code>x-api-key</code> header</div>
          <div><strong>Endpoints:</strong></div>
          <ul className="ml-4 space-y-1">
            <li>GET /sessions/{sessionId} - Get session info</li>
            <li>GET /sessions/{sessionId}/locations - Get team locations</li>
            <li>GET /sessions/{sessionId}/alerts - Get session alerts</li>
            <li>GET /sessions/{sessionId}/geofences - Get geofences</li>
            <li>POST /sessions/{sessionId}/alerts - Send alert</li>
            <li>POST /sessions/{sessionId}/locations - Update location</li>
            <li>POST /webhook/{sessionId} - Webhook endpoint</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
