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
      toast.success("Joined session successfully!");
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
      toast.success("🚨 Emergency alert sent!");
      
      // Play alert sound
      try {
        const audio = new Audio("/alert.mp3");
        audio.volume = 0.7;
        audio.play().catch(console.error);
      } catch (error) {
        console.error("Failed to play alert sound:", error);
      }
      
      // Vibrate if supported
      if (navigator.vibrate) {
        navigator.vibrate([200, 100, 200, 100, 200]);
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
      {/* Enhanced Header */}
      <div className="flex justify-between items-center">
        <div className="flex gap-4">
          <button
            onClick={() => setView("sessions")}
            className={`px-6 py-3 rounded-xl font-medium transition-all duration-200 ${
              view === "sessions"
                ? "bg-blue-600 text-white shadow-lg transform scale-105"
                : "bg-gray-200 hover:bg-gray-300 text-gray-700"
            }`}
          >
            🚨 Emergency Sessions
          </button>
          <button
            onClick={() => setView("groups")}
            className={`px-6 py-3 rounded-xl font-medium transition-all duration-200 ${
              view === "groups"
                ? "bg-blue-600 text-white shadow-lg transform scale-105"
                : "bg-gray-200 hover:bg-gray-300 text-gray-700"
            }`}
          >
            👥 Team Groups
          </button>
        </div>
        
        {selectedSession && (
          <NotificationCenter sessionId={selectedSession} userId={user._id} />
        )}
      </div>

      {/* Enhanced Active Alerts Banner */}
      {activeAlerts.length > 0 && (
        <div className="bg-gradient-to-r from-red-500 to-red-600 text-white p-6 rounded-xl shadow-lg emergency-pulse">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="text-3xl animate-bounce">🚨</div>
              <div>
                <h3 className="text-xl font-bold">
                  {activeAlerts.length} ACTIVE EMERGENCY ALERT{activeAlerts.length > 1 ? 'S' : ''}
                </h3>
                <p className="text-red-100">
                  {activeAlerts.length === 1 
                    ? activeAlerts[0].message || 'Emergency situation detected'
                    : 'Multiple emergency situations detected'
                  }
                </p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm text-red-200">Last Alert</div>
              <div className="font-medium">
                {new Date(Math.max(...activeAlerts.map(a => a.createdAt))).toLocaleTimeString()}
              </div>
            </div>
          </div>
        </div>
      )}

      {view === "groups" ? (
        <GroupManagement />
      ) : (
        <div className="space-y-8">
          <SessionCreation />
          
          <button
            onClick={handleJoinByCode}
            className="w-full px-6 py-4 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl hover:from-green-600 hover:to-green-700 font-medium text-lg shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105"
          >
            🔗 Join Emergency Session by Code
          </button>

          {sessions.length > 0 && (
            <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-6 shadow-lg">
              <h3 className="text-2xl font-bold text-gray-800 mb-6">🚨 Available Emergency Sessions</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {sessions.map((session) => {
                  if (!session) return null;
                  const sessionAlerts = alerts.filter(a => 
                    a.sessionId === session._id && Date.now() - a.createdAt < 300000
                  );
                  
                  return (
                    <button
                      key={session._id}
                      onClick={() => setSelectedSession(session._id)}
                      className={`p-6 rounded-xl text-left relative transition-all duration-200 transform hover:scale-105 ${
                        session._id === selectedSession
                          ? "bg-blue-600 text-white shadow-xl"
                          : "bg-white hover:bg-gray-50 shadow-lg hover:shadow-xl"
                      }`}
                    >
                      {sessionAlerts.length > 0 && (
                        <div className="absolute -top-3 -right-3 bg-red-500 text-white text-sm rounded-full h-8 w-8 flex items-center justify-center font-bold emergency-pulse">
                          {sessionAlerts.length}
                        </div>
                      )}
                      <div className="font-bold text-lg mb-2">{session.name}</div>
                      <div className="text-sm opacity-80 mb-1">
                        📅 Created {new Date(session.createdAt).toLocaleDateString()}
                      </div>
                      <div className="text-sm opacity-70 mb-1">
                        👥 {session.participantCount} participants
                      </div>
                      <div className="text-sm opacity-70 font-mono">
                        🔑 {session.shareCode}
                      </div>
                      {sessionAlerts.length > 0 && (
                        <div className="mt-3 text-sm bg-red-500/20 text-red-200 px-3 py-1 rounded-full">
                          🚨 {sessionAlerts.length} active alert{sessionAlerts.length > 1 ? 's' : ''}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {selectedSession && selectedSessionData && (
            <div className="space-y-6">
              {/* Enhanced Session Tabs */}
              <div className="flex gap-2 border-b overflow-x-auto bg-white rounded-t-xl p-2">
                <button
                  onClick={() => setSessionTab("overview")}
                  className={`px-6 py-3 border-b-2 whitespace-nowrap font-medium transition-all duration-200 ${
                    sessionTab === "overview"
                      ? "border-blue-600 text-blue-600 bg-blue-50 rounded-t-lg"
                      : "border-transparent hover:text-blue-600 hover:bg-gray-50 rounded-lg"
                  }`}
                >
                  📍 Overview & Map
                </button>
                <button
                  onClick={() => setSessionTab("geofences")}
                  className={`px-6 py-3 border-b-2 whitespace-nowrap font-medium transition-all duration-200 ${
                    sessionTab === "geofences"
                      ? "border-green-600 text-green-600 bg-green-50 rounded-t-lg"
                      : "border-transparent hover:text-green-600 hover:bg-gray-50 rounded-lg"
                  }`}
                >
                  🗺️ Geofencing
                </button>
                {selectedSessionData.isAdmin && (
                  <>
                    <button
                      onClick={() => setSessionTab("analytics")}
                      className={`px-6 py-3 border-b-2 whitespace-nowrap font-medium transition-all duration-200 ${
                        sessionTab === "analytics"
                          ? "border-purple-600 text-purple-600 bg-purple-50 rounded-t-lg"
                          : "border-transparent hover:text-purple-600 hover:bg-gray-50 rounded-lg"
                      }`}
                    >
                      📊 Analytics
                    </button>
                    <button
                      onClick={() => setSessionTab("api")}
                      className={`px-6 py-3 border-b-2 whitespace-nowrap font-medium transition-all duration-200 ${
                        sessionTab === "api"
                          ? "border-orange-600 text-orange-600 bg-orange-50 rounded-t-lg"
                          : "border-transparent hover:text-orange-600 hover:bg-gray-50 rounded-lg"
                      }`}
                    >
                      🔑 API Keys
                    </button>
                  </>
                )}
              </div>

              {sessionTab === "overview" && (
                <div className="space-y-8">
                  {/* Enhanced Alert Button */}
                  <div className="text-center bg-gradient-to-br from-red-50 to-orange-50 rounded-xl p-8">
                    <AlertButton onClick={() => setShowAlertModal(true)} />
                    <p className="mt-4 text-gray-600 font-medium">
                      🚨 Tap the emergency button to send an alert to all team members
                    </p>
                  </div>
                  
                  {/* Enhanced Map */}
                  <EmergencyMap sessionId={selectedSession} />

                  {/* Enhanced Recent Alerts */}
                  <div className="bg-white rounded-xl p-6 shadow-lg">
                    <h3 className="text-2xl font-bold text-gray-800 mb-6">📋 Recent Emergency Alerts</h3>
                    <div className="space-y-4">
                      {alerts.slice(0, 10).map((alert) => {
                        const alertType = alertTypes.find(t => t.id === alert.type);
                        const isRecent = Date.now() - alert.createdAt < 300000;
                        
                        return (
                          <div
                            key={alert._id}
                            className={`p-6 rounded-xl shadow-sm border-l-4 transition-all duration-200 hover:shadow-md ${
                              isRecent 
                                ? 'border-red-600 bg-red-50 emergency-pulse' 
                                : alertType?.color.replace('bg-', 'border-') + ' bg-white' || 'border-gray-300 bg-white'
                            }`}
                          >
                            <div className="flex justify-between items-start">
                              <div className="flex-1">
                                <div className="font-bold text-lg mb-2">
                                  {alertType?.emoji} {alertType?.label}
                                  {isRecent && (
                                    <span className="ml-3 text-red-600 text-sm font-medium bg-red-100 px-3 py-1 rounded-full">
                                      🔴 ACTIVE
                                    </span>
                                  )}
                                </div>
                                {alert.message && (
                                  <div className="text-gray-700 mb-3 text-lg">{alert.message}</div>
                                )}
                                <div className="text-sm text-gray-500">
                                  📅 {new Date(alert.createdAt).toLocaleString()}
                                </div>
                              </div>
                              
                              <div className="flex flex-col items-end space-y-2">
                                <span className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
                                  ✅ {alert.acknowledged.length} acknowledged
                                </span>
                                <button
                                  onClick={() => handleAcknowledge(alert._id)}
                                  className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                                    alert.acknowledged.includes(user._id)
                                      ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                                      : "bg-green-600 text-white hover:bg-green-700 shadow-md hover:shadow-lg transform hover:scale-105"
                                  }`}
                                  disabled={alert.acknowledged.includes(user._id)}
                                >
                                  {alert.acknowledged.includes(user._id) ? "✓ Acknowledged" : "👍 Acknowledge"}
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      {alerts.length === 0 && (
                        <div className="text-center text-gray-500 py-12">
                          <div className="text-6xl mb-4">🕊️</div>
                          <p className="text-xl">No emergency alerts yet</p>
                          <p className="text-gray-400">All clear - no emergencies reported</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {sessionTab === "geofences" && (
                <div className="bg-white rounded-xl shadow-lg">
                  <GeofenceManager sessionId={selectedSession} />
                </div>
              )}

              {sessionTab === "analytics" && selectedSessionData.isAdmin && (
                <div className="bg-white rounded-xl shadow-lg">
                  <AnalyticsDashboard sessionId={selectedSession} />
                </div>
              )}

              {sessionTab === "api" && selectedSessionData.isAdmin && (
                <div className="bg-white rounded-xl shadow-lg">
                  <ApiKeyManager sessionId={selectedSession} />
                </div>
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

          {/* Enhanced Chat Component */}
          {selectedSession && (
            <SessionChat sessionId={selectedSession} user={user} />
          )}
        </div>
      )}
    </div>
  );
}