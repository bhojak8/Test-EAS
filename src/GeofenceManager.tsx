import { useState, useRef, useEffect } from "react";
import { useMutation, useQuery } from "convex/react";
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

type GeofenceType = "safe_zone" | "restricted_zone" | "alert_zone";
type GeofenceShape = "circle" | "polygon";
type DrawingTool = "none" | "circle" | "polygon";

interface GeofenceFormData {
  name: string;
  type: GeofenceType;
  shape: GeofenceShape;
  radius: number;
  alertOnEntry: boolean;
  alertOnExit: boolean;
  description: string;
}

export function GeofenceManager({ sessionId }: { sessionId: Id<"sessions"> }) {
  const geofences = useQuery(api.geofences.getSessionGeofences, { sessionId }) || [];
  const createGeofence = useMutation(api.geofences.createGeofence);
  const updateGeofence = useMutation(api.geofences.updateGeofence);
  const deleteGeofence = useMutation(api.geofences.deleteGeofence);
  const bulkUpdateGeofences = useMutation(api.geofences.bulkUpdateGeofences);

  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const geofenceLayers = useRef<{ [key: string]: L.Layer }>({});
  const drawingLayer = useRef<L.Layer | null>(null);
  const tileLayer = useRef<L.TileLayer | null>(null);

  const [activeTab, setActiveTab] = useState<'create' | 'manage' | 'analytics'>('create');
  const [drawingTool, setDrawingTool] = useState<DrawingTool>('none');
  const [isDrawing, setIsDrawing] = useState(false);
  const [polygonPoints, setPolygonPoints] = useState<Array<{ lat: number; lng: number }>>([]);
  const [circleCenter, setCircleCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [circleRadius, setCircleRadius] = useState(100);
  const [tempGeofence, setTempGeofence] = useState<any>(null);
  const [selectedGeofences, setSelectedGeofences] = useState<Set<Id<"geofences">>>(new Set());
  const [showDrawingPanel, setShowDrawingPanel] = useState(false);

  const [formData, setFormData] = useState<GeofenceFormData>({
    name: "",
    type: "safe_zone",
    shape: "circle",
    radius: 100,
    alertOnEntry: true,
    alertOnExit: true,
    description: "",
  });

  const [editingGeofence, setEditingGeofence] = useState<Id<"geofences"> | null>(null);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    console.log("Initializing geofence map...");

    map.current = L.map(mapContainer.current, {
      zoomControl: true,
      attributionControl: true,
      doubleClickZoom: false, // Disable to prevent interference with drawing
    }).setView([40.7128, -74.0060], 12);

    // Add tile layer
    tileLayer.current = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    });
    
    tileLayer.current.addTo(map.current);

    // Setup drawing event handlers
    setupDrawingHandlers();

    toast.success("Geofence map initialized! Ready to draw zones.");

    const mapInstance = map.current;
    return () => {
      if (mapInstance) {
        mapInstance.remove();
        map.current = null;
      }
    };
  }, []);

  const setupDrawingHandlers = () => {
    if (!map.current) return;

    console.log("Setting up drawing handlers...");

    // Remove any existing event listeners
    map.current.off('click');
    map.current.off('mousemove');
    map.current.off('dblclick');

    // Add drawing event handlers
    map.current.on('click', handleMapClick);
    map.current.on('mousemove', handleMapMouseMove);
    map.current.on('dblclick', handleMapDoubleClick);
  };

  const handleMapClick = (e: L.LeafletMouseEvent) => {
    console.log("Map clicked:", e.latlng, "Drawing tool:", drawingTool);
    
    if (drawingTool === 'none') return;

    const point = { lat: e.latlng.lat, lng: e.latlng.lng };

    switch (drawingTool) {
      case 'circle':
        handleCircleDrawing(point);
        break;
      case 'polygon':
        handlePolygonDrawing(point);
        break;
    }
  };

  const handleMapMouseMove = (e: L.LeafletMouseEvent) => {
    if (drawingTool === 'circle' && circleCenter && isDrawing) {
      updateCirclePreview(e.latlng);
    }
  };

  const handleMapDoubleClick = (e: L.LeafletMouseEvent) => {
    console.log("Map double-clicked");
    e.originalEvent.preventDefault();
    if (drawingTool === 'polygon' && polygonPoints.length >= 3) {
      finishPolygonDrawing();
    }
  };

  const handleCircleDrawing = (point: { lat: number; lng: number }) => {
    console.log("Circle drawing:", point, "Center:", circleCenter);
    
    if (!circleCenter) {
      // First click - set center
      setCircleCenter(point);
      setIsDrawing(true);
      
      // Create initial circle preview
      const preview = L.circle([point.lat, point.lng], {
        radius: circleRadius,
        color: '#2563eb',
        fillColor: '#3b82f6',
        fillOpacity: 0.35,
        weight: 4,
        opacity: 0.9,
        dashArray: '8, 4'
      });
      
      if (map.current) {
        preview.addTo(map.current);
        drawingLayer.current = preview;
      }
      
      toast.info("✅ Circle center placed! Move mouse to adjust size, click again to finish.");
    } else {
      // Second click - finish circle
      const distance = map.current!.distance([circleCenter.lat, circleCenter.lng], [point.lat, point.lng]);
      const finalRadius = Math.max(10, Math.round(distance)); // Minimum 10m radius
      setCircleRadius(finalRadius);
      finishCircleDrawing(finalRadius);
    }
  };

  const updateCirclePreview = (point: L.LatLng) => {
    if (!circleCenter || !drawingLayer.current || !map.current) return;
    
    const distance = map.current.distance([circleCenter.lat, circleCenter.lng], [point.lat, point.lng]);
    const newRadius = Math.max(10, Math.round(distance)); // Minimum 10m radius
    
    // Remove old preview
    map.current.removeLayer(drawingLayer.current);
    
    // Add new preview
    const preview = L.circle([circleCenter.lat, circleCenter.lng], {
      radius: newRadius,
      color: '#2563eb',
      fillColor: '#3b82f6',
      fillOpacity: 0.35,
      weight: 4,
      opacity: 0.9,
      dashArray: '8, 4'
    });
    
    preview.addTo(map.current);
    drawingLayer.current = preview;
    setCircleRadius(newRadius);
  };

  const finishCircleDrawing = (radius: number) => {
    if (!circleCenter) return;
    
    console.log("Finishing circle drawing:", circleCenter, radius);
    
    setTempGeofence({
      type: 'circle',
      center: circleCenter,
      radius: radius,
    });
    
    setFormData({ ...formData, shape: 'circle', radius });
    setIsDrawing(false);
    setShowDrawingPanel(true);
    
    // Update the drawing layer to be solid (not dashed)
    if (drawingLayer.current && map.current) {
      map.current.removeLayer(drawingLayer.current);
      const finalCircle = L.circle([circleCenter.lat, circleCenter.lng], {
        radius: radius,
        color: '#059669',
        fillColor: '#10b981',
        fillOpacity: 0.25,
        weight: 3,
        opacity: 0.8
      });
      finalCircle.addTo(map.current);
      drawingLayer.current = finalCircle;
    }
    
    toast.success(`🎯 Circle created! Radius: ${radius}m. Configure and save below.`);
  };

  const handlePolygonDrawing = (point: { lat: number; lng: number }) => {
    console.log("Polygon drawing:", point, "Current points:", polygonPoints.length);
    
    const newPoints = [...polygonPoints, point];
    setPolygonPoints(newPoints);
    
    if (newPoints.length === 1) {
      setIsDrawing(true);
      toast.info("📐 Polygon started! Continue clicking to add points, double-click to finish.");
    }
    
    updatePolygonPreview(newPoints);
    
    if (newPoints.length >= 3) {
      setTempGeofence({
        type: 'polygon',
        coordinates: newPoints,
      });
    }
  };

  const updatePolygonPreview = (points: Array<{ lat: number; lng: number }>) => {
    if (!map.current) return;
    
    // Remove old preview
    if (drawingLayer.current) {
      map.current.removeLayer(drawingLayer.current);
    }
    
    if (points.length < 2) return;
    
    const latLngs = points.map(p => [p.lat, p.lng] as [number, number]);
    
    let preview: L.Layer;
    if (points.length === 2) {
      // Show line for first two points
      preview = L.polyline(latLngs, {
        color: '#2563eb',
        weight: 4,
        opacity: 0.9,
        dashArray: '8, 4'
      });
    } else {
      // Show polygon for 3+ points
      preview = L.polygon(latLngs, {
        color: '#2563eb',
        fillColor: '#3b82f6',
        fillOpacity: 0.35,
        weight: 4,
        opacity: 0.9,
        dashArray: '8, 4'
      });
    }
    
    preview.addTo(map.current);
    drawingLayer.current = preview;
  };

  const finishPolygonDrawing = () => {
    if (polygonPoints.length < 3) {
      toast.error("Polygon needs at least 3 points");
      return;
    }
    
    console.log("Finishing polygon drawing:", polygonPoints);
    
    setTempGeofence({
      type: 'polygon',
      coordinates: polygonPoints,
    });
    
    setFormData({ ...formData, shape: 'polygon' });
    setIsDrawing(false);
    setShowDrawingPanel(true);
    
    // Update the drawing layer to be solid (not dashed)
    if (drawingLayer.current && map.current) {
      map.current.removeLayer(drawingLayer.current);
      const latLngs = polygonPoints.map(p => [p.lat, p.lng] as [number, number]);
      const finalPolygon = L.polygon(latLngs, {
        color: '#059669',
        fillColor: '#10b981',
        fillOpacity: 0.25,
        weight: 3,
        opacity: 0.8
      });
      finalPolygon.addTo(map.current);
      drawingLayer.current = finalPolygon;
    }
    
    toast.success(`📐 Polygon created with ${polygonPoints.length} points! Configure and save below.`);
  };

  const startDrawing = (tool: DrawingTool) => {
    console.log("Starting drawing tool:", tool);
    
    if (tool === drawingTool) {
      // Toggle off if same tool
      cancelDrawing();
      return;
    }
    
    // Cancel any existing drawing
    cancelDrawing();
    
    setDrawingTool(tool);
    setIsDrawing(false);
    
    // Add drawing cursor
    if (map.current) {
      map.current.getContainer().style.cursor = 'crosshair';
    }
    
    switch (tool) {
      case 'circle':
        toast.info("🎯 Circle Mode Active: Click to place center, then click again to set radius");
        break;
      case 'polygon':
        toast.info("📐 Polygon Mode Active: Click to add points, double-click to finish");
        break;
    }
  };

  const cancelDrawing = () => {
    console.log("Canceling drawing");
    
    setDrawingTool('none');
    setIsDrawing(false);
    setCircleCenter(null);
    setPolygonPoints([]);
    setTempGeofence(null);
    setEditingGeofence(null);
    setShowDrawingPanel(false);
    
    // Reset cursor
    if (map.current) {
      map.current.getContainer().style.cursor = '';
    }
    
    // Clear drawing layers
    if (drawingLayer.current && map.current) {
      map.current.removeLayer(drawingLayer.current);
      drawingLayer.current = null;
    }
    
    toast.info("Drawing cancelled");
  };

  const centerOnMyLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation not supported");
      return;
    }
    
    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (map.current) {
          map.current.setView([position.coords.latitude, position.coords.longitude], 16);
          toast.success("📍 Centered on your location");
        }
      },
      (error) => {
        console.error("Geolocation error:", error);
        toast.error("Failed to get your location");
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000
      }
    );
  };

  const undoLastPoint = () => {
    if (drawingTool === 'polygon' && polygonPoints.length > 0) {
      const newPoints = polygonPoints.slice(0, -1);
      setPolygonPoints(newPoints);
      updatePolygonPreview(newPoints);
      
      if (newPoints.length < 3) {
        setTempGeofence(null);
      } else {
        setTempGeofence({
          type: 'polygon',
          coordinates: newPoints,
        });
      }
      
      toast.info("↶ Last point removed");
    }
  };

  // Update geofence visualization
  useEffect(() => {
    if (!map.current) return;

    // Clear existing geofence layers
    Object.values(geofenceLayers.current).forEach(layer => map.current?.removeLayer(layer));
    geofenceLayers.current = {};

    // Add existing geofences
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
      const isSelected = selectedGeofences.has(geofence._id);

      if (geofence.shape === 'circle' && geofence.center && geofence.radius) {
        layer = L.circle([geofence.center.lat, geofence.center.lng], {
          radius: geofence.radius,
          color: colors.color,
          fillColor: colors.fillColor,
          fillOpacity: isSelected ? 0.45 : 0.25,
          weight: isSelected ? 4 : 3,
          opacity: 0.8,
          dashArray: isSelected ? '6, 4' : undefined
        });
      } else if (geofence.shape === 'polygon' && geofence.coordinates && geofence.coordinates.length >= 3) {
        const latLngs = geofence.coordinates.map(coord => [coord.lat, coord.lng] as [number, number]);
        layer = L.polygon(latLngs, {
          color: colors.color,
          fillColor: colors.fillColor,
          fillOpacity: isSelected ? 0.45 : 0.25,
          weight: isSelected ? 4 : 3,
          opacity: 0.8,
          dashArray: isSelected ? '6, 4' : undefined,
          smoothFactor: 1.0
        });
      }

      if (layer) {
        layer.addTo(map.current!);
        
        const popupContent = `
          <div class="p-3 min-w-[200px]">
            <h3 class="font-semibold text-lg mb-2">${geofence.name}</h3>
            <p class="text-sm text-gray-600 mb-2">${geofence.type.replace('_', ' ').toUpperCase()}</p>
            ${geofence.shape === 'circle' ? `<p class="text-xs text-gray-500 mb-2">Radius: ${geofence.radius}m</p>` : `<p class="text-xs text-gray-500 mb-2">Polygon: ${geofence.coordinates?.length} points</p>`}
            ${geofence.description ? `<p class="text-xs text-gray-500 mb-3">${geofence.description}</p>` : ''}
            <div class="flex gap-2">
              <button onclick="window.editGeofence('${geofence._id}')" class="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 transition-colors">
                ✏️ Edit
              </button>
              <button onclick="window.deleteGeofence('${geofence._id}')" class="px-3 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700 transition-colors">
                🗑️ Delete
              </button>
            </div>
          </div>
        `;
        
        layer.bindPopup(popupContent);
        
        // Add click handler for selection
        layer.on('click', (e) => {
          e.originalEvent.stopPropagation();
          const newSelected = new Set(selectedGeofences);
          if (newSelected.has(geofence._id)) {
            newSelected.delete(geofence._id);
          } else {
            newSelected.add(geofence._id);
          }
          setSelectedGeofences(newSelected);
        });

        geofenceLayers.current[geofence._id] = layer;
      }
    });
  }, [geofences, selectedGeofences]);

  // Global functions for popup buttons
  useEffect(() => {
    (window as any).editGeofence = (geofenceId: string) => {
      const geofence = geofences.find(g => g._id === geofenceId);
      if (geofence) {
        setEditingGeofence(geofenceId as Id<"geofences">);
        setFormData({
          name: geofence.name,
          type: geofence.type,
          shape: geofence.shape,
          radius: geofence.radius || 100,
          alertOnEntry: geofence.alertOnEntry,
          alertOnExit: geofence.alertOnExit,
          description: geofence.description || "",
        });
        setActiveTab('create');
        setShowDrawingPanel(true);
      }
    };

    (window as any).deleteGeofence = async (geofenceId: string) => {
      if (confirm('Are you sure you want to delete this geofence?')) {
        try {
          await deleteGeofence({ geofenceId: geofenceId as Id<"geofences"> });
          toast.success("Geofence deleted successfully");
        } catch (error) {
          toast.error("Failed to delete geofence");
        }
      }
    };

    return () => {
      delete (window as any).editGeofence;
      delete (window as any).deleteGeofence;
    };
  }, [geofences, deleteGeofence]);

  const saveGeofence = async () => {
    if (!tempGeofence || !formData.name) {
      toast.error("Please provide a name and draw the geofence");
      return;
    }
    
    try {
      const geofenceData = {
        sessionId,
        name: formData.name,
        type: formData.type,
        shape: formData.shape,
        alertOnEntry: formData.alertOnEntry,
        alertOnExit: formData.alertOnExit,
        description: formData.description,
        ...(tempGeofence.type === 'circle' ? {
          center: tempGeofence.center,
          radius: formData.radius,
        } : {
          coordinates: tempGeofence.coordinates,
        }),
      };

      if (editingGeofence) {
        await updateGeofence({
          geofenceId: editingGeofence,
          ...geofenceData,
        });
        toast.success("✅ Geofence updated successfully!");
      } else {
        await createGeofence(geofenceData);
        toast.success("✅ Geofence created successfully!");
      }
      
      // Reset form
      cancelDrawing();
      setFormData({
        name: "",
        type: "safe_zone",
        shape: "circle",
        radius: 100,
        alertOnEntry: true,
        alertOnExit: true,
        description: "",
      });
    } catch (error) {
      toast.error("Failed to save geofence");
    }
  };

  const handleBulkUpdate = async (updates: any) => {
    if (selectedGeofences.size === 0) {
      toast.error("No geofences selected");
      return;
    }

    try {
      await bulkUpdateGeofences({
        sessionId,
        geofenceIds: Array.from(selectedGeofences),
        updates,
      });
      toast.success(`Updated ${selectedGeofences.size} geofences`);
      setSelectedGeofences(new Set());
    } catch (error) {
      toast.error("Failed to update geofences");
    }
  };

  return (
    <div className="bg-gray-50 rounded-xl p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h3 className="text-2xl font-bold text-gray-800">🗺️ Geofence Management</h3>
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

      {/* Drawing Tools Bar */}
      <div className="bg-white rounded-lg p-4 shadow-sm border">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-medium text-gray-700">🎨 Drawing Tools:</span>
          
          <button
            onClick={() => startDrawing('circle')}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              drawingTool === 'circle'
                ? "bg-purple-600 text-white shadow-lg"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            ⭕ Circle
          </button>
          
          <button
            onClick={() => startDrawing('polygon')}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              drawingTool === 'polygon'
                ? "bg-indigo-600 text-white shadow-lg"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            📐 Polygon
          </button>

          <div className="h-6 w-px bg-gray-300 mx-2"></div>

          {drawingTool === 'polygon' && polygonPoints.length > 0 && (
            <button
              onClick={undoLastPoint}
              className="px-3 py-2 bg-yellow-100 text-yellow-700 rounded-lg hover:bg-yellow-200 transition-colors"
            >
              ↶ Undo Point ({polygonPoints.length})
            </button>
          )}

          {drawingTool !== 'none' && (
            <button
              onClick={cancelDrawing}
              className="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
            >
              ✕ Cancel Drawing
            </button>
          )}

          <button
            onClick={centerOnMyLocation}
            className="px-4 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors"
          >
            📍 My Location
          </button>
        </div>
      </div>

      {/* Drawing Instructions */}
      {drawingTool !== 'none' && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="text-blue-600 text-2xl">
              {drawingTool === 'circle' ? '⭕' : '📐'}
            </div>
            <div className="text-blue-800">
              {drawingTool === 'circle' && !circleCenter && (
                <span className="font-medium">🎯 Click on the map to place the circle center</span>
              )}
              {drawingTool === 'circle' && circleCenter && (
                <span className="font-medium">✅ Circle center placed! Move mouse and click to set radius.</span>
              )}
              {drawingTool === 'polygon' && polygonPoints.length === 0 && (
                <span className="font-medium">📐 Click on the map to start drawing polygon</span>
              )}
              {drawingTool === 'polygon' && polygonPoints.length > 0 && (
                <span className="font-medium">
                  📐 Polygon: {polygonPoints.length} points added. 
                  {polygonPoints.length >= 3 ? " Double-click to finish." : " Add more points."}
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Map Container */}
      <div className="relative">
        <div className="h-[500px] rounded-lg overflow-hidden shadow-lg border" ref={mapContainer} />
        
        {/* Map Controls Overlay */}
        <div className="absolute top-4 right-4 bg-white rounded-lg shadow-lg p-2 space-y-2">
          <button
            onClick={centerOnMyLocation}
            className="block w-8 h-8 bg-white hover:bg-gray-100 rounded border text-gray-700 text-sm"
            title="Center on my location"
          >
            📍
          </button>
          <button
            onClick={() => map.current?.zoomIn()}
            className="block w-8 h-8 bg-white hover:bg-gray-100 rounded border text-gray-700 font-bold"
          >
            +
          </button>
          <button
            onClick={() => map.current?.zoomOut()}
            className="block w-8 h-8 bg-white hover:bg-gray-100 rounded border text-gray-700 font-bold"
          >
            −
          </button>
        </div>
      </div>

      {/* Drawing Configuration Panel */}
      {showDrawingPanel && tempGeofence && (
        <div className="bg-white rounded-lg p-6 shadow-lg border">
          <h4 className="text-lg font-semibold mb-4">
            {editingGeofence ? '✏️ Edit Geofence' : '🎯 Configure New Geofence'}
          </h4>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter geofence name"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Type</label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value as GeofenceType })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="safe_zone">🛡️ Safe Zone</option>
                <option value="restricted_zone">🚫 Restricted Zone</option>
                <option value="alert_zone">⚠️ Alert Zone</option>
              </select>
            </div>
            
            {tempGeofence.type === 'circle' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Radius (meters)</label>
                <input
                  type="number"
                  value={formData.radius}
                  onChange={(e) => {
                    const radius = parseInt(e.target.value);
                    setFormData({ ...formData, radius });
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  min="10"
                  max="50000"
                  required
                />
              </div>
            )}
            
            <div className="flex items-center space-x-6">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.alertOnEntry}
                  onChange={(e) => setFormData({ ...formData, alertOnEntry: e.target.checked })}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="ml-2 text-sm">🔔 Alert on Entry</span>
              </label>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.alertOnExit}
                  onChange={(e) => setFormData({ ...formData, alertOnExit: e.target.checked })}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="ml-2 text-sm">🔔 Alert on Exit</span>
              </label>
            </div>
          </div>
          
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              rows={3}
              placeholder="Optional description"
            />
          </div>
          
          <div className="flex gap-3 mt-6">
            <button
              onClick={saveGeofence}
              disabled={!formData.name}
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium"
            >
              {editingGeofence ? '💾 Update Geofence' : '💾 Save Geofence'}
            </button>
            <button
              onClick={cancelDrawing}
              className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-medium"
            >
              ✕ Cancel
            </button>
          </div>
        </div>
      )}

      {/* Tab Content */}
      {activeTab === 'manage' && (
        <div className="bg-white rounded-lg p-6 shadow-sm border">
          <div className="flex justify-between items-center mb-6">
            <h4 className="text-lg font-semibold">📋 Manage Geofences</h4>
            {selectedGeofences.size > 0 && (
              <div className="flex gap-2 items-center">
                <span className="text-sm text-gray-600 bg-gray-100 px-3 py-1 rounded-full">
                  {selectedGeofences.size} selected
                </span>
                <button
                  onClick={() => handleBulkUpdate({ active: false })}
                  className="px-3 py-1 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 transition-colors"
                >
                  🚫 Disable Selected
                </button>
                <button
                  onClick={() => handleBulkUpdate({ active: true })}
                  className="px-3 py-1 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 transition-colors"
                >
                  ✅ Enable Selected
                </button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {geofences.map((geofence) => (
              <div
                key={geofence._id}
                className={`border rounded-lg p-4 cursor-pointer transition-all hover:shadow-md ${
                  selectedGeofences.has(geofence._id)
                    ? 'border-blue-500 bg-blue-50 shadow-md'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
                onClick={() => {
                  const newSelected = new Set(selectedGeofences);
                  if (newSelected.has(geofence._id)) {
                    newSelected.delete(geofence._id);
                  } else {
                    newSelected.add(geofence._id);
                  }
                  setSelectedGeofences(newSelected);
                }}
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
              </div>
            ))}
          </div>

          {geofences.length === 0 && (
            <div className="text-center text-gray-500 py-12">
              <div className="text-4xl mb-4">🗺️</div>
              <p className="text-lg">No geofences created yet</p>
              <p className="text-sm">Switch to the Create tab to add your first geofence</p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'analytics' && (
        <div className="bg-white rounded-lg p-6 shadow-sm border">
          <h4 className="text-lg font-semibold mb-6">📊 Geofence Analytics</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-lg">
              <h5 className="font-semibold text-gray-700 mb-2">Total Geofences</h5>
              <p className="text-3xl font-bold text-blue-600">{geofences.length}</p>
            </div>
            <div className="bg-gradient-to-br from-green-50 to-green-100 p-6 rounded-lg">
              <h5 className="font-semibold text-gray-700 mb-2">Safe Zones</h5>
              <p className="text-3xl font-bold text-green-600">
                {geofences.filter(g => g.type === 'safe_zone').length}
              </p>
            </div>
            <div className="bg-gradient-to-br from-red-50 to-red-100 p-6 rounded-lg">
              <h5 className="font-semibold text-gray-700 mb-2">Restricted Zones</h5>
              <p className="text-3xl font-bold text-red-600">
                {geofences.filter(g => g.type === 'restricted_zone').length}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}