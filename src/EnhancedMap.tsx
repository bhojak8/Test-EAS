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

interface MapProvider {
  id: string;
  name: string;
  url: string;
  attribution: string;
  maxZoom?: number;
}

const MAP_PROVIDERS: MapProvider[] = [
  {
    id: 'osm',
    name: '🗺️ OpenStreetMap',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  },
  {
    id: 'satellite',
    name: '🛰️ Satellite',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
  },
  {
    id: 'terrain',
    name: '🏔️ Terrain',
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution: 'Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, <a href="http://viewfinderpanoramas.org">SRTM</a> | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a>'
  },
  {
    id: 'dark',
    name: '🌙 Dark Mode',
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
  },
  {
    id: 'google-satellite',
    name: '🌍 Google Satellite',
    url: 'https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
    attribution: '&copy; Google'
  },
  {
    id: 'google-hybrid',
    name: '🗺️ Google Hybrid',
    url: 'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
    attribution: '&copy; Google'
  },
  {
    id: 'google-terrain',
    name: '🏞️ Google Terrain',
    url: 'https://mt1.google.com/vt/lyrs=p&x={x}&y={y}&z={z}',
    attribution: '&copy; Google'
  }
];

interface GeoSensorData {
  accuracy: number;
  altitude?: number;
  altitudeAccuracy?: number;
  heading?: number;
  speed?: number;
  timestamp: number;
}

interface WeatherData {
  temperature: number;
  humidity: number;
  pressure: number;
  windSpeed: number;
  windDirection: number;
  description: string;
  icon: string;
}

function getInitials(name: string) {
  return name
    .split(' ')
    .map(part => part[0])
    .join('')
    .toUpperCase();
}

function createAdvancedIcon(
  name: string, 
  alertStatus: 'none' | 'active' | 'acknowledged' = 'none', 
  isOffline?: boolean,
  sensorData?: GeoSensorData
) {
  const initials = getInitials(name);
  let color = '#2563eb';
  
  if (isOffline) {
    color = '#6b7280';
  } else if (alertStatus === 'active') {
    color = '#dc2626';
  } else if (alertStatus === 'acknowledged') {
    color = '#059669';
  }
  
  const accuracyIndicator = sensorData?.accuracy ? 
    (sensorData.accuracy < 10 ? '🎯' : sensorData.accuracy < 50 ? '📍' : '📌') : '📍';
  
  const speedIndicator = sensorData?.speed && sensorData.speed > 1 ? 
    `<text x="40" y="10" text-anchor="middle" fill="white" font-size="8">${Math.round(sensorData.speed * 3.6)}km/h</text>` : '';
  
  const svgIcon = `
    <svg width="60" height="60" viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg">
      <circle cx="30" cy="30" r="25" fill="${color}" opacity="0.2"/>
      <circle cx="30" cy="30" r="18" fill="${color}" stroke="white" stroke-width="3"/>
      <text x="30" y="35" text-anchor="middle" fill="white" font-size="12" font-weight="bold">${initials}</text>
      ${speedIndicator}
      <text x="30" y="50" text-anchor="middle" fill="${color}" font-size="10">${accuracyIndicator}</text>
      ${alertStatus === 'active' ? '<circle cx="45" cy="15" r="6" fill="#fbbf24" stroke="white" stroke-width="2"/>' : ''}
      ${isOffline ? '<circle cx="45" cy="15" r="6" fill="#374151" stroke="white" stroke-width="2"/>' : ''}
    </svg>
  `;

  return L.divIcon({
    html: svgIcon,
    className: 'custom-marker advanced-marker',
    iconSize: [60, 60],
    iconAnchor: [30, 30],
    popupAnchor: [0, -30]
  });
}

export function EnhancedMap({ sessionId }: { sessionId: Id<"sessions"> }) {
  const locations = useQuery(api.locations.getSessionLocations, { sessionId }) || [];
  const alerts = useQuery(api.alerts.getSessionAlerts, { sessionId }) || [];
  const sessions = useQuery(api.sessions.listSessions) || [];
  const session = sessions.find(s => s && s._id === sessionId);
  const updateLocation = useMutation(api.locations.updateLocation);
  
  const [watching, setWatching] = useState(false);
  const [currentProvider, setCurrentProvider] = useState('osm');
  const [geoSensorData, setGeoSensorData] = useState<GeoSensorData | null>(null);
  const [weatherData, setWeatherData] = useState<WeatherData | null>(null);
  const [showWeather, setShowWeather] = useState(false);
  const [trackingMode, setTrackingMode] = useState<'none' | 'follow' | 'center'>('none');
  const [showSensorPanel, setShowSensorPanel] = useState(false);
  const [compassHeading, setCompassHeading] = useState<number | null>(null);
  
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const markers = useRef<{ [key: string]: L.Marker }>({});
  const tileLayer = useRef<L.TileLayer | null>(null);
  const weatherLayer = useRef<L.TileLayer | null>(null);
  const userLocationMarker = useRef<L.Marker | null>(null);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current) return;

    map.current = L.map(mapContainer.current, {
      zoomControl: true,
      attributionControl: true,
    }).setView([40.7128, -74.0060], 10);

    // Add initial tile layer
    const provider = MAP_PROVIDERS.find(p => p.id === currentProvider) || MAP_PROVIDERS[0];
    tileLayer.current = L.tileLayer(provider.url, {
      attribution: provider.attribution,
      maxZoom: provider.maxZoom || 18
    }).addTo(map.current);

    const mapInstance = map.current;
    return () => {
      mapInstance.remove();
      map.current = null;
    };
  }, []);

  // Handle map provider changes
  useEffect(() => {
    if (!map.current) return;

    const provider = MAP_PROVIDERS.find(p => p.id === currentProvider) || MAP_PROVIDERS[0];

    // Remove old tile layer
    if (tileLayer.current) {
      map.current.removeLayer(tileLayer.current);
    }

    // Add new tile layer
    tileLayer.current = L.tileLayer(provider.url, {
      attribution: provider.attribution,
      maxZoom: provider.maxZoom || 18
    }).addTo(map.current);
  }, [currentProvider]);

  // Enhanced geolocation with sensor data
  useEffect(() => {
    if (!watching) return;

    const watchId = navigator.geolocation.watchPosition(
      async (position) => {
        const sensorData: GeoSensorData = {
          accuracy: position.coords.accuracy,
          altitude: position.coords.altitude || undefined,
          altitudeAccuracy: position.coords.altitudeAccuracy || undefined,
          heading: position.coords.heading || undefined,
          speed: position.coords.speed || undefined,
          timestamp: position.timestamp
        };

        setGeoSensorData(sensorData);

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
              map.current.removeLayer(userLocationMarker.current);
            }

            userLocationMarker.current = L.marker(
              [position.coords.latitude, position.coords.longitude],
              {
                icon: L.divIcon({
                  html: `
                    <div class="user-location-marker">
                      <div class="pulse-ring"></div>
                      <div class="user-dot"></div>
                    </div>
                  `,
                  className: 'user-location-icon',
                  iconSize: [20, 20],
                  iconAnchor: [10, 10]
                })
              }
            ).addTo(map.current);

            // Follow user location if tracking mode is enabled
            if (trackingMode === 'follow') {
              map.current.setView([position.coords.latitude, position.coords.longitude], 16);
            }
          }

          // Fetch weather data for current location
          if (showWeather) {
            fetchWeatherData(position.coords.latitude, position.coords.longitude);
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
        timeout: 10000,
        maximumAge: 5000
      }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [sessionId, watching, updateLocation, trackingMode, showWeather]);

  // Device orientation/compass
  useEffect(() => {
    if (!watching) return;

    const handleOrientation = (event: DeviceOrientationEvent) => {
      if (event.alpha !== null) {
        setCompassHeading(event.alpha);
      }
    };

    if (window.DeviceOrientationEvent) {
      window.addEventListener('deviceorientation', handleOrientation);
      return () => window.removeEventListener('deviceorientation', handleOrientation);
    }
  }, [watching]);

  // Fetch weather data
  const fetchWeatherData = async (lat: number, lng: number) => {
    try {
      // Using OpenWeatherMap API (you'd need to add your API key)
      const response = await fetch(
        `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lng}&appid=YOUR_API_KEY&units=metric`
      );
      
      if (response.ok) {
        const data = await response.json();
        setWeatherData({
          temperature: data.main.temp,
          humidity: data.main.humidity,
          pressure: data.main.pressure,
          windSpeed: data.wind.speed,
          windDirection: data.wind.deg,
          description: data.weather[0].description,
          icon: data.weather[0].icon
        });
      }
    } catch (error) {
      console.error("Failed to fetch weather data:", error);
    }
  };

  // Add weather overlay
  const toggleWeatherOverlay = () => {
    if (!map.current) return;

    if (weatherLayer.current) {
      map.current.removeLayer(weatherLayer.current);
      weatherLayer.current = null;
      setShowWeather(false);
    } else {
      // Add weather radar overlay
      weatherLayer.current = L.tileLayer(
        'https://tile.openweathermap.org/map/precipitation_new/{z}/{x}/{y}.png?appid=YOUR_API_KEY',
        {
          attribution: 'Weather data © OpenWeatherMap',
          opacity: 0.6
        }
      ).addTo(map.current);
      setShowWeather(true);
    }
  };

  // Update markers with enhanced sensor data
  useEffect(() => {
    if (!map.current) return;

    // Clear old markers
    Object.values(markers.current).forEach(marker => marker.remove());
    markers.current = {};

    // Add markers for all locations
    locations.forEach(member => {
      if (member.location) {
        const recentAlert = alerts.find(alert => 
          alert.createdBy === member.userId && 
          Date.now() - alert.createdAt < 60000
        );

        const alertType = recentAlert && session?.alertTypes?.find(t => t.id === recentAlert.type);
        const isOffline = member.lastSeen && Date.now() - member.lastSeen > 300000;
        
        let alertStatus: 'none' | 'active' | 'acknowledged' = 'none';
        if (recentAlert) {
          if (recentAlert.acknowledged.length === 0) {
            alertStatus = 'active';
          } else if (recentAlert.acknowledged.length > 0) {
            alertStatus = 'acknowledged';
          }
        }

        const marker = L.marker([member.location.lat, member.location.lng], {
          icon: createAdvancedIcon(member.name, alertStatus, !!isOffline, geoSensorData || undefined)
        }).addTo(map.current!);

        // Enhanced popup with sensor data
        const popupContent = `
          <div class="p-3 min-w-[250px]">
            <h3 class="font-semibold text-lg">${member.name}</h3>
            <p class="text-sm text-gray-600">${member.role}</p>
            ${recentAlert ? `<p class="text-sm text-red-600">${alertType?.emoji} ${alertType?.label}</p>` : ''}
            ${isOffline ? '<p class="text-sm text-gray-500">📴 Offline</p>' : ''}
            
            <div class="mt-2 space-y-1">
              <p class="text-xs text-gray-500">📍 ${member.location.lat.toFixed(6)}, ${member.location.lng.toFixed(6)}</p>
              ${member.accuracy ? `<p class="text-xs text-gray-500">🎯 Accuracy: ±${member.accuracy}m</p>` : ''}
              ${member.lastSeen ? `<p class="text-xs text-gray-500">⏰ ${new Date(member.lastSeen).toLocaleTimeString()}</p>` : ''}
            </div>

            ${weatherData && showWeather ? `
              <div class="mt-2 p-2 bg-blue-50 rounded">
                <p class="text-xs font-medium text-blue-800">🌤️ Weather</p>
                <p class="text-xs text-blue-700">${weatherData.temperature}°C, ${weatherData.description}</p>
                <p class="text-xs text-blue-700">💨 ${weatherData.windSpeed} m/s</p>
              </div>
            ` : ''}
          </div>
        `;

        marker.bindPopup(popupContent);
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
  }, [locations, alerts, session?.alertTypes, trackingMode, geoSensorData, weatherData, showWeather]);

  const toggleLocation = () => {
    if (!watching) {
      if (!navigator.geolocation) {
        toast.error("Geolocation not supported");
        return;
      }
      setWatching(true);
      toast.success("Enhanced location tracking enabled");
    } else {
      setWatching(false);
      setGeoSensorData(null);
      setCompassHeading(null);
      if (userLocationMarker.current && map.current) {
        map.current.removeLayer(userLocationMarker.current);
        userLocationMarker.current = null;
      }
      toast.success("Location tracking disabled");
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-lg p-6 space-y-4">
      {/* Enhanced Controls */}
      <div className="flex justify-between items-center flex-wrap gap-4">
        <h3 className="text-2xl font-bold text-gray-800">🗺️ Enhanced Emergency Map</h3>
        
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

          {/* Weather Toggle */}
          <button
            onClick={toggleWeatherOverlay}
            className={`px-3 py-2 rounded-lg text-sm font-medium ${
              showWeather 
                ? "bg-blue-600 text-white hover:bg-blue-700" 
                : "bg-gray-200 text-gray-700 hover:bg-gray-300"
            }`}
          >
            🌤️ Weather
          </button>

          {/* Sensor Panel Toggle */}
          <button
            onClick={() => setShowSensorPanel(!showSensorPanel)}
            className={`px-3 py-2 rounded-lg text-sm font-medium ${
              showSensorPanel 
                ? "bg-green-600 text-white hover:bg-green-700" 
                : "bg-gray-200 text-gray-700 hover:bg-gray-300"
            }`}
          >
            📊 Sensors
          </button>

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

          {/* Enhanced Location Toggle */}
          <button
            onClick={toggleLocation}
            className={`px-4 py-2 rounded-lg font-medium ${
              watching 
                ? "bg-red-600 text-white hover:bg-red-700 emergency-pulse" 
                : "bg-green-600 text-white hover:bg-green-700"
            }`}
          >
            {watching ? "🔴 Stop Tracking" : "🟢 Start Tracking"}
          </button>
        </div>
      </div>

      {/* Sensor Data Panel */}
      {showSensorPanel && geoSensorData && (
        <div className="bg-gradient-to-r from-blue-50 to-green-50 rounded-lg p-4 border border-blue-200">
          <h4 className="font-semibold text-gray-800 mb-3">📊 Live Sensor Data</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div className="bg-white p-3 rounded-lg shadow-sm">
              <div className="text-blue-600 font-medium">🎯 Accuracy</div>
              <div className="text-lg font-bold">±{geoSensorData.accuracy.toFixed(1)}m</div>
            </div>
            
            {geoSensorData.speed !== undefined && (
              <div className="bg-white p-3 rounded-lg shadow-sm">
                <div className="text-green-600 font-medium">🚀 Speed</div>
                <div className="text-lg font-bold">{(geoSensorData.speed * 3.6).toFixed(1)} km/h</div>
              </div>
            )}
            
            {geoSensorData.altitude !== undefined && (
              <div className="bg-white p-3 rounded-lg shadow-sm">
                <div className="text-purple-600 font-medium">⛰️ Altitude</div>
                <div className="text-lg font-bold">{geoSensorData.altitude.toFixed(1)}m</div>
              </div>
            )}
            
            {compassHeading !== null && (
              <div className="bg-white p-3 rounded-lg shadow-sm">
                <div className="text-orange-600 font-medium">🧭 Heading</div>
                <div className="text-lg font-bold">{compassHeading.toFixed(0)}°</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Weather Data Panel */}
      {showWeather && weatherData && (
        <div className="bg-gradient-to-r from-blue-50 to-cyan-50 rounded-lg p-4 border border-blue-200">
          <h4 className="font-semibold text-gray-800 mb-3">🌤️ Weather Conditions</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div className="bg-white p-3 rounded-lg shadow-sm">
              <div className="text-red-600 font-medium">🌡️ Temperature</div>
              <div className="text-lg font-bold">{weatherData.temperature}°C</div>
            </div>
            <div className="bg-white p-3 rounded-lg shadow-sm">
              <div className="text-blue-600 font-medium">💧 Humidity</div>
              <div className="text-lg font-bold">{weatherData.humidity}%</div>
            </div>
            <div className="bg-white p-3 rounded-lg shadow-sm">
              <div className="text-green-600 font-medium">💨 Wind</div>
              <div className="text-lg font-bold">{weatherData.windSpeed} m/s</div>
            </div>
            <div className="bg-white p-3 rounded-lg shadow-sm">
              <div className="text-purple-600 font-medium">📊 Pressure</div>
              <div className="text-lg font-bold">{weatherData.pressure} hPa</div>
            </div>
          </div>
        </div>
      )}

      {/* Map Container */}
      <div className="relative">
        <div className="h-[600px] rounded-lg overflow-hidden shadow-lg border-2 border-gray-200" ref={mapContainer} />
        
        {/* Floating Controls */}
        <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm rounded-lg shadow-lg p-2 space-y-2">
          <button
            onClick={() => {
              if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(
                  (pos) => {
                    if (map.current) {
                      map.current.setView([pos.coords.latitude, pos.coords.longitude], 16);
                      toast.success("Centered on your location");
                    }
                  },
                  () => toast.error("Failed to get location")
                );
              }
            }}
            className="block w-10 h-10 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-md transition-colors"
            title="Center on my location"
          >
            📍
          </button>
          
          <button
            onClick={() => map.current?.zoomIn()}
            className="block w-10 h-10 bg-white hover:bg-gray-100 text-gray-700 rounded-lg shadow-md border font-bold"
          >
            +
          </button>
          
          <button
            onClick={() => map.current?.zoomOut()}
            className="block w-10 h-10 bg-white hover:bg-gray-100 text-gray-700 rounded-lg shadow-md border font-bold"
          >
            −
          </button>
        </div>

        {/* Compass Indicator */}
        {compassHeading !== null && watching && (
          <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-sm rounded-lg shadow-lg p-3">
            <div className="text-center">
              <div 
                className="text-2xl transform transition-transform duration-300"
                style={{ transform: `rotate(${compassHeading}deg)` }}
              >
                🧭
              </div>
              <div className="text-xs font-medium text-gray-600 mt-1">
                {compassHeading.toFixed(0)}°
              </div>
            </div>
          </div>
        )}
      </div>

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
            {geoSensorData && (
              <span className="flex items-center gap-2">
                <div className="w-3 h-3 bg-green-600 rounded-full"></div>
                🎯 ±{geoSensorData.accuracy.toFixed(1)}m accuracy
              </span>
            )}
          </div>
          
          <div className="text-xs text-gray-500">
            Provider: {MAP_PROVIDERS.find(p => p.id === currentProvider)?.name}
          </div>
        </div>
      </div>
    </div>
  );
}