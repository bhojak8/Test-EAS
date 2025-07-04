import { useEffect, useState, useRef } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";
import { toast } from "sonner";
import mapboxgl from 'mapbox-gl';
import MapboxDraw from '@mapbox/mapbox-gl-draw';
import * as turf from '@turf/turf';
import 'mapbox-gl/dist/mapbox-gl.css';
import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css';

// Set your Mapbox access token here
// You can get a free token at https://account.mapbox.com/
const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN || '';

if (MAPBOX_TOKEN) {
  mapboxgl.accessToken = MAPBOX_TOKEN;
} else {
  console.warn('Mapbox access token not found. Please set VITE_MAPBOX_ACCESS_TOKEN in your .env file');
}

interface MapboxMapProps {
  sessionId: Id<"sessions">;
  mode?: 'view' | 'geofence';
}

interface GeofenceData {
  id: string;
  name: string;
  type: 'safe_zone' | 'restricted_zone' | 'alert_zone';
  geometry: any;
  properties: any;
}

export function MapboxMap({ sessionId, mode = 'view' }: MapboxMapProps) {
  const locations = useQuery(api.locations.getSessionLocations, { sessionId }) || [];
  const alerts = useQuery(api.alerts.getSessionAlerts, { sessionId }) || [];
  const geofences = useQuery(api.geofences.getSessionGeofences, { sessionId }) || [];
  const sessions = useQuery(api.sessions.listSessions) || [];
  const session = sessions.find(s => s && s._id === sessionId);
  const updateLocation = useMutation(api.locations.updateLocation);
  const createGeofence = useMutation(api.geofences.createGeofence);

  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const draw = useRef<MapboxDraw | null>(null);
  const userLocationMarker = useRef<mapboxgl.Marker | null>(null);
  const memberMarkers = useRef<{ [key: string]: mapboxgl.Marker }>({});

  const [watching, setWatching] = useState(false);
  const [mapStyle, setMapStyle] = useState('mapbox://styles/mapbox/streets-v12');
  const [trackingMode, setTrackingMode] = useState<'none' | 'follow' | 'center'>('none');
  const [showGeofenceForm, setShowGeofenceForm] = useState(false);
  const [selectedFeature, setSelectedFeature] = useState<any>(null);
  const [geofenceFormData, setGeofenceFormData] = useState({
    name: '',
    type: 'safe_zone' as const,
    alertOnEntry: true,
    alertOnExit: true,
    description: ''
  });

  // Map styles
  const mapStyles = [
    { id: 'mapbox://styles/mapbox/streets-v12', name: '🗺️ Streets' },
    { id: 'mapbox://styles/mapbox/satellite-streets-v12', name: '🛰️ Satellite' },
    { id: 'mapbox://styles/mapbox/outdoors-v12', name: '🏞️ Outdoors' },
    { id: 'mapbox://styles/mapbox/light-v11', name: '☀️ Light' },
    { id: 'mapbox://styles/mapbox/dark-v11', name: '🌙 Dark' },
    { id: 'mapbox://styles/mapbox/navigation-day-v1', name: '🧭 Navigation' }
  ];

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || !MAPBOX_TOKEN) {
      if (!MAPBOX_TOKEN) {
        toast.error('Mapbox access token is required. Please configure VITE_MAPBOX_ACCESS_TOKEN in your environment variables.');
      }
      return;
    }

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: mapStyle,
      center: [-74.0060, 40.7128], // NYC
      zoom: 10,
      attributionControl: true,
      logoPosition: 'bottom-right'
    });

    // Add navigation controls
    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

    // Add geolocate control
    const geolocate = new mapboxgl.GeolocateControl({
      positionOptions: {
        enableHighAccuracy: true
      },
      trackUserLocation: true,
      showUserHeading: true
    });
    map.current.addControl(geolocate, 'top-right');

    // Add scale control
    map.current.addControl(new mapboxgl.ScaleControl(), 'bottom-left');

    // Add fullscreen control
    map.current.addControl(new mapboxgl.FullscreenControl(), 'top-right');

    // Initialize drawing tools for geofencing mode
    if (mode === 'geofence') {
      draw.current = new MapboxDraw({
        displayControlsDefault: false,
        controls: {
          polygon: true,
          circle: true,
          trash: true
        },
        defaultMode: 'draw_polygon',
        styles: [
          // Polygon fill
          {
            id: 'gl-draw-polygon-fill-inactive',
            type: 'fill',
            filter: ['all', ['==', 'active', 'false'], ['==', '$type', 'Polygon'], ['!=', 'mode', 'static']],
            paint: {
              'fill-color': '#3bb2d0',
              'fill-outline-color': '#3bb2d0',
              'fill-opacity': 0.1
            }
          },
          // Polygon stroke
          {
            id: 'gl-draw-polygon-stroke-inactive',
            type: 'line',
            filter: ['all', ['==', 'active', 'false'], ['==', '$type', 'Polygon'], ['!=', 'mode', 'static']],
            layout: {
              'line-cap': 'round',
              'line-join': 'round'
            },
            paint: {
              'line-color': '#3bb2d0',
              'line-width': 3
            }
          },
          // Active polygon fill
          {
            id: 'gl-draw-polygon-fill-active',
            type: 'fill',
            filter: ['all', ['==', 'active', 'true'], ['==', '$type', 'Polygon']],
            paint: {
              'fill-color': '#fbb03b',
              'fill-outline-color': '#fbb03b',
              'fill-opacity': 0.1
            }
          },
          // Active polygon stroke
          {
            id: 'gl-draw-polygon-stroke-active',
            type: 'line',
            filter: ['all', ['==', 'active', 'true'], ['==', '$type', 'Polygon']],
            layout: {
              'line-cap': 'round',
              'line-join': 'round'
            },
            paint: {
              'line-color': '#fbb03b',
              'line-width': 3
            }
          }
        ]
      });

      map.current.addControl(draw.current, 'top-left');

      // Handle drawing events
      map.current.on('draw.create', handleDrawCreate);
      map.current.on('draw.update', handleDrawUpdate);
      map.current.on('draw.delete', handleDrawDelete);
    }

    map.current.on('load', () => {
      console.log('Mapbox map loaded successfully!');
      toast.success('🗺️ Advanced map loaded with high accuracy!');
      
      // Add geofence layers
      addGeofenceLayers();
    });

    const mapInstance = map.current;
    return () => {
      if (mapInstance) {
        mapInstance.remove();
        map.current = null;
      }
    };
  }, [mode]);

  // Handle map style changes
  useEffect(() => {
    if (map.current) {
      map.current.setStyle(mapStyle);
    }
  }, [mapStyle]);

  // Add geofence layers to map
  const addGeofenceLayers = () => {
    if (!map.current) return;

    // Add geofence source
    if (!map.current.getSource('geofences')) {
      map.current.addSource('geofences', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: []
        }
      });

      // Add geofence fill layer
      map.current.addLayer({
        id: 'geofences-fill',
        type: 'fill',
        source: 'geofences',
        paint: {
          'fill-color': [
            'case',
            ['==', ['get', 'type'], 'safe_zone'], '#10b981',
            ['==', ['get', 'type'], 'restricted_zone'], '#ef4444',
            ['==', ['get', 'type'], 'alert_zone'], '#f59e0b',
            '#6b7280'
          ],
          'fill-opacity': 0.3
        }
      });

      // Add geofence border layer
      map.current.addLayer({
        id: 'geofences-border',
        type: 'line',
        source: 'geofences',
        paint: {
          'line-color': [
            'case',
            ['==', ['get', 'type'], 'safe_zone'], '#059669',
            ['==', ['get', 'type'], 'restricted_zone'], '#dc2626',
            ['==', ['get', 'type'], 'alert_zone'], '#d97706',
            '#4b5563'
          ],
          'line-width': 3,
          'line-opacity': 0.8
        }
      });

      // Add click handler for geofences
      map.current.on('click', 'geofences-fill', (e) => {
        if (e.features && e.features[0]) {
          const feature = e.features[0];
          new mapboxgl.Popup()
            .setLngLat(e.lngLat)
            .setHTML(`
              <div class="p-3">
                <h3 class="font-semibold">${feature.properties?.name}</h3>
                <p class="text-sm text-gray-600">${feature.properties?.type?.replace('_', ' ').toUpperCase()}</p>
                ${feature.properties?.description ? `<p class="text-xs mt-1">${feature.properties.description}</p>` : ''}
              </div>
            `)
            .addTo(map.current!);
        }
      });

      // Change cursor on hover
      map.current.on('mouseenter', 'geofences-fill', () => {
        if (map.current) {
          map.current.getCanvas().style.cursor = 'pointer';
        }
      });

      map.current.on('mouseleave', 'geofences-fill', () => {
        if (map.current) {
          map.current.getCanvas().style.cursor = '';
        }
      });
    }
  };

  // Update geofences on map
  useEffect(() => {
    if (!map.current || !map.current.getSource('geofences')) return;

    const geofenceFeatures = geofences.map(geofence => {
      let geometry;
      
      if (geofence.shape === 'circle' && geofence.center && geofence.radius) {
        // Convert circle to polygon using Turf.js
        const center = [geofence.center.lng, geofence.center.lat];
        const circle = turf.circle(center, geofence.radius / 1000, { units: 'kilometers' });
        geometry = circle.geometry;
      } else if (geofence.shape === 'polygon' && geofence.coordinates) {
        geometry = {
          type: 'Polygon',
          coordinates: [geofence.coordinates.map(coord => [coord.lng, coord.lat])]
        };
      }

      return {
        type: 'Feature',
        id: geofence._id,
        geometry,
        properties: {
          name: geofence.name,
          type: geofence.type,
          description: geofence.description,
          alertOnEntry: geofence.alertOnEntry,
          alertOnExit: geofence.alertOnExit
        }
      };
    }).filter(f => f.geometry);

    (map.current.getSource('geofences') as mapboxgl.GeoJSONSource).setData({
      type: 'FeatureCollection',
      features: geofenceFeatures
    });
  }, [geofences]);

  // Update member markers
  useEffect(() => {
    if (!map.current) return;

    // Clear existing markers
    Object.values(memberMarkers.current).forEach(marker => marker.remove());
    memberMarkers.current = {};

    // Add markers for each member
    locations.forEach(member => {
      if (member.location) {
        const recentAlert = alerts.find(alert => 
          alert.createdBy === member.userId && 
          Date.now() - alert.createdAt < 60000
        );

        const alertType = recentAlert && session?.alertTypes?.find(t => t.id === recentAlert.type);
        const isOffline = member.lastSeen && Date.now() - member.lastSeen > 300000;

        // Create custom marker element
        const el = document.createElement('div');
        el.className = 'member-marker';
        el.style.cssText = `
          width: 40px;
          height: 40px;
          border-radius: 50%;
          border: 3px solid white;
          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: bold;
          font-size: 12px;
          color: white;
          cursor: pointer;
          background: ${
            isOffline ? '#6b7280' :
            recentAlert ? '#dc2626' : '#2563eb'
          };
          ${recentAlert ? 'animation: pulse 2s infinite;' : ''}
        `;
        
        const initials = member.name
          .split(' ')
          .map(part => part[0])
          .join('')
          .toUpperCase();
        
        el.textContent = initials;

        // Create marker
        const marker = new mapboxgl.Marker(el)
          .setLngLat([member.location.lng, member.location.lat])
          .addTo(map.current!);

        // Add popup
        const popup = new mapboxgl.Popup({ offset: 25 })
          .setHTML(`
            <div class="p-3">
              <h3 class="font-semibold text-lg">${member.name}</h3>
              <p class="text-sm text-gray-600">${member.role}</p>
              ${recentAlert ? `<p class="text-sm text-red-600">${alertType?.emoji} ${alertType?.label}</p>` : ''}
              ${isOffline ? '<p class="text-sm text-gray-500">📴 Offline</p>' : ''}
              <div class="mt-2 space-y-1">
                <p class="text-xs text-gray-500">📍 ${member.location.lat.toFixed(6)}, ${member.location.lng.toFixed(6)}</p>
                ${member.accuracy ? `<p class="text-xs text-gray-500">🎯 Accuracy: ±${member.accuracy}m</p>` : ''}
                ${member.lastSeen ? `<p class="text-xs text-gray-500">⏰ ${new Date(member.lastSeen).toLocaleTimeString()}</p>` : ''}
              </div>
            </div>
          `);

        marker.setPopup(popup);
        memberMarkers.current[member.userId] = marker;
      }
    });

    // Auto-fit bounds if tracking mode is center
    if (trackingMode === 'center' && locations.length > 0) {
      const bounds = new mapboxgl.LngLatBounds();
      locations.forEach(member => {
        if (member.location) {
          bounds.extend([member.location.lng, member.location.lat]);
        }
      });
      
      if (!bounds.isEmpty()) {
        map.current.fitBounds(bounds, { padding: 50 });
      }
    }
  }, [locations, alerts, session?.alertTypes, trackingMode]);

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

          // Update user location marker
          if (map.current) {
            if (userLocationMarker.current) {
              userLocationMarker.current.remove();
            }

            // Create pulsing user location marker
            const el = document.createElement('div');
            el.className = 'user-location-marker';
            el.style.cssText = `
              width: 20px;
              height: 20px;
              border-radius: 50%;
              background: #3b82f6;
              border: 3px solid white;
              box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.7);
              animation: pulse 2s infinite;
            `;

            userLocationMarker.current = new mapboxgl.Marker(el)
              .setLngLat([position.coords.longitude, position.coords.latitude])
              .addTo(map.current);

            // Follow user if tracking mode is enabled
            if (trackingMode === 'follow') {
              map.current.easeTo({
                center: [position.coords.longitude, position.coords.latitude],
                zoom: 16,
                duration: 1000
              });
            }
          }

          // Check geofence violations
          checkGeofenceViolations(position.coords.latitude, position.coords.longitude);
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
        timeout: 10000,
        maximumAge: 5000
      }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [sessionId, watching, updateLocation, trackingMode]);

  // Check geofence violations
  const checkGeofenceViolations = (lat: number, lng: number) => {
    geofences.forEach(geofence => {
      let isInside = false;

      if (geofence.shape === 'circle' && geofence.center && geofence.radius) {
        const distance = turf.distance(
          [lng, lat],
          [geofence.center.lng, geofence.center.lat],
          { units: 'meters' }
        );
        isInside = distance <= geofence.radius;
      } else if (geofence.shape === 'polygon' && geofence.coordinates) {
        const point = turf.point([lng, lat]);
        const polygon = turf.polygon([geofence.coordinates.map(coord => [coord.lng, coord.lat])]);
        isInside = turf.booleanPointInPolygon(point, polygon);
      }

      // Handle geofence events (you can expand this logic)
      if (isInside && geofence.type === 'restricted_zone') {
        toast.error(`🚨 Entered restricted zone: ${geofence.name}`);
      } else if (isInside && geofence.type === 'safe_zone') {
        toast.success(`✅ Entered safe zone: ${geofence.name}`);
      }
    });
  };

  // Drawing event handlers
  const handleDrawCreate = (e: any) => {
    const feature = e.features[0];
    setSelectedFeature(feature);
    setShowGeofenceForm(true);
    toast.info('🎯 Geofence drawn! Configure and save it.');
  };

  const handleDrawUpdate = (e: any) => {
    console.log('Feature updated:', e.features[0]);
  };

  const handleDrawDelete = (e: any) => {
    console.log('Feature deleted:', e.features[0]);
    toast.info('Geofence deleted');
  };

  // Save geofence
  const saveGeofence = async () => {
    if (!selectedFeature || !geofenceFormData.name) {
      toast.error('Please provide a name for the geofence');
      return;
    }

    try {
      const geometry = selectedFeature.geometry;
      let geofenceData: any = {
        sessionId,
        name: geofenceFormData.name,
        type: geofenceFormData.type,
        alertOnEntry: geofenceFormData.alertOnEntry,
        alertOnExit: geofenceFormData.alertOnExit,
        description: geofenceFormData.description,
      };

      if (geometry.type === 'Polygon') {
        geofenceData.shape = 'polygon';
        geofenceData.coordinates = geometry.coordinates[0].map((coord: number[]) => ({
          lat: coord[1],
          lng: coord[0]
        }));
      }

      await createGeofence(geofenceData);
      
      // Clear the drawing
      if (draw.current) {
        draw.current.deleteAll();
      }
      
      setShowGeofenceForm(false);
      setSelectedFeature(null);
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
      setWatching(true);
      toast.success('🎯 High-accuracy location tracking enabled!');
    } else {
      setWatching(false);
      if (userLocationMarker.current) {
        userLocationMarker.current.remove();
        userLocationMarker.current = null;
      }
      toast.success('Location tracking disabled');
    }
  };

  // Show token configuration message if no token is available
  if (!MAPBOX_TOKEN) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="text-center py-12">
          <div className="text-6xl mb-4">🗺️</div>
          <h3 className="text-2xl font-bold text-gray-800 mb-4">Mapbox Configuration Required</h3>
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 max-w-2xl mx-auto">
            <p className="text-yellow-800 mb-4">
              To use the advanced mapping features, you need to configure a Mapbox access token.
            </p>
            <div className="text-left space-y-3">
              <p className="font-semibold text-yellow-900">Setup Instructions:</p>
              <ol className="list-decimal list-inside space-y-2 text-sm text-yellow-800">
                <li>Visit <a href="https://account.mapbox.com/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">https://account.mapbox.com/</a> and create a free account</li>
                <li>Navigate to your account dashboard and create a new access token</li>
                <li>Copy the public access token (starts with "pk.")</li>
                <li>Add it to your <code className="bg-yellow-100 px-2 py-1 rounded">.env.local</code> file as:</li>
              </ol>
              <div className="bg-gray-800 text-green-400 p-3 rounded font-mono text-sm mt-3">
                VITE_MAPBOX_ACCESS_TOKEN=your_token_here
              </div>
              <p className="text-xs text-yellow-700 mt-2">
                Note: Mapbox provides 50,000 free map loads per month, which is generous for most applications.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-lg p-6 space-y-4">
      {/* Enhanced Controls */}
      <div className="flex justify-between items-center flex-wrap gap-4">
        <h3 className="text-2xl font-bold text-gray-800">
          {mode === 'geofence' ? '🗺️ Geofence Designer' : '📍 Live Team Map'}
        </h3>
        
        <div className="flex gap-2 flex-wrap">
          {/* Map Style Selector */}
          <select
            value={mapStyle}
            onChange={(e) => setMapStyle(e.target.value)}
            className="px-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-blue-500"
          >
            {mapStyles.map(style => (
              <option key={style.id} value={style.id}>
                {style.name}
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

      {/* Drawing Instructions for Geofence Mode */}
      {mode === 'geofence' && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="font-semibold text-blue-900 mb-2">🎨 Drawing Tools</h4>
          <p className="text-blue-800 text-sm">
            Use the drawing tools on the left side of the map to create geofences. 
            Click and drag to draw polygons, then configure the geofence properties.
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
              {watching ? '🎯 High Accuracy GPS' : '📍 GPS Disabled'}
            </span>
          </div>
        </div>
      </div>

      {/* Geofence Configuration Form */}
      {showGeofenceForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full shadow-2xl">
            <h3 className="text-xl font-bold mb-4">🎯 Configure Geofence</h3>
            
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
                💾 Save Geofence
              </button>
              <button
                onClick={() => {
                  setShowGeofenceForm(false);
                  setSelectedFeature(null);
                  if (draw.current) {
                    draw.current.deleteAll();
                  }
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
            🎯 Mapbox GL JS - High Accuracy GPS
          </div>
        </div>
      </div>
    </div>
  );
}