import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";

interface AnalyticsDashboardProps {
  sessionId: Id<"sessions">;
}

export function AnalyticsDashboard({ sessionId }: AnalyticsDashboardProps) {
  const [timeRange, setTimeRange] = useState<'1h' | '24h' | '7d' | '30d'>('24h');
  
  const analytics = useQuery(api.analytics.getSessionAnalytics, { 
    sessionId, 
    timeRange 
  });
  
  const alerts = useQuery(api.alerts.getSessionAlerts, { sessionId }) || [];
  const locations = useQuery(api.locations.getSessionLocations, { sessionId }) || [];
  const breaches = useQuery(api.geofences.getGeofenceEvents, { sessionId, limit: 100 }) || [];

  if (!analytics) return <div>Loading analytics...</div>;

  const getTimeRangeMs = () => {
    const now = Date.now();
    switch (timeRange) {
      case '1h': return now - 60 * 60 * 1000;
      case '24h': return now - 24 * 60 * 60 * 1000;
      case '7d': return now - 7 * 24 * 60 * 60 * 1000;
      case '30d': return now - 30 * 24 * 60 * 60 * 1000;
      default: return now - 24 * 60 * 60 * 1000;
    }
  };

  const timeRangeStart = getTimeRangeMs();
  const filteredAlerts = alerts.filter(a => a.createdAt >= timeRangeStart);
  const filteredBreaches = breaches.filter((b: any) => b.timestamp >= timeRangeStart);

  const alertsByType = filteredAlerts.reduce((acc, alert) => {
    acc[alert.type] = (acc[alert.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const breachesByType = filteredBreaches.reduce((acc: Record<string, number>, breach: any) => {
    acc[breach.eventType] = (acc[breach.eventType] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const responseTime = filteredAlerts.length > 0 
    ? filteredAlerts.reduce((sum, alert) => {
        const firstAck = alert.acknowledged.length > 0 ? 
          Math.min(...alert.acknowledged.map(() => Date.now())) : Date.now();
        return sum + (firstAck - alert.createdAt);
      }, 0) / filteredAlerts.length / 1000 / 60 // Convert to minutes
    : 0;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-semibold">Analytics Dashboard</h3>
        <select
          value={timeRange}
          onChange={(e) => setTimeRange(e.target.value as any)}
          className="px-3 py-1 border rounded"
        >
          <option value="1h">Last Hour</option>
          <option value="24h">Last 24 Hours</option>
          <option value="7d">Last 7 Days</option>
          <option value="30d">Last 30 Days</option>
        </select>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-2xl font-bold text-blue-600">{locations.length}</div>
          <div className="text-sm text-gray-600">Active Members</div>
        </div>
        
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-2xl font-bold text-red-600">{filteredAlerts.length}</div>
          <div className="text-sm text-gray-600">Total Alerts</div>
        </div>
        
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-2xl font-bold text-orange-600">{filteredBreaches.length}</div>
          <div className="text-sm text-gray-600">Geofence Breaches</div>
        </div>
        
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-2xl font-bold text-green-600">{responseTime.toFixed(1)}m</div>
          <div className="text-sm text-gray-600">Avg Response Time</div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Alert Types */}
        <div className="bg-white p-4 rounded-lg shadow">
          <h4 className="text-lg font-semibold mb-3">Alerts by Type</h4>
          <div className="space-y-2">
            {Object.entries(alertsByType).map(([type, count]) => (
              <div key={type} className="flex justify-between items-center">
                <span className="text-sm">{type}</span>
                <div className="flex items-center gap-2">
                  <div 
                    className="bg-blue-200 h-4 rounded"
                    style={{ 
                      width: `${(count / Math.max(...Object.values(alertsByType))) * 100}px`,
                      minWidth: '20px'
                    }}
                  ></div>
                  <span className="text-sm font-medium">{count}</span>
                </div>
              </div>
            ))}
            {Object.keys(alertsByType).length === 0 && (
              <div className="text-gray-500 text-center py-4">No alerts in this period</div>
            )}
          </div>
        </div>

        {/* Geofence Breaches */}
        <div className="bg-white p-4 rounded-lg shadow">
          <h4 className="text-lg font-semibold mb-3">Geofence Breaches</h4>
          <div className="space-y-2">
            {Object.entries(breachesByType).map(([type, count]) => (
              <div key={type} className="flex justify-between items-center">
                <span className="text-sm capitalize">{type}</span>
                <div className="flex items-center gap-2">
                  <div 
                    className="bg-orange-200 h-4 rounded"
                    style={{ 
                      width: `${((count as number) / Math.max(...Object.values(breachesByType).map(v => v as number))) * 100}px`,
                      minWidth: '20px'
                    }}
                  ></div>
                  <span className="text-sm font-medium">{String(count)}</span>
                </div>
              </div>
            ))}
            {Object.keys(breachesByType).length === 0 && (
              <div className="text-gray-500 text-center py-4">No breaches in this period</div>
            )}
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div className="bg-white p-4 rounded-lg shadow">
        <h4 className="text-lg font-semibold mb-3">Recent Activity Timeline</h4>
        <div className="space-y-3 max-h-64 overflow-y-auto">
          {[...filteredAlerts, ...filteredBreaches]
            .sort((a, b) => {
              const aTime = 'createdAt' in a ? a.createdAt : a.timestamp;
              const bTime = 'createdAt' in b ? b.createdAt : b.timestamp;
              return bTime - aTime;
            })
            .slice(0, 20)
            .map((event, index) => (
              <div key={index} className="flex items-start gap-3 text-sm">
                <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                <div className="flex-1">
                  <div className="font-medium">
                    {'type' in event ? `Alert: ${event.type}` : `Geofence ${event.eventType}: ${event.geofenceName || 'Unknown'}`}
                  </div>
                  <div className="text-gray-600">
                    {'message' in event ? event.message : `User ${'userName' in event ? event.userName : 'Unknown'}`}
                  </div>
                  <div className="text-gray-400 text-xs">
                    {new Date('createdAt' in event ? event.createdAt : event.timestamp).toLocaleString()}
                  </div>
                </div>
              </div>
            ))}
          {filteredAlerts.length === 0 && filteredBreaches.length === 0 && (
            <div className="text-gray-500 text-center py-4">No activity in this period</div>
          )}
        </div>
      </div>
    </div>
  );
}