import { useEffect, useState, useRef } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";
import { toast } from "sonner";
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default markers in Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

function getInitials(name: string) {
  return name
    .split(' ')
    .map(part => part[0])
    .join('')
    .toUpperCase();
}

function createCustomIcon(name: string, alertStatus: 'none' | 'active' | 'acknowledged' = 'none', isOffline?: boolean) {
  const initials = getInitials(name);
  let color = '#2563eb'; // Default blue
  
  if (isOffline) {
    color = '#6b7280'; // Gray for offline
  } else if (alertStatus === 'active') {
    color = '#dc2626'; // Red for active alerts
  } else if (alertStatus === 'acknowledged') {
    color = '#059669'; // Green for acknowledged
  }
  
  const svgIcon = `
    <svg width="50" height="50" viewBox="0 0 50 50" xmlns="http://www.w3.org/2000/svg">
      <circle cx="25" cy="25" r="20" fill="${color}" opacity="0.3"/>
      <circle cx="25" cy="25" r="15" fill="${color}" stroke="white" stroke-width="2"/>
      <text x="25" y="30" text-anchor="middle" fill="white" font-size="10" font-weight="bold">${initials}</text>
      ${alertStatus === 'active' ? '<circle cx="35" cy="15" r="5" fill="#fbbf24"/>' : ''}
      ${isOffline ? '<circle cx="35" cy="15" r="5" fill="#374151"/>' : ''}
    </svg>
  `;

  return L.divIcon({
    html: svgIcon,
    className: 'custom-marker pulsing-marker',
    iconSize: [50, 50],
    iconAnchor: [25, 25],
    popupAnchor: [0, -25]
  });
}

export function EmergencyMap({ sessionId }: { sessionId: Id<"sessions"> }) {
  const locations = useQuery(api.locations.getSessionLocations, { sessionId }) || [];
  const alerts = useQuery(api.alerts.getSessionAlerts, { sessionId }) || [];
  const geofences = useQuery(api.geofences.getSessionGeofences, { sessionId }) || [];
  const sessions = useQuery(api.sessions.listSessions) || [];
  const session = sessions.find(s => s && s._id === sessionId);
  const updateLocation = useMutation(api.locations.updateLocation);
  
  const [watching, setWatching] = useState(false);
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const markers = useRef<{ [key: string]: L.Marker }>({});
  const geofenceLayers = useRef<{ [key: string]: L.Layer }>({});
  const [showList, setShowList] = useState(true);
  const [mapStyle, setMapStyle] = useState('streets');
  const [trackingMode, setTrackingMode] = useState<'none' | 'follow' | 'center'>('none');
  const [showMeasurement, setShowMeasurement] = useState(false);
  const [measurementPoints, setMeasurementPoints] = useState<Array<{ lat: number; lng: number }>>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const measurementLayer = useRef<L.Layer | null>(null);
  const tileLayer = useRef<L.TileLayer | null>(null);

  useEffect(() => {
    if (!mapContainer.current) return;

    // Initialize map
    map.current = L.map(mapContainer.current).setView([40.7128, -74.0060], 10);

    // Add initial tile layer
    const getTileLayer = (style: string) => {
      switch (style) {
        case 'satellite':
          return L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
            attribution: '&copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
          });
        case 'dark':
          return L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          });
        case 'terrain':
          return L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
            attribution: 'Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, <a href="http://viewfinderpanoramas.org">SRTM</a> | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a>'
          });
        default: // streets
          return L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          });
      }
    };

    tileLayer.current = getTileLayer(mapStyle);
    tileLayer.current.addTo(map.current);

    const mapInstance = map.current;
    return () => {
      mapInstance.remove();
      map.current = null;
    };
  }, []);

  // Handle map style changes
  useEffect(() => {
    if (!map.current) return;

    const getTileLayer = (style: string) => {
      switch (style) {
        case 'satellite':
          return L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
            attribution: '&copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
          });
        case 'dark':
          return L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          });
        case 'terrain':
          return L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
            attribution: 'Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, <a href="http://viewfinderpanoramas.org">SRTM</a> | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a>'
          });
        default: // streets
          return L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          });
      }
    };

    // Remove old tile layer
    if (tileLayer.current) {
      map.current.removeLayer(tileLayer.current);
    }

    // Add new tile layer
    tileLayer.current = getTileLayer(mapStyle);
    tileLayer.current.addTo(map.current);
  }, [mapStyle]);

  useEffect(() => {
    if (!map.current) return;

    // Clear old markers
    Object.values(markers.current).forEach(marker => marker.remove());
    markers.current = {};

    // Clear old geofence layers
    Object.values(geofenceLayers.current).forEach(layer => map.current?.removeLayer(layer));
    geofenceLayers.current = {};

    // Add markers for all locations
    locations.forEach(member => {
      if (member.location) {
        const recentAlert = alerts.find(alert => 
          alert.createdBy === member.userId && 
          Date.now() - alert.createdAt < 60000
        );

        const alertType = recentAlert && session?.alertTypes?.find(t => t.id === recentAlert.type);
        const isOffline = member.lastSeen && Date.now() - member.lastSeen > 300000;
        
        // Determine alert status
        let alertStatus: 'none' | 'active' | 'acknowledged' = 'none';
        if (recentAlert) {
          if (recentAlert.acknowledged.length === 0) {
            alertStatus = 'active';
          } else if (recentAlert.acknowledged.length > 0) {
            alertStatus = 'acknowledged';
          }
        }

        const marker = L.marker([member.location.lat, member.location.lng], {
          icon: createCustomIcon(member.name, alertStatus, !!isOffline)
        }).addTo(map.current!);

        // Add popup with detailed info
        const popupContent = `
          <div class="p-2">
            <h3 class="font-semibold">${member.name}</h3>
            <p class="text-sm text-gray-600">${member.role}</p>
            ${recentAlert ? `<p class="text-sm text-red-600">${alertType?.emoji} ${alertType?.label}</p>` : ''}
            ${isOffline ? '<p class="text-sm text-gray-500">📴 Offline</p>' : ''}
            <p class="text-xs text-gray-400 mt-1">
              ${member.location.lat.toFixed(6)}, ${member.location.lng.toFixed(6)}
            </p>
            ${member.lastSeen ? `<p class="text-xs text-gray-400">Last seen: ${new Date(member.lastSeen).toLocaleTimeString()}</p>` : ''}
          </div>
        `;

        marker.bindPopup(popupContent);
        markers.current[member.userId] = marker;
      }
    });

    // Add geofence layers
    geofences.forEach(geofence => {
      let layer: L.Layer | null = null;

      const getGeofenceColor = (type: string) => {
        switch (type) {
          case 'safe_zone': return { color: '#059669', fillColor: '#10b981' };
          case 'restricted_zone': return { color: '#dc2626', fillColor: '#ef4444' };
          case 'alert_zone': return { color: '#d97706', fillColor: '#f59e0b' };
          default: return { color: '#4b5563', fillColor: '#6b7280' };
        }
      };

      const colors = getGeofenceColor(geofence.type);

      if (geofence.shape === 'circle' && geofence.center && geofence.radius) {
        layer = L.circle([geofence.center.lat, geofence.center.lng], {
          radius: geofence.radius,
          color: colors.color,
          fillColor: colors.fillColor,
          fillOpacity: 0.25,
          weight: 3,
          opacity: 0.8
        });
      } else if (geofence.shape === 'polygon' && geofence.coordinates && geofence.coordinates.length >= 3) {
        const latLngs = geofence.coordinates.map(coord => [coord.lat, coord.lng] as [number, number]);
        layer = L.polygon(latLngs, {
          color: colors.color,
          fillColor: colors.fillColor,
          fillOpacity: 0.25,
          weight: 3,
          opacity: 0.8,
          smoothFactor: 1.0
        });
      }

      if (layer) {
        layer.addTo(map.current!);
        
        const popupContent = `
          <div class="p-2">
            <h3 class="font-semibold">${geofence.name}</h3>
            <p class="text-sm">${geofence.type.replace('_', ' ').toUpperCase()}</p>
            ${geofence.shape === 'circle' ? `<p class="text-xs">Radius: ${geofence.radius}m</p>` : `<p class="text-xs">Polygon: ${geofence.coordinates?.length} points</p>`}
            ${geofence.description ? `<p class="text-xs mt-1">${geofence.description}</p>` : ''}
          </div>
        `;
        
        layer.bindPopup(popupContent);
        geofenceLayers.current[geofence._id] = layer;
      }
    });

    // Auto-fit bounds based on tracking mode
    if (trackingMode === 'center' && (locations.length > 0 || geofences.length > 0)) {
      const group = new L.FeatureGroup([
        ...Object.values(markers.current),
        ...Object.values(geofenceLayers.current)
      ]);
      
      if (group.getLayers().length > 0) {
        map.current.fitBounds(group.getBounds(), { padding: [20, 20] });
      }
    }
  }, [locations, alerts, session?.alertTypes, geofences, trackingMode]);

  // Add measurement event handler
  useEffect(() => {
    if (!map.current) return;
    
    const handleMeasurementClick = (e: L.LeafletMouseEvent) => {
      if (!showMeasurement) return;
      const point = { lat: e.latlng.lat, lng: e.latlng.lng };
      const newPoints = [...measurementPoints, point];
      setMeasurementPoints(newPoints);
      
      if (newPoints.length >= 2 && map.current) {
        if (measurementLayer.current) map.current.removeLayer(measurementLayer.current);
        
        const line = L.polyline(newPoints.map(p => [p.lat, p.lng] as [number, number]), {
          color: '#ff6b35', weight: 3, opacity: 0.8, dashArray: '5, 5'
        });
        
        let dist = 0;
        for (let i = 1; i < newPoints.length; i++) {
          dist += map.current.distance([newPoints[i-1].lat, newPoints[i-1].lng], [newPoints[i].lat, newPoints[i].lng]);
        }
        
        line.bindPopup(`📏 ${dist > 1000 ? (dist/1000).toFixed(2) + ' km' : dist.toFixed(0) + ' m'}`);
        line.addTo(map.current);
        measurementLayer.current = line;
      }
    };

    map.current.on('click', handleMeasurementClick);
    return () => {
      if (map.current) {
        map.current.off('click', handleMeasurementClick);
      }
    };
  }, [showMeasurement, measurementPoints]);

  useEffect(() => {
    if (!watching) return;

    const watchId = navigator.geolocation.watchPosition(
      async (position) => {
        try {
          await updateLocation({
            sessionId,
            location: {
              lat: position.coords.latitude,
              lng: position.coords.longitude,
            },
            accuracy: position.coords.accuracy,
          });

          // Follow user location if tracking mode is enabled
          if (trackingMode === 'follow' && map.current) {
            map.current.setView([position.coords.latitude, position.coords.longitude], 15);
          }
        } catch (error) {
          console.error("Failed to update location:", error);
        }
      },
      (error) => {
        console.error("Geolocation error:", error);
        toast.error("Failed to get location");
      },
      {
        enableHighAccuracy: true,
        timeout: 5000,
        maximumAge: 0
      }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [sessionId, watching, updateLocation, trackingMode]);

  const toggleLocation = () => {
    if (!watching) {
      if (!navigator.geolocation) {
        toast.error("Geolocation not supported");
        return;
      }
      setWatching(true);
      toast.success("Location sharing enabled");
    } else {
      setWatching(false);
      toast.success("Location sharing disabled");
    }
  };

  const centerOnMyLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation not supported");
      return;
    }
    
    toast.info("Getting location...");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (map.current) {
          map.current.setView([pos.coords.latitude, pos.coords.longitude], 16);
          const marker = L.circleMarker([pos.coords.latitude, pos.coords.longitude], {
            radius: 8, fillColor: '#3b82f6', color: 'white', weight: 2, opacity: 1, fillOpacity: 0.8
          }).addTo(map.current);
          setTimeout(() => map.current?.removeLayer(marker), 5000);
          toast.success("Location found!");
        }
      },
      (err) => {
        const msgs = ["Failed", "Access denied", "Unavailable", "Timeout"];
        toast.error(msgs[err.code] || msgs[0]);
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  };

  const clearMeasurement = () => {
    setMeasurementPoints([]);
    if (measurementLayer.current && map.current) {
      map.current.removeLayer(measurementLayer.current);
      measurementLayer.current = null;
    }
  };

  const searchLocation = async () => {
    if (!searchQuery.trim()) return;
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=1`
      );
      const results = await response.json();
      if (results.length > 0 && map.current) {
        const result = results[0];
        map.current.setView([parseFloat(result.lat), parseFloat(result.lon)], 15);
        toast.success("Location found!");
      } else {
        toast.error("Location not found");
      }
    } catch (error) {
      toast.error("Search failed");
    }
  };

  const fitAllMarkers = () => {
    if (!map.current || locations.length === 0) return;
    const group = new L.FeatureGroup([
      ...Object.values(markers.current),
      ...Object.values(geofenceLayers.current)
    ]);
    if (group.getLayers().length > 0) {
      map.current.fitBounds(group.getBounds(), { padding: [20, 20] });
      toast.success("Map centered on all locations");
    }
  };

  const exportData = () => {
    const data = {
      session: session?.name,
      timestamp: new Date().toISOString(),
      locations,
      alerts: alerts.slice(0, 50),
      geofences,
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `emergency-session-${session?.name}-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Data exported");
  };

  return (
    <div className="bg-gray-100 rounded-lg p-4 space-y-4">
      <div className="flex justify-between items-center flex-wrap gap-2">
        <div className="flex items-center gap-4">
          <h3 className="text-xl font-semibold">Team Locations</h3>
          <button
            onClick={() => setShowList(!showList)}
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            {showList ? "Hide List" : "Show List"}
          </button>
        </div>
        
        <div className="flex gap-2 flex-wrap">
          {/* Search Location */}
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search..."
            className="px-2 py-1 rounded border text-sm w-24"
            onKeyPress={(e) => e.key === 'Enter' && searchLocation()}
          />
          <button
            onClick={searchLocation}
            className="px-1 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
          >
            🔍
          </button>

          {/* Map Style Selector */}
          <select
            value={mapStyle}
            onChange={(e) => setMapStyle(e.target.value)}
            className="px-2 py-1 rounded border text-sm"
          >
            <option value="streets">Streets</option>
            <option value="satellite">Satellite</option>
            <option value="dark">Dark</option>
            <option value="terrain">Terrain</option>
          </select>

          {/* Tracking Mode */}
          <select
            value={trackingMode}
            onChange={(e) => setTrackingMode(e.target.value as any)}
            className="px-2 py-1 rounded border text-sm"
          >
            <option value="none">No Tracking</option>
            <option value="follow">Follow Me</option>
            <option value="center">Auto Center</option>
          </select>

          {/* Find My Location */}
          <button
            onClick={centerOnMyLocation}
            className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700"
            title="Center map on my location"
          >
            📍 My Location
          </button>

          {/* Fit All Markers */}
          <button
            onClick={fitAllMarkers}
            className="px-3 py-1 bg-purple-600 text-white rounded text-sm hover:bg-purple-700"
            title="Fit all markers in view"
          >
            🎯 Fit All
          </button>

          {/* Measurement Tool */}
          <button
            onClick={() => {
              setShowMeasurement(!showMeasurement);
              if (showMeasurement) clearMeasurement();
            }}
            className={`px-3 py-1 rounded text-sm ${
              showMeasurement 
                ? "bg-orange-600 text-white hover:bg-orange-700" 
                : "bg-gray-200 text-gray-700 hover:bg-gray-300"
            }`}
            title="Measure distances"
          >
            📏 Measure
          </button>

          {/* Export Data */}
          <button
            onClick={exportData}
            className="px-3 py-1 bg-indigo-600 text-white rounded text-sm hover:bg-indigo-700"
          >
            📊 Export
          </button>
          
          <button
            onClick={toggleLocation}
            className={`px-4 py-2 rounded-lg text-white ${
              watching ? "bg-red-600 hover:bg-red-700" : "bg-green-600 hover:bg-green-700"
            }`}
          >
            {watching ? "Stop Sharing Location" : "Share Location"}
          </button>
        </div>
      </div>

      <div className="relative">
        <div className="h-[500px] rounded-lg overflow-hidden shadow-lg" ref={mapContainer} />
        
        {/* Find My Location Button */}
        <button
          onClick={centerOnMyLocation}
          className="absolute top-4 right-4 bg-white hover:bg-gray-50 text-gray-700 p-3 rounded-lg shadow-lg border transition-colors z-10"
          title="Center map on my location"
        >
          📍
        </button>
      </div>

      {/* Measurement Instructions */}
      {showMeasurement && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
          <div className="flex items-center gap-2">
            <span className="text-orange-600 font-medium">📏 Measurement Mode Active</span>
            <span className="text-orange-700">
              Click on the map to add points. {measurementPoints.length} points added.
            </span>
            {measurementPoints.length > 0 && (
              <button
                onClick={clearMeasurement}
                className="ml-auto px-2 py-1 bg-orange-600 text-white rounded text-xs hover:bg-orange-700"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      )}

      {/* Status Bar */}
      <div className="flex justify-between items-center text-sm text-gray-600 bg-white p-2 rounded">
        <div className="flex gap-4">
          <span>👥 {locations.length} members</span>
          <span>🚨 {alerts.filter(a => Date.now() - a.createdAt < 60000).length} active alerts</span>
          <span>📍 {geofences.length} geofences</span>
        </div>
        <div className="flex gap-2">
          <span className="flex items-center gap-1">
            <div className="w-3 h-3 bg-blue-600 rounded-full"></div>
            Online
          </span>
          <span className="flex items-center gap-1">
            <div className="w-3 h-3 bg-red-600 rounded-full"></div>
            Alert
          </span>
          <span className="flex items-center gap-1">
            <div className="w-3 h-3 bg-gray-500 rounded-full"></div>
            Offline
          </span>
          <span className="flex items-center gap-1">
            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            Safe Zone
          </span>
          <span className="flex items-center gap-1">
            <div className="w-3 h-3 bg-red-500 rounded-full"></div>
            Restricted
          </span>
          <span className="flex items-center gap-1">
            <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
            Alert Zone
          </span>
        </div>
      </div>

      {showList && locations.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {locations.map((member) => {
            const recentAlert = alerts.find(alert => 
              alert.createdBy === member.userId && 
              Date.now() - alert.createdAt < 60000
            );
            const alertType = recentAlert && session?.alertTypes?.find(t => t.id === recentAlert.type);
            const isOffline = member.lastSeen && Date.now() - member.lastSeen > 300000;

            return (
              <div 
                key={member.userId} 
                className={`bg-white p-3 rounded shadow-sm border-l-4 ${
                  recentAlert ? 'border-red-600' : isOffline ? 'border-gray-400' : 'border-blue-600'
                }`}
              >
                <div className="flex items-center gap-2">
                  <div className="font-semibold">{member.name}</div>
                  {alertType && (
                    <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded-full">
                      {alertType.emoji} {alertType.label}
                    </span>
                  )}
                  {isOffline && (
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
                      📴 Offline
                    </span>
                  )}
                </div>
                <div className="text-sm text-gray-600">{member.role}</div>
                {member.location && (
                  <div className="text-xs text-gray-500 mt-1">
                    <div className="flex items-center gap-1">
                      <span>📍</span>
                      <span>
                        {member.location.lat.toFixed(6)}, {member.location.lng.toFixed(6)}
                      </span>
                    </div>
                  </div>
                )}
                {member.lastSeen && (
                  <div className="text-xs text-gray-400 mt-1">
                    Last seen: {new Date(member.lastSeen).toLocaleTimeString()}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}