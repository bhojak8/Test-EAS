import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";
import { toast } from "sonner";

interface NotificationCenterProps {
  sessionId: Id<"sessions">;
  userId: Id<"users">;
}

export function NotificationCenter({ sessionId, userId }: NotificationCenterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [vibrationEnabled, setVibrationEnabled] = useState(true);
  
  const alerts = useQuery(api.alerts.getSessionAlerts, { sessionId }) || [];
  const markAsRead = useMutation(api.notifications.markAsRead);
  const notifications = useQuery(api.notifications.getUserNotifications, { userId }) || [];
  
  const unreadCount = notifications.filter(n => !n.read).length;
  const recentAlerts = alerts.filter(a => Date.now() - a.createdAt < 300000); // 5 minutes

  useEffect(() => {
    if ('Notification' in window) {
      setNotificationPermission(Notification.permission);
    }
  }, []);

  useEffect(() => {
    // Play sound and vibrate for new alerts
    if (recentAlerts.length > 0 && soundEnabled) {
      const audio = new Audio("https://www.soundjay.com/misc/sounds/fail-buzzer-02.wav");
      audio.play().catch(console.error);
    }

    if (recentAlerts.length > 0 && vibrationEnabled && navigator.vibrate) {
      navigator.vibrate([200, 100, 200, 100, 200]);
    }

    // Show browser notification
    if (recentAlerts.length > 0 && notificationPermission === 'granted') {
      const latestAlert = recentAlerts[0];
      new Notification('Emergency Alert', {
        body: latestAlert.message || 'New emergency alert',
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        tag: 'emergency-alert',
        requireInteraction: true,
      });
    }
  }, [recentAlerts.length, soundEnabled, vibrationEnabled, notificationPermission]);

  const requestNotificationPermission = async () => {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
      if (permission === 'granted') {
        toast.success("Notifications enabled");
      }
    }
  };

  const handleMarkAsRead = async (notificationId: Id<"notifications">) => {
    try {
      await markAsRead({ notificationId });
    } catch (error) {
      toast.error("Failed to mark as read");
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-600 hover:text-gray-900 focus:outline-none"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-5 5v-5zM4 19h10a2 2 0 002-2V7a2 2 0 00-2-2H4a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border z-50">
          <div className="p-4 border-b">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold">Notifications</h3>
              <button
                onClick={() => setIsOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
            
            {/* Notification Settings */}
            <div className="mt-3 space-y-2">
              {notificationPermission !== 'granted' && (
                <button
                  onClick={requestNotificationPermission}
                  className="w-full px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                >
                  Enable Browser Notifications
                </button>
              )}
              
              <div className="flex gap-4 text-sm">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={soundEnabled}
                    onChange={(e) => setSoundEnabled(e.target.checked)}
                    className="mr-1"
                  />
                  Sound
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={vibrationEnabled}
                    onChange={(e) => setVibrationEnabled(e.target.checked)}
                    className="mr-1"
                  />
                  Vibration
                </label>
              </div>
            </div>
          </div>

          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-4 text-center text-gray-500">
                No notifications
              </div>
            ) : (
              notifications.map((notification) => (
                <div
                  key={notification._id}
                  className={`p-3 border-b hover:bg-gray-50 ${
                    !notification.read ? 'bg-blue-50' : ''
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="font-medium text-sm">{notification.title}</div>
                      <div className="text-sm text-gray-600 mt-1">
                        {notification.message}
                      </div>
                      <div className="text-xs text-gray-400 mt-1">
                        {new Date(notification.createdAt).toLocaleString()}
                      </div>
                    </div>
                    {!notification.read && (
                      <button
                        onClick={() => handleMarkAsRead(notification._id)}
                        className="text-blue-600 hover:text-blue-800 text-xs ml-2"
                      >
                        Mark Read
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Recent Alerts */}
          {recentAlerts.length > 0 && (
            <div className="p-3 bg-red-50 border-t">
              <div className="text-sm font-medium text-red-800 mb-2">
                🚨 Active Alerts ({recentAlerts.length})
              </div>
              {recentAlerts.slice(0, 3).map((alert) => (
                <div key={alert._id} className="text-xs text-red-700 mb-1">
                  {alert.message || 'Emergency alert'} - {new Date(alert.createdAt).toLocaleTimeString()}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
