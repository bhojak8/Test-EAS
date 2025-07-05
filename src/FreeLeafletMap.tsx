import { useEffect, useState, useRef } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";
import { toast } from "sonner";
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw/dist/leaflet.draw.css';
import 'leaflet-draw';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import 'leaflet.markercluster';

// Fix for default markers in Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface FreeLeafletMapProps {
  sessionId: Id<"sessions">;
  mode?: 'view' | 'geofence';
}

// Free map tile providers
const MAP_PROVIDERS = [
  {
    id: 'osm',
    name: '🗺️ OpenStreetMap',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '© OpenStreetMap contributors'
  },
  {
    id: 'satellite',
    name: '🛰️ Satellite (Esri)',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '© Esri'
  },
  {
    id: 'topo',
    name: '🏔️ Topographic',
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution: '© OpenTopoMap'
  },
  {
    id: 'dark',
    name: '🌙 Dark Mode',
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution: '© CARTO'
  },
  {
    id: 'light',
    name: '☀️ Light Mode',
    url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    attribution: '© CARTO'
  }
];

function createCustomIcon(name: string, alertStatus: 'none' | 'active' | 'acknowledged' = 'none', isOffline?: boolean) {
  const initials = name
    .split(' ')
    .map(part => part[0])
    .join('')
    .toUpperCase();
  
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

export function FreeLeafletMap({ sessionId, mode = 'view' }: FreeLeafletMapProps) {
  const locations = useQuery(api.locations.getSessionLocations, { sessionId }) || [];
  const alerts = useQuery(api.alerts.getSessionAlerts, { sessionId }) || [];
  const geofences = useQuery(api.geofences.getSessionGeofences, { sessionId }) || [];
  const sessions = useQuery(api.sessions.listSessions) || [];
  const session = sessions.find(s => s && s._id === sessionId);
  const updateLocation = useMutation(api.locations.updateLocation);
  const createGeofence = useMutation(api.geofences.createGeofence);

  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const drawControl = useRef<L.Control.Draw | null>(null);
  const drawnItems = useRef<L.FeatureGroup>(new L.FeatureGroup());
  const markers = useRef<{ [key: string]: L.Marker }>({});
  const geofenceLayers = useRef<{ [key: string]: L.Layer }>({});
  const markerCluster = useRef<L.MarkerClusterGroup | null>(null);

  const [watching, setWatching] = useState(false);
  const [currentProvider, setCurrentProvider] = useState('osm');
  const [trackingMode, setTrackingMode] = useState<'none' | 'follow' | 'center'>('none');
  const [showGeofenceForm, setShowGeofenceForm] = useState(false);
  const [drawnFeature, setDrawnFeature] = useState<any>(null);
  const [geofenceFormData, setGeofenceFormData] = useState({
    name: '',
    type: 'safe_zone' as const,
    alertOnEntry: true,
    alertOnExit: true,
    description: ''
  });

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current) return;

    // Initialize map
    map.current = L.map(mapContainer.current, {
      zoomControl: true,
      attributionControl: true,
      touchZoom: true,
      doubleClickZoom: false,
    }).setView([40.7128, -74.0060], 10);

    // Add initial tile layer
    const provider = MAP_PROVIDERS.find(p => p.id === currentProvider) || MAP_PROVIDERS[0];
    L.tileLayer(provider.url, {
      attribution: provider.attribution,
      maxZoom: 19,
    }).addTo(map.current);

    // Initialize marker cluster
    markerCluster.current = L.markerClusterGroup({
      chunkedLoading: true,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      zoomToBoundsOnClick: true,
      maxClusterRadius: 50,
    });
    map.current.addLayer(markerCluster.current);

    // Add drawn items layer
    map.current.addLayer(drawnItems.current);

    // Initialize drawing controls for geofence mode
    if (mode === 'geofence') {
      drawControl.current = new L.Control.Draw({
        position: 'topleft',
        draw: {
          polygon: {
            allowIntersection: false,
            drawError: {
              color: '#e1e100',
              message: '<strong>Error:</strong> Shape edges cannot cross!'
            },
            shapeOptions: {
              color: '#3b82f6',
              fillOpacity: 0.3
            }
          },
          circle: {
            shapeOptions: {
              color: '#3b82f6',
              fillOpacity: 0.3
            }
          },
          rectangle: {
            shapeOptions: {
              color: '#3b82f6',
              fillOpacity: 0.3
            }
          },
          polyline: false,
          marker: false,
          circlemarker: false
        },
        edit: {
          featureGroup: drawnItems.current,
          remove: true
        }
      });

      map.current.addControl(drawControl.current);

      // Handle drawing events
      map.current.on(L.Draw.Event.CREATED, handleDrawCreated);
      map.current.on(L.Draw.Event.EDITED, handleDrawEdited);
      map.current.on(L.Draw.Event.DELETED, handleDrawDeleted);
    }

    map.current.on('load', () => {
      console.log('Free Leaflet map loaded successfully!');
      toast.success('🗺️ Free high-accuracy map loaded!');
    });

    const mapInstance = map.current;
    return () => {
      if (mapInstance) {
        mapInstance.remove();
        map.current = null;
      }
    };
  }, [mode]);

  // Handle map provider changes
  useEffect(() => {
    if (!map.current) return;

    // Remove existing tile layers
    map.current.eachLayer((layer) => {
      if (layer instanceof L.TileLayer) {
        map.current!.removeLayer(layer);
      }
    });

    // Add new tile layer
    const provider = MAP_PROVIDERS.find(p => p.id === currentProvider) || MAP_PROVIDERS[0];
    L.tileLayer(provider.url, {
      attribution: provider.attribution,
      maxZoom: 19,
    }).addTo(map.current);
  }, [currentProvider]);

  // Update member markers
  useEffect(() => {
    if (!map.current || !markerCluster.current) return;

    // Clear existing markers
    markerCluster.current.clearLayers();
    Object.values(markers.current).forEach(marker => marker.remove());
    markers.current = {};

    // Add markers for each member
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
        });

        // Add popup with detailed info
        const popupContent = `
          <div class="p-3 min-w-[200px]">
            <h3 class="font-semibold text-lg">${member.name}</h3>
            <p class="text-sm text-gray-600">${member.role}</p>
            ${recentAlert ? `<p class="text-sm text-red-600 mt-1">${alertType?.emoji} ${alertType?.label}</p>` : ''}
            ${isOffline ? '<p class="text-sm text-gray-500 mt-1">📴 Offline</p>' : ''}
            <div class="mt-2 space-y-1">
              <p class="text-xs text-gray-500">📍 ${member.location.lat.toFixed(6)}, ${member.location.lng.toFixed(6)}</p>
              ${member.accuracy ? `<p class="text-xs text-gray-500">🎯 Accuracy: ±${member.accuracy}m</p>` : ''}
              ${member.lastSeen ? `<p class="text-xs text-gray-500">⏰ ${new Date(member.lastSeen).toLocaleTimeString()}</p>` : ''}
            </div>
          </div>
        `;

        marker.bindPopup(popupContent);
        markerCluster.current!.addLayer(marker);
        markers.current[member.userId] = marker;
      }
    });

    // Auto-fit bounds based on tracking mode
    if (trackingMode === 'center' && locations.length > 0) {
      const group = new L.FeatureGroup(Object.values(markers.current));
      if (group.getLayers().length > 0) {
        map.current.fitBounds(group.getBounds(), { padding: [20, 20] });
      }
    }
  }, [locations, alerts, session?.alertTypes, trackingMode]);

  // Update geofence layers
  useEffect(() => {
    if (!map.current) return;

    // Clear existing geofence layers
    Object.values(geofenceLayers.current).forEach(layer => map.current?.removeLayer(layer));
    geofenceLayers.current = {};

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
          <div class="p-3 min-w-[200px]">
            <h3 class="font-semibold text-lg">${geofence.name}</h3>
            <p class="text-sm text-gray-600">${geofence.type.replace('_', ' ').toUpperCase()}</p>
            ${geofence.shape === 'circle' ? `<p class="text-xs text-gray-500">📏 Radius: ${geofence.radius}m</p>` : `<p class="text-xs text-gray-500">📐 Points: ${geofence.coordinates?.length}</p>`}
            ${geofence.description ? `<p class="text-xs text-gray-500 mt-1">${geofence.description}</p>` : ''}
            <div class="mt-2 flex gap-1 flex-wrap">
              ${geofence.alertOnEntry ? '<span class="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">🔔 Entry</span>' : ''}
              ${geofence.alertOnExit ? '<span class="text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded-full">🔔 Exit</span>' : ''}
            </div>
          </div>
        `;
        
        layer.bindPopup(popupContent);
        geofenceLayers.current[geofence._id] = layer;
      }
    });
  }, [geofences]);

  // Handle geolocation
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

  // Drawing event handlers
  const handleDrawCreated = (e: any) => {
    const layer = e.layer;
    drawnItems.current.addLayer(layer);
    setDrawnFeature(layer);
    setShowGeofenceForm(true);
    toast.info('🎯 Geofence drawn! Configure and save it.');
  };

  const handleDrawEdited = (e: any) => {
    console.log('Features edited:', e.layers);
  };

  const handleDrawDeleted = (e: any) => {
    console.log('Features deleted:', e.layers);
    toast.info('Geofence deleted');
  };

  // Save geofence
  const saveGeofence = async () => {
    if (!drawnFeature || !geofenceFormData.name) {
      toast.error('Please provide a name for the geofence');
      return;
    }

    try {
      let geofenceData: any = {
        sessionId,
        name: geofenceFormData.name,
        type: geofenceFormData.type,
        alertOnEntry: geofenceFormData.alertOnEntry,
        alertOnExit: geofenceFormData.alertOnExit,
        description: geofenceFormData.description,
      };

      if (drawnFeature instanceof L.Circle) {
        geofenceData.shape = 'circle';
        geofenceData.center = {
          lat: drawnFeature.getLatLng().lat,
          lng: drawnFeature.getLatLng().lng
        };
        geofenceData.radius = drawnFeature.getRadius();
      } else if (drawnFeature instanceof L.Polygon || drawnFeature instanceof L.Rectangle) {
        geofenceData.shape = 'polygon';
        geofenceData.coordinates = drawnFeature.getLatLngs()[0].map((latlng: L.LatLng) => ({
          lat: latlng.lat,
          lng: latlng.lng
        }));
      }

      await createGeofence(geofenceData);
      
      // Clear the drawing
      drawnItems.current.clearLayers();
      
      setShowGeofenceForm(false);
      setDrawnFeature(null);
      setGeofenceFormData({
        name: '',
        type: 'safe_zone',
        alertOnEntry: true,
        alertOnExit: true,
        description: ''
      });
      
      toast.success('✅ Geofence created successfully!');
    } catch (error) {
      toast.error('Failed to create geofence');
    }
  };

  const toggleLocation = () => {
    if (!watching) {
      if (!navigator.geolocation) {
        toast.error("Geolocation not supported");
        return;
      }
      setWatching(true);
      toast.success("🎯 Free high-accuracy location tracking enabled!");
    } else {
      setWatching(false);
      toast.success("Location tracking disabled");
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

  return (
    <div className="bg-white rounded-xl shadow-lg p-6 space-y-4">
      {/* Enhanced Controls */}
      <div className="flex justify-between items-center flex-wrap gap-4">
        <h3 className="text-2xl font-bold text-gray-800">
          {mode === 'geofence' ? '🗺️ Free Geofence Designer' : '📍 Free Live Team Map'}
        </h3>
        
        <div className="flex gap-2 flex-wrap">
          {/* Map Provider Selector */}
          <select
            value={currentProvider}
            onChange={(e) => setCurrentProvider(e.target.value)}
            className="px-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-blue-500"
          >
            {MAP_PROVIDERS.map(provider => (
              <option key={provider.id} value={provider.id}>
                {provider.name}
              </option>
            ))}
          </select>

          {/* Tracking Mode */}
          <select
            value={trackingMode}
            onChange={(e) => setTrackingMode(e.target.value as any)}
            className="px-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-blue-500"
          >
            <option value="none">🔄 No Tracking</option>
            <option value="follow">👤 Follow Me</option>
            <option value="center">🎯 Auto Center</option>
          </select>

          {/* Find My Location */}
          <button
            onClick={centerOnMyLocation}
            className="px-3 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700"
            title="Center map on my location"
          >
            📍 My Location
          </button>

          {/* Fit All Markers */}
          <button
            onClick={fitAllMarkers}
            className="px-3 py-2 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700"
            title="Fit all markers in view"
          >
            🎯 Fit All
          </button>

          {/* Location Toggle */}
          <button
            onClick={toggleLocation}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              watching 
                ? "bg-red-600 text-white hover:bg-red-700" 
                : "bg-green-600 text-white hover:bg-green-700"
            }`}
          >
            {watching ? "🔴 Stop Tracking" : "🟢 Start Tracking"}
          </button>
        </div>
      </div>

      {/* Free Map Benefits */}
      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <h4 className="font-semibold text-green-900 mb-2">✅ 100% Free Mapping Solution</h4>
        <div className="text-green-800 text-sm grid grid-cols-1 md:grid-cols-3 gap-2">
          <div>🌍 OpenStreetMap - No API keys needed</div>
          <div>🎯 High accuracy GPS tracking</div>
          <div>🔄 Unlimited usage</div>
        </div>
      </div>

      {/* Drawing Instructions for Geofence Mode */}
      {mode === 'geofence' && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="font-semibold text-blue-900 mb-2">🎨 Free Drawing Tools</h4>
          <p className="text-blue-800 text-sm">
            Use the drawing tools on the left side of the map to create geofences. 
            Draw polygons, circles, or rectangles, then configure the geofence properties.
          </p>
        </div>
      )}

      {/* Map Container */}
      <div className="relative">
        <div 
          ref={mapContainer} 
          className="h-[600px] rounded-lg overflow-hidden shadow-lg border-2 border-gray-200"
        />
        
        {/* Status Indicator */}
        <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur-sm rounded-lg shadow-lg p-3">
          <div className="flex items-center gap-2 text-sm">
            <div className={`w-3 h-3 rounded-full ${watching ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`}></div>
            <span className="font-medium">
              {watching ? '🎯 Free GPS Active' : '📍 GPS Disabled'}
            </span>
          </div>
        </div>
      </div>

      {/* Geofence Configuration Form */}
      {showGeofenceForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full shadow-2xl">
            <h3 className="text-xl font-bold mb-4">🎯 Configure Free Geofence</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Name</label>
                <input
                  type="text"
                  value={geofenceFormData.name}
                  onChange={(e) => setGeofenceFormData({ ...geofenceFormData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter geofence name"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Type</label>
                <select
                  value={geofenceFormData.type}
                  onChange={(e) => setGeofenceFormData({ ...geofenceFormData, type: e.target.value as any })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="safe_zone">🛡️ Safe Zone</option>
                  <option value="restricted_zone">🚫 Restricted Zone</option>
                  <option value="alert_zone">⚠️ Alert Zone</option>
                </select>
              </div>
              
              <div className="flex items-center space-x-6">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={geofenceFormData.alertOnEntry}
                    onChange={(e) => setGeofenceFormData({ ...geofenceFormData, alertOnEntry: e.target.checked })}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm">🔔 Alert on Entry</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={geofenceFormData.alertOnExit}
                    onChange={(e) => setGeofenceFormData({ ...geofenceFormData, alertOnExit: e.target.checked })}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm">🔔 Alert on Exit</span>
                </label>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                <textarea
                  value={geofenceFormData.description}
                  onChange={(e) => setGeofenceFormData({ ...geofenceFormData, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  placeholder="Optional description"
                />
              </div>
            </div>
            
            <div className="flex gap-3 mt-6">
              <button
                onClick={saveGeofence}
                disabled={!geofenceFormData.name}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium"
              >
                💾 Save Free Geofence
              </button>
              <button
                onClick={() => {
                  setShowGeofenceForm(false);
                  setDrawnFeature(null);
                  drawnItems.current.clearLayers();
                }}
                className="flex-1 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 font-medium"
              >
                ✕ Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Enhanced Status Bar */}
      <div className="bg-gray-50 rounded-lg p-4">
        <div className="flex justify-between items-center text-sm">
          <div className="flex gap-6">
            <span className="flex items-center gap-2">
              <div className="w-3 h-3 bg-blue-600 rounded-full"></div>
              👥 {locations.length} members
            </span>
            <span className="flex items-center gap-2">
              <div className="w-3 h-3 bg-red-600 rounded-full animate-pulse"></div>
              🚨 {alerts.filter(a => Date.now() - a.createdAt < 60000).length} active alerts
            </span>
            <span className="flex items-center gap-2">
              <div className="w-3 h-3 bg-green-600 rounded-full"></div>
              🗺️ {geofences.length} geofences
            </span>
          </div>
          
          <div className="text-xs text-gray-500">
            🆓 Free OpenStreetMap - No API Keys Required
          </div>
        </div>
      </div>
    </div>
  );
}