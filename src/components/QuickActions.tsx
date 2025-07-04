import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { toast } from "sonner";

interface QuickActionsProps {
  sessionId: Id<"sessions">;
  onEmergencyAlert: () => void;
}

export function QuickActions({ sessionId, onEmergencyAlert }: QuickActionsProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const sendAlert = useMutation(api.alerts.sendAlert);

  const quickAlerts = [
    { id: "help", label: "Need Help", emoji: "🆘", color: "bg-yellow-600", type: "help" },
    { id: "medical", label: "Medical Emergency", emoji: "🏥", color: "bg-red-600", type: "medical" },
    { id: "fire", label: "Fire Emergency", emoji: "🔥", color: "bg-orange-600", type: "fire" },
    { id: "safe", label: "I'm Safe", emoji: "✅", color: "bg-green-600", type: "safe" },
  ];

  const handleQuickAlert = async (alertType: string, message: string) => {
    try {
      await sendAlert({
        sessionId,
        type: alertType,
        message,
      });
      
      toast.success(`${message} alert sent`);
      
      // Play sound and vibrate
      try {
        const audio = new Audio("/alert.mp3");
        audio.play().catch(console.error);
      } catch (error) {
        console.error("Failed to play sound:", error);
      }
      
      if (navigator.vibrate) {
        navigator.vibrate([200, 100, 200]);
      }
    } catch (error) {
      toast.error("Failed to send alert");
    }
  };

  const emergencyActions = [
    {
      id: "call-911",
      label: "Call 911",
      emoji: "📞",
      color: "bg-red-700",
      action: () => {
        window.open("tel:911");
        toast.success("Calling emergency services...");
      }
    },
    {
      id: "share-location",
      label: "Share Location",
      emoji: "📍",
      color: "bg-blue-600",
      action: () => {
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (position) => {
              const location = `${position.coords.latitude},${position.coords.longitude}`;
              const url = `https://maps.google.com/?q=${location}`;
              
              if (navigator.share) {
                navigator.share({
                  title: "My Emergency Location",
                  text: "I need help at this location:",
                  url: url
                });
              } else {
                navigator.clipboard.writeText(url);
                toast.success("Location copied to clipboard");
              }
            },
            () => {
              toast.error("Could not get location");
            }
          );
        }
      }
    },
    {
      id: "flashlight",
      label: "Flashlight",
      emoji: "🔦",
      color: "bg-yellow-600",
      action: async () => {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: "environment" }
          });
          
          const track = stream.getVideoTracks()[0];
          const capabilities = track.getCapabilities();
          
          if (capabilities.torch) {
            await track.applyConstraints({
              advanced: [{ torch: true } as any]
            });
            toast.success("Flashlight turned on");
            
            // Turn off after 30 seconds
            setTimeout(() => {
              track.applyConstraints({
                advanced: [{ torch: false } as any]
              });
              stream.getTracks().forEach(track => track.stop());
            }, 30000);
          } else {
            toast.error("Flashlight not available");
          }
        } catch (error) {
          toast.error("Could not access flashlight");
        }
      }
    }
  ];

  return (
    <div className="bg-white rounded-lg p-4 shadow-sm border">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">⚡ Quick Actions</h3>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-blue-600 hover:text-blue-800 text-sm"
        >
          {isExpanded ? "Show Less" : "Show More"}
        </button>
      </div>

      {/* Emergency Button */}
      <button
        onClick={onEmergencyAlert}
        className="w-full mb-4 bg-red-600 hover:bg-red-700 text-white font-bold py-4 px-6 rounded-lg text-xl shadow-lg transform transition-all duration-200 hover:scale-105 active:scale-95"
      >
        🚨 EMERGENCY ALERT
      </button>

      {/* Quick Alert Buttons */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        {quickAlerts.map((alert) => (
          <button
            key={alert.id}
            onClick={() => handleQuickAlert(alert.type, alert.label)}
            className={`${alert.color} hover:opacity-90 text-white font-medium py-3 px-4 rounded-lg text-sm transition-all duration-200 hover:scale-105`}
          >
            <div className="text-lg mb-1">{alert.emoji}</div>
            <div>{alert.label}</div>
          </button>
        ))}
      </div>

      {/* Expanded Actions */}
      {isExpanded && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-gray-700 mb-2">Emergency Tools</h4>
          {emergencyActions.map((action) => (
            <button
              key={action.id}
              onClick={action.action}
              className={`w-full ${action.color} hover:opacity-90 text-white font-medium py-2 px-4 rounded-lg text-sm transition-all duration-200 flex items-center gap-2`}
            >
              <span className="text-lg">{action.emoji}</span>
              <span>{action.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}