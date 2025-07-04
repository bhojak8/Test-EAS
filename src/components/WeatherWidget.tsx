import { useState, useEffect } from "react";
import { toast } from "sonner";

interface WeatherData {
  temperature: number;
  description: string;
  humidity: number;
  windSpeed: number;
  visibility: number;
  icon: string;
  location: string;
}

export function WeatherWidget() {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(false);
  const [location, setLocation] = useState<{lat: number, lng: number} | null>(null);

  useEffect(() => {
    getCurrentLocation();
  }, []);

  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation not supported");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude
        });
        fetchWeather(position.coords.latitude, position.coords.longitude);
      },
      (error) => {
        console.error("Location error:", error);
        // Fallback to a default location (New York)
        setLocation({ lat: 40.7128, lng: -74.0060 });
        fetchWeather(40.7128, -74.0060);
      }
    );
  };

  const fetchWeather = async (lat: number, lng: number) => {
    setLoading(true);
    try {
      // Using OpenWeatherMap API (you would need to add your API key)
      // For demo purposes, we'll simulate weather data
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const mockWeather: WeatherData = {
        temperature: Math.round(Math.random() * 30 + 10), // 10-40°C
        description: ["Clear sky", "Few clouds", "Scattered clouds", "Broken clouds", "Light rain"][Math.floor(Math.random() * 5)],
        humidity: Math.round(Math.random() * 40 + 30), // 30-70%
        windSpeed: Math.round(Math.random() * 20 + 5), // 5-25 km/h
        visibility: Math.round(Math.random() * 5 + 5), // 5-10 km
        icon: "☀️",
        location: "Current Location"
      };

      setWeather(mockWeather);
    } catch (error) {
      console.error("Weather fetch error:", error);
      toast.error("Failed to fetch weather data");
    } finally {
      setLoading(false);
    }
  };

  const getWeatherIcon = (description: string) => {
    if (description.includes("clear")) return "☀️";
    if (description.includes("cloud")) return "☁️";
    if (description.includes("rain")) return "🌧️";
    if (description.includes("snow")) return "❄️";
    if (description.includes("storm")) return "⛈️";
    return "🌤️";
  };

  const getVisibilityStatus = (visibility: number) => {
    if (visibility >= 8) return { text: "Excellent", color: "text-green-600" };
    if (visibility >= 5) return { text: "Good", color: "text-yellow-600" };
    return { text: "Poor", color: "text-red-600" };
  };

  const getWindStatus = (windSpeed: number) => {
    if (windSpeed <= 10) return { text: "Calm", color: "text-green-600" };
    if (windSpeed <= 20) return { text: "Moderate", color: "text-yellow-600" };
    return { text: "Strong", color: "text-red-600" };
  };

  return (
    <div className="bg-white rounded-lg p-4 shadow-sm border">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-lg font-semibold">🌤️ Weather Conditions</h3>
        <button
          onClick={() => location && fetchWeather(location.lat, location.lng)}
          disabled={loading}
          className="text-blue-600 hover:text-blue-800 text-sm disabled:opacity-50"
        >
          {loading ? "⟳" : "🔄"} Refresh
        </button>
      </div>

      {loading ? (
        <div className="text-center py-8">
          <div className="animate-spin text-2xl mb-2">🌀</div>
          <p className="text-gray-600">Loading weather...</p>
        </div>
      ) : weather ? (
        <div className="space-y-3">
          <div className="text-center">
            <div className="text-4xl mb-2">{getWeatherIcon(weather.description)}</div>
            <div className="text-2xl font-bold">{weather.temperature}°C</div>
            <div className="text-gray-600 capitalize">{weather.description}</div>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-gray-600">Humidity</div>
              <div className="font-semibold">{weather.humidity}%</div>
            </div>
            
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-gray-600">Wind</div>
              <div className={`font-semibold ${getWindStatus(weather.windSpeed).color}`}>
                {weather.windSpeed} km/h
              </div>
            </div>
            
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-gray-600">Visibility</div>
              <div className={`font-semibold ${getVisibilityStatus(weather.visibility).color}`}>
                {weather.visibility} km
              </div>
            </div>
            
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-gray-600">Status</div>
              <div className={`font-semibold ${getVisibilityStatus(weather.visibility).color}`}>
                {getVisibilityStatus(weather.visibility).text}
              </div>
            </div>
          </div>

          <div className="text-xs text-gray-500 text-center">
            Last updated: {new Date().toLocaleTimeString()}
          </div>
        </div>
      ) : (
        <div className="text-center py-8 text-gray-500">
          <div className="text-2xl mb-2">🌍</div>
          <p>Weather data unavailable</p>
          <button
            onClick={getCurrentLocation}
            className="mt-2 text-blue-600 hover:text-blue-800 text-sm"
          >
            Try Again
          </button>
        </div>
      )}
    </div>
  );
}