import { useState, useEffect } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { toast } from "sonner";

interface LocationTrackerProps {
  sessionId: Id<"sessions">;
  isActive: boolean;
  onToggle: () => void;
}

export function LocationTracker({ sessionId, isActive, onToggle }: LocationTrackerProps) {
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [watchId, setWatchId] = useState<number | null>(null);
  const [locationHistory, setLocationHistory] = useState<Array<{lat: number, lng: number, timestamp: number}>>([]);
  
  const updateLocation = useMutation(api.locations.updateLocation);

  useEffect(() => {
    if (!isActive) {
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
        setWatchId(null);
      }
      return;
    }

    if (!navigator.geolocation) {
      toast.error("Geolocation not supported by this browser");
      return;
    }

    const id = navigator.geolocation.watchPosition(
      async (position) => {
        try {
          const location = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };

          await updateLocation({
            sessionId,
            location,
            accuracy: position.coords.accuracy,
          });

          setAccuracy(position.coords.accuracy);
          setLastUpdate(new Date());
          
          // Keep location history for analytics
          setLocationHistory(prev => [
            ...prev.slice(-50), // Keep last 50 locations
            { ...location, timestamp: Date.now() }
          ]);

        } catch (error) {
          console.error("Failed to update location:", error);
          toast.error("Failed to update location");
        }
      },
      (error) => {
        console.error("Geolocation error:", error);
        let message = "Location error";
        switch (error.code) {
          case error.PERMISSION_DENIED:
            message = "Location access denied. Please enable location permissions.";
            break;
          case error.POSITION_UNAVAILABLE:
            message = "Location information unavailable.";
            break;
          case error.TIMEOUT:
            message = "Location request timed out.";
            break;
        }
        toast.error(message);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 30000
      }
    );

    setWatchId(id);

    return () => {
      if (id !== null) {
        navigator.geolocation.clearWatch(id);
      }
    };
  }, [isActive, sessionId, updateLocation]);

  const getAccuracyColor = (acc: number) => {
    if (acc <= 10) return "text-green-600";
    if (acc <= 50) return "text-yellow-600";
    return "text-red-600";
  };

  const getAccuracyText = (acc: number) => {
    if (acc <= 10) return "High";
    if (acc <= 50) return "Medium";
    return "Low";
  };

  return (
    <div className="bg-white rounded-lg p-4 shadow-sm border">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold">📍 Location Tracking</h3>
        <button
          onClick={onToggle}
          className={`px-4 py-2 rounded-lg font-medium transition-all ${
            isActive
              ? "bg-red-600 text-white hover:bg-red-700"
              : "bg-green-600 text-white hover:bg-green-700"
          }`}
        >
          {isActive ? "Stop Tracking" : "Start Tracking"}
        </button>
      </div>

      {isActive && (
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">Status:</span>
            <span className="text-green-600 font-medium">🟢 Active</span>
          </div>
          
          {accuracy && (
            <div className="flex justify-between">
              <span className="text-gray-600">Accuracy:</span>
              <span className={`font-medium ${getAccuracyColor(accuracy)}`}>
                {getAccuracyText(accuracy)} (±{Math.round(accuracy)}m)
              </span>
            </div>
          )}
          
          {lastUpdate && (
            <div className="flex justify-between">
              <span className="text-gray-600">Last Update:</span>
              <span className="font-medium">{lastUpdate.toLocaleTimeString()}</span>
            </div>
          )}

          <div className="flex justify-between">
            <span className="text-gray-600">Points Collected:</span>
            <span className="font-medium">{locationHistory.length}</span>
          </div>
        </div>
      )}

      {!isActive && (
        <div className="text-center text-gray-500 py-4">
          <div className="text-2xl mb-2">📍</div>
          <p>Location tracking is disabled</p>
          <p className="text-xs">Enable to share your location with the team</p>
        </div>
      )}
    </div>
  );
}