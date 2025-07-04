import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";
import { toast } from "sonner";
import { EmergencyMap } from "./EmergencyMap";
import { AlertTypeModal } from "./AlertTypeModal";
import { AlertButton } from "./AlertButton";
import { GroupManagement } from "./GroupManagement";
import { SessionCreation } from "./SessionCreation";
import { ApiKeyManager } from "./ApiKeyManager";
import { NotificationCenter } from "./NotificationCenter";
import { AnalyticsDashboard } from "./AnalyticsDashboard";
import { SessionChat } from "./SessionChat";
import { GeofenceManager } from "./GeofenceManager";

export function EmergencyDashboard({ user }: { user: any }) {
  const [selectedSession, setSelectedSession] = useState<Id<"sessions"> | null>(null);
  const [showAlertModal, setShowAlertModal] = useState(false);
  const [view, setView] = useState<"sessions" | "groups">("sessions");
  const [sessionTab, setSessionTab] = useState<"overview" | "geofences" | "api" | "analytics">("overview");
  
  const sessions = useQuery(api.sessions.listSessions) || [];
  const alerts = useQuery(api.alerts.getSessionAlerts, 
    selectedSession ? { sessionId: selectedSession } : "skip"
  ) || [];
  
  const joinByCode = useMutation(api.sessions.joinByCode);
  const sendAlert = useMutation(api.alerts.sendAlert);
  const acknowledgeAlert = useMutation(api.alerts.acknowledgeAlert);

  const handleJoinByCode = async () => {
    const code = prompt("Enter session code:");
    if (!code) return;
    
    try {
      const sessionId = await joinByCode({ shareCode: code });
      setSelectedSession(sessionId);
      toast.success("Joined session");
    } catch (error) {
      toast.error("Failed to join session");
    }
  };

  const handleSendAlert = async (type: string) => {
    if (!selectedSession) return;
    
    const message = prompt("Enter alert message (optional):");
    try {
      await sendAlert({
        sessionId: selectedSession,
        type,
        message: message || undefined,
      });
      toast.success("Alert sent");
      
      // Play alert sound
      try {
        const audio = new Audio("/alert.mp3");
        audio.play().catch(console.error);
      } catch (error) {
        console.error("Failed to play alert sound:", error);
      }
      
      // Vibrate if supported
      if (navigator.vibrate) {
        navigator.vibrate([200, 100, 200]);
      }
    } catch (error) {
      toast.error("Failed to send alert");
    }
  };

  const handleAcknowledge = async (alertId: Id<"alerts">) => {
    try {
      await acknowledgeAlert({ alertId });
      toast.success("Alert acknowledged");
    } catch (error) {
      toast.error("Failed to acknowledge alert");
    }
  };

  const selectedSessionData = selectedSession ? 
    sessions.find(s => s && s._id === selectedSession) : null;

  const alertTypes = selectedSessionData?.alertTypes || [];
  const activeAlerts = alerts.filter(a => Date.now() - a.createdAt < 300000); // 5 minutes

  return (
    <div className="space-y-8">
      {/* Header with Notification Center */}
      <div className="flex justify-between items-center">
        <div className="flex gap-4">
          <button
            onClick={() => setView("sessions")}
            className={`px-4 py-2 rounded-lg ${
              view === "sessions"
                ? "bg-blue-600 text-white"
                : "bg-gray-200 hover:bg-gray-300"
            }`}
          >
            Sessions
          </button>
          <button
            onClick={() => setView("groups")}
            className={`px-4 py-2 rounded-lg ${
              view === "groups"
                ? "bg-blue-600 text-white"
                : "bg-gray-200 hover:bg-gray-300"
            }`}
          >
            Groups
          </button>
        </div>
        
        {selectedSession && (
          <NotificationCenter sessionId={selectedSession} userId={user._id} />
        )}
      </div>

      {/* Active Alerts Banner */}
      {activeAlerts.length > 0 && (
        <div className="bg-red-100 border-l-4 border-red-500 p-4 rounded">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-700">
                <strong>🚨 {activeAlerts.length} Active Alert{activeAlerts.length > 1 ? 's' : ''}</strong>
                {activeAlerts.length === 1 && ` - ${activeAlerts[0].message || 'Emergency alert'}`}
              </p>
            </div>
          </div>
        </div>
      )}

      {view === "groups" ? (
        <GroupManagement />
      ) : (
        <div className="space-y-6">
          <SessionCreation />
          
          <button
            onClick={handleJoinByCode}
            className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            Join by Code
          </button>

          {sessions.length > 0 && (
            <div className="bg-gray-100 rounded-lg p-4">
              <h3 className="text-xl font-semibold mb-4">Available Sessions</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {sessions.map((session) => {
                  if (!session) return null;
                  const sessionAlerts = alerts.filter(a => 
                    a.sessionId === session._id && Date.now() - a.createdAt < 300000
                  );
                  
                  return (
                    <button
                      key={session._id}
                      onClick={() => setSelectedSession(session._id)}
                      className={`p-4 rounded-lg text-left relative ${
                        session._id === selectedSession
                          ? "bg-blue-600 text-white"
                          : "bg-white hover:bg-gray-50"
                      }`}
                    >
                      {sessionAlerts.length > 0 && (
                        <div className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full h-6 w-6 flex items-center justify-center">
                          {sessionAlerts.length}
                        </div>
                      )}
                      <div className="font-semibold">{session.name}</div>
                      <div className="text-sm opacity-80">
                        Created {new Date(session.createdAt).toLocaleDateString()}
                      </div>
                      <div className="text-xs opacity-60">
                        {session.participantCount} participants
                      </div>
                      <div className="text-xs opacity-60">
                        Code: {session.shareCode}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {selectedSession && selectedSessionData && (
            <div className="space-y-6">
              {/* Session Tabs */}
              <div className="flex gap-2 border-b overflow-x-auto">
                <button
                  onClick={() => setSessionTab("overview")}
                  className={`px-4 py-2 border-b-2 whitespace-nowrap ${
                    sessionTab === "overview"
                      ? "border-blue-600 text-blue-600"
                      : "border-transparent hover:text-blue-600"
                  }`}
                >
                  📍 Overview
                </button>
                <button
                  onClick={() => setSessionTab("geofences")}
                  className={`px-4 py-2 border-b-2 whitespace-nowrap ${
                    sessionTab === "geofences"
                      ? "border-blue-600 text-blue-600"
                      : "border-transparent hover:text-blue-600"
                  }`}
                >
                  🗺️ Geofences
                </button>
                {selectedSessionData.isAdmin && (
                  <>
                    <button
                      onClick={() => setSessionTab("analytics")}
                      className={`px-4 py-2 border-b-2 whitespace-nowrap ${
                        sessionTab === "analytics"
                          ? "border-blue-600 text-blue-600"
                          : "border-transparent hover:text-blue-600"
                      }`}
                    >
                      📊 Analytics
                    </button>
                    <button
                      onClick={() => setSessionTab("api")}
                      className={`px-4 py-2 border-b-2 whitespace-nowrap ${
                        sessionTab === "api"
                          ? "border-blue-600 text-blue-600"
                          : "border-transparent hover:text-blue-600"
                      }`}
                    >
                      🔑 API Keys
                    </button>
                  </>
                )}
              </div>

              {sessionTab === "overview" && (
                <>
                  <AlertButton onClick={() => setShowAlertModal(true)} />
                  
                  <EmergencyMap sessionId={selectedSession} />

                  <div className="bg-gray-100 rounded-lg p-4">
                    <h3 className="text-xl font-semibold mb-4">Recent Alerts</h3>
                    <div className="space-y-2">
                      {alerts.slice(0, 10).map((alert) => {
                        const alertType = alertTypes.find(t => t.id === alert.type);
                        const isRecent = Date.now() - alert.createdAt < 300000;
                        
                        return (
                          <div
                            key={alert._id}
                            className={`bg-white p-4 rounded shadow-sm border-l-4 ${
                              isRecent ? 'border-red-600 bg-red-50' : 
                              alertType?.color.replace('bg-', 'border-') || 'border-gray-300'
                            }`}
                          >
                            <div className="font-semibold">
                              {alertType?.emoji} {alertType?.label}
                              {isRecent && <span className="ml-2 text-red-600 text-sm">🔴 ACTIVE</span>}
                            </div>
                            {alert.message && (
                              <div className="text-gray-600 mt-1">{alert.message}</div>
                            )}
                            <div className="flex justify-between items-center mt-2">
                              <div className="text-sm text-gray-500">
                                {new Date(alert.createdAt).toLocaleString()}
                              </div>
                              <div className="flex gap-2">
                                <span className="text-xs text-gray-500">
                                  {alert.acknowledged.length} acknowledged
                                </span>
                                <button
                                  onClick={() => handleAcknowledge(alert._id)}
                                  className={`px-3 py-1 rounded text-sm ${
                                    alert.acknowledged.includes(user._id)
                                      ? "bg-gray-100 text-gray-500"
                                      : "bg-green-100 text-green-700 hover:bg-green-200"
                                  }`}
                                  disabled={alert.acknowledged.includes(user._id)}
                                >
                                  {alert.acknowledged.includes(user._id) ? "✓ Acknowledged" : "Acknowledge"}
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      {alerts.length === 0 && (
                        <div className="text-gray-500 text-center py-4">
                          No alerts yet
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}

              {sessionTab === "geofences" && (
                <GeofenceManager sessionId={selectedSession} />
              )}

              {sessionTab === "analytics" && selectedSessionData.isAdmin && (
                <AnalyticsDashboard sessionId={selectedSession} />
              )}

              {sessionTab === "api" && selectedSessionData.isAdmin && (
                <ApiKeyManager sessionId={selectedSession} />
              )}
            </div>
          )}

          {showAlertModal && selectedSessionData && selectedSession && (
            <AlertTypeModal
              alertTypes={alertTypes}
              onSelect={type => {
                setShowAlertModal(false);
                handleSendAlert(type);
              }}
              onClose={() => setShowAlertModal(false)}
              isCreator={selectedSessionData.creatorId === user._id}
              sessionId={selectedSession}
            />
          )}

          {/* Chat Component */}
          {selectedSession && (
            <SessionChat sessionId={selectedSession} user={user} />
          )}
        </div>
      )}
    </div>
  );
}