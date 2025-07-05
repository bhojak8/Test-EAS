import { useState, useEffect } from "react";
import { StorageAPI, Geofence } from "./lib/storage";
import { FreeLeafletMap } from './FreeLeafletMap';

export function GeofenceManager({ sessionId }: { sessionId: string }) {
  const [geofences, setGeofences] = useState<Geofence[]>([]);
  const [activeTab, setActiveTab] = useState<'create' | 'manage' | 'analytics'>('create');

  useEffect(() => {
    setGeofences(StorageAPI.getSessionGeofences(sessionId));
  }, [sessionId]);

  const refreshGeofences = () => {
    setGeofences(StorageAPI.getSessionGeofences(sessionId));
  };

  return (
    <div className="bg-gray-50 rounded-xl p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h3 className="text-2xl font-bold text-gray-800">🗺️ Free Geofence Management</h3>
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('create')}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              activeTab === 'create'
                ? "bg-blue-600 text-white shadow-lg"
                : "bg-white text-gray-600 hover:bg-gray-100"
            }`}
          >
            ✏️ Create
          </button>
          <button
            onClick={() => setActiveTab('manage')}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              activeTab === 'manage'
                ? "bg-blue-600 text-white shadow-lg"
                : "bg-white text-gray-600 hover:bg-gray-100"
            }`}
          >
            📋 Manage
          </button>
          <button
            onClick={() => setActiveTab('analytics')}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              activeTab === 'analytics'
                ? "bg-blue-600 text-white shadow-lg"
                : "bg-white text-gray-600 hover:bg-gray-100"
            }`}
          >
            📊 Analytics
          </button>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'create' && (
        <div className="space-y-4">
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <h4 className="font-semibold text-green-900 mb-2">🆓 Free High-Precision Geofencing</h4>
            <p className="text-green-800 text-sm">
              Use the free drawing tools below to create precise geofences with GPS accuracy. 
              No API keys required - powered by OpenStreetMap!
            </p>
          </div>
          
          <FreeLeafletMap sessionId={sessionId} mode="geofence" onGeofenceCreated={refreshGeofences} />
        </div>
      )}

      {activeTab === 'manage' && (
        <div className="bg-white rounded-lg p-6 shadow-sm border">
          <h4 className="text-lg font-semibold mb-6">📋 Manage Free Geofences</h4>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {geofences.map((geofence) => (
              <div
                key={geofence._id}
                className="border rounded-lg p-4 hover:shadow-md transition-all"
              >
                <div className="flex items-center justify-between mb-2">
                  <h5 className="font-semibold text-gray-800">{geofence.name}</h5>
                  <div className={`w-3 h-3 rounded-full ${
                    geofence.type === 'safe_zone' ? 'bg-green-500' :
                    geofence.type === 'restricted_zone' ? 'bg-red-500' : 'bg-yellow-500'
                  }`} />
                </div>
                <p className="text-sm text-gray-600 capitalize mb-2">
                  {geofence.type.replace('_', ' ')} • {geofence.shape}
                </p>
                {geofence.shape === 'circle' && (
                  <p className="text-xs text-gray-500 mb-2">📏 Radius: {geofence.radius}m</p>
                )}
                {geofence.shape === 'polygon' && (
                  <p className="text-xs text-gray-500 mb-2">
                    📐 Points: {geofence.coordinates?.length}
                  </p>
                )}
                <div className="flex gap-1 flex-wrap">
                  {geofence.alertOnEntry && (
                    <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                      🔔 Entry Alert
                    </span>
                  )}
                  {geofence.alertOnExit && (
                    <span className="text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded-full">
                      🔔 Exit Alert
                    </span>
                  )}
                </div>
                <button
                  onClick={() => {
                    StorageAPI.deleteGeofence(geofence._id);
                    refreshGeofences();
                  }}
                  className="mt-2 px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700"
                >
                  🗑️ Delete
                </button>
              </div>
            ))}
          </div>

          {geofences.length === 0 && (
            <div className="text-center text-gray-500 py-12">
              <div className="text-4xl mb-4">🗺️</div>
              <p className="text-lg">No geofences created yet</p>
              <p className="text-sm">Switch to the Create tab to add your first free geofence</p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'analytics' && (
        <div className="bg-white rounded-lg p-6 shadow-sm border">
          <h4 className="text-lg font-semibold mb-6">📊 Free Geofence Analytics</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-lg">
              <h5 className="font-semibold text-gray-700 mb-2">Total Geofences</h5>
              <p className="text-3xl font-bold text-blue-600">{geofences.length}</p>
              <p className="text-xs text-blue-600 mt-1">🆓 Free unlimited</p>
            </div>
            <div className="bg-gradient-to-br from-green-50 to-green-100 p-6 rounded-lg">
              <h5 className="font-semibold text-gray-700 mb-2">Safe Zones</h5>
              <p className="text-3xl font-bold text-green-600">
                {geofences.filter(g => g.type === 'safe_zone').length}
              </p>
              <p className="text-xs text-green-600 mt-1">🛡️ Protection areas</p>
            </div>
            <div className="bg-gradient-to-br from-red-50 to-red-100 p-6 rounded-lg">
              <h5 className="font-semibold text-gray-700 mb-2">Restricted Zones</h5>
              <p className="text-3xl font-bold text-red-600">
                {geofences.filter(g => g.type === 'restricted_zone').length}
              </p>
              <p className="text-xs text-red-600 mt-1">🚫 No-go areas</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}