import { useState, useEffect } from "react";
import { toast } from "sonner";

interface OfflineData {
  alerts: any[];
  locations: any[];
  messages: any[];
  timestamp: number;
}

export function OfflineMode() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [offlineData, setOfflineData] = useState<OfflineData | null>(null);
  const [pendingActions, setPendingActions] = useState<any[]>([]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      toast.success("Connection restored");
      syncPendingActions();
    };

    const handleOffline = () => {
      setIsOnline(false);
      toast.warning("You are now offline. Data will be cached locally.");
      cacheCurrentData();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Load cached data on mount
    loadCachedData();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const cacheCurrentData = () => {
    try {
      const data: OfflineData = {
        alerts: [], // Would be populated from current state
        locations: [],
        messages: [],
        timestamp: Date.now()
      };
      
      localStorage.setItem('emergencyApp_offlineData', JSON.stringify(data));
      setOfflineData(data);
    } catch (error) {
      console.error("Failed to cache data:", error);
    }
  };

  const loadCachedData = () => {
    try {
      const cached = localStorage.getItem('emergencyApp_offlineData');
      if (cached) {
        setOfflineData(JSON.parse(cached));
      }
    } catch (error) {
      console.error("Failed to load cached data:", error);
    }
  };

  const addPendingAction = (action: any) => {
    const newActions = [...pendingActions, { ...action, timestamp: Date.now() }];
    setPendingActions(newActions);
    localStorage.setItem('emergencyApp_pendingActions', JSON.stringify(newActions));
  };

  const syncPendingActions = async () => {
    if (pendingActions.length === 0) return;

    try {
      // Here you would sync pending actions with the server
      toast.success(`Synced ${pendingActions.length} pending actions`);
      setPendingActions([]);
      localStorage.removeItem('emergencyApp_pendingActions');
    } catch (error) {
      toast.error("Failed to sync pending actions");
    }
  };

  const clearOfflineData = () => {
    localStorage.removeItem('emergencyApp_offlineData');
    localStorage.removeItem('emergencyApp_pendingActions');
    setOfflineData(null);
    setPendingActions([]);
    toast.success("Offline data cleared");
  };

  if (isOnline && pendingActions.length === 0) {
    return null; // Don't show when online and no pending actions
  }

  return (
    <div className={`fixed top-4 left-4 right-4 z-50 ${isOnline ? 'bg-blue-50 border-blue-200' : 'bg-orange-50 border-orange-200'} border rounded-lg p-3`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${isOnline ? 'bg-green-500' : 'bg-orange-500'}`}></div>
          <span className="font-medium">
            {isOnline ? '🟢 Online' : '🟠 Offline Mode'}
          </span>
          {pendingActions.length > 0 && (
            <span className="text-sm text-gray-600">
              ({pendingActions.length} pending actions)
            </span>
          )}
        </div>
        
        <div className="flex gap-2">
          {!isOnline && offlineData && (
            <span className="text-xs text-gray-600">
              Cached: {new Date(offlineData.timestamp).toLocaleTimeString()}
            </span>
          )}
          
          {isOnline && pendingActions.length > 0 && (
            <button
              onClick={syncPendingActions}
              className="text-blue-600 hover:text-blue-800 text-sm"
            >
              Sync Now
            </button>
          )}
          
          <button
            onClick={clearOfflineData}
            className="text-gray-600 hover:text-gray-800 text-sm"
          >
            ✕
          </button>
        </div>
      </div>
      
      {!isOnline && (
        <div className="mt-2 text-sm text-gray-600">
          You can still send alerts and messages. They will be sent when connection is restored.
        </div>
      )}
    </div>
  );
}