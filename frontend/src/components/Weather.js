const WEATHER_CODE_LABELS = {
  0: "Clear sky",
  1: "Mainly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Fog",
  48: "Rime fog",
  51: "Light drizzle",
  53: "Moderate drizzle",
  55: "Dense drizzle",
  56: "Light freezing drizzle",
  57: "Dense freezing drizzle",
  61: "Slight rain",
  63: "Moderate rain",
  65: "Heavy rain",
  66: "Light freezing rain",
  67: "Heavy freezing rain",
  71: "Slight snow",
  73: "Moderate snow",
  75: "Heavy snow",
  77: "Snow grains",
  80: "Slight rain showers",
  81: "Moderate rain showers",
  82: "Violent rain showers",
  85: "Slight snow showers",
  86: "Heavy snow showers",
  95: "Thunderstorm",
  96: "Thunderstorm with hail",
  99: "Heavy thunderstorm with hail",
};

const WEATHER_CODE_ICONS = {
  0: "☀️",
  1: "🌤️",
  2: "⛅",
  3: "☁️",
  45: "🌫️",
  48: "🌫️",
  51: "🌦️",
  53: "🌦️",
  55: "🌧️",
  56: "🌧️",
  57: "🌧️",
  61: "🌧️",
  63: "🌧️",
  65: "⛈️",
  66: "🌨️",
  67: "🌨️",
  71: "🌨️",
  73: "🌨️",
  75: "🌨️",
  77: "🌨️",
  80: "🌧️",
  81: "🌧️",
  82: "⛈️",
  85: "🌨️",
  86: "🌨️",
  95: "⛈️",
  96: "⛈️",
  99: "⛈️",
};

const weatherLabel = (code) => WEATHER_CODE_LABELS[code] || "Unknown";
const weatherIcon = (code) => WEATHER_CODE_ICONS[code] || "❔";

const getHourlyDisplay = (hourly = []) => {
  const visible = hourly.slice(0, 12);

  return visible.map((item) => ({
    ...item,
    relativeTemp: item.temperature != null ? Math.round(item.temperature) : "—",
  }));
};

export default function Weather({ weatherData, hourly, onRefresh, error }) {
  const hourItems = getHourlyDisplay(hourly);
  const columnWidth = 120;

  return (
    <div style={{ display: "grid", gap: 24 }}>
      <div style={{ background: "linear-gradient(140deg, #ecfdf5 0%, #d1fae5 100%)", border: "1px solid rgba(34,197,94,0.18)", borderRadius: 28, padding: 20, boxShadow: "0 20px 50px rgba(15,23,42,0.09)" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 0 }}>
            <div style={{ width: 80, height: 80, background: "rgba(255,255,255,0.9)", borderRadius: 20, display: "grid", placeItems: "center", boxShadow: "0 12px 30px rgba(15,23,42,0.08)" }}>
              <span style={{ fontSize: 38 }}>{weatherIcon(weatherData?.weathercode)}</span>
            </div>
            <div style={{ minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: "#16a34a", textTransform: "uppercase", letterSpacing: 1 }}>Weather</p>
              <h2 style={{ margin: "6px 0 0", fontSize: 28, fontWeight: 800, color: "#0f766e", lineHeight: 1.05 }}>Houthalen-Helchteren</h2>
              <p style={{ margin: "6px 0 0", color: "#475569", fontSize: 14, lineHeight: 1.7, maxWidth: 400 }}>{weatherData ? weatherLabel(weatherData.weathercode) : "Current conditions for your town."}</p>
            </div>
          </div>

          <button onClick={onRefresh} style={{ background: "linear-gradient(135deg, #16a34a, #22c55e)", border: "none", color: "#fff", padding: "12px 18px", borderRadius: 16, fontSize: 13, fontWeight: 700, cursor: "pointer", minWidth: 120, boxShadow: "0 10px 25px rgba(22,163,74,0.25)" }}>
            Refresh
          </button>
        </div>

        {error ? (
          <p style={{ margin: "18px 0 0", color: "#dc2626", fontSize: 14, fontWeight: 600 }}>{error}</p>
        ) : weatherData ? (
          <div style={{ display: "grid", gap: 16, marginTop: 18 }}>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 20, flexWrap: "wrap" }}>
              <div style={{ minWidth: 180 }}>
                <p style={{ margin: 0, fontSize: 60, fontWeight: 900, color: "#0f766e" }}>{Math.round(weatherData.temperature)}°</p>
                <p style={{ margin: "8px 0 0", color: "#475569", fontSize: 14 }}>Updated {new Date(weatherData.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p>
              </div>
              <div style={{ display: "grid", gap: 8, minWidth: 160 }}>
                <div style={{ background: "rgba(255,255,255,0.92)", borderRadius: 16, padding: "12px 14px", boxShadow: "inset 0 0 0 1px rgba(15,23,42,0.04)" }}>
                  <p style={{ margin: 0, fontSize: 12, color: "#64748b" }}>Wind</p>
                  <p style={{ margin: "6px 0 0", fontSize: 16, fontWeight: 800, color: "#134e4a" }}>{Math.round(weatherData.windspeed)} km/h</p>
                </div>
                <div style={{ background: "rgba(255,255,255,0.92)", borderRadius: 16, padding: "12px 14px", boxShadow: "inset 0 0 0 1px rgba(15,23,42,0.04)" }}>
                  <p style={{ margin: 0, fontSize: 12, color: "#64748b" }}>Rain chance</p>
                  <p style={{ margin: "6px 0 0", fontSize: 16, fontWeight: 800, color: "#0f766e" }}>{hourItems[0]?.precipitationProbability != null ? `${Math.round(hourItems[0].precipitationProbability)}%` : "—"}</p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <p style={{ margin: "18px 0 0", color: "#475569", fontSize: 14 }}>Loading current weather …</p>
        )}
      </div>

      <div style={{ background: "#ffffff", border: "1px solid rgba(34,197,94,0.1)", borderRadius: 28, padding: 20, boxShadow: "0 20px 40px rgba(15,23,42,0.06)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: "#166534" }}>Hourly forecast</h3>
            <p style={{ margin: "6px 0 0", color: "#64748b", fontSize: 13 }}>Next 12 hours with weather conditions and rain chance.</p>
          </div>
        </div>

        {hourItems.length > 0 ? (
          <div style={{ overflowX: "auto", paddingBottom: 8 }}>
            <div style={{ display: "grid", gridAutoFlow: "column", gridTemplateColumns: `repeat(${hourItems.length}, ${columnWidth}px)`, gap: 16 }}>
              {hourItems.map((item) => (
                <div key={item.time} style={{ background: "#f8fafc", borderRadius: 20, padding: 16, width: columnWidth, display: "grid", gap: 10, alignItems: "center", textAlign: "center" }}>
                  <div style={{ width: 48, height: 48, margin: "0 auto", borderRadius: 16, background: "rgba(22,163,74,0.12)", display: "grid", placeItems: "center" }}>
                    <span style={{ fontSize: 24 }}>{weatherIcon(item.weathercode)}</span>
                  </div>
                  <p style={{ margin: 0, fontSize: 20, fontWeight: 800, color: "#0f766e" }}>{item.relativeTemp}°</p>
                  <p style={{ margin: 0, fontSize: 13, color: "#475569" }}>{new Date(item.time).toLocaleTimeString([], { hour: "2-digit" })}</p>
                  <p style={{ margin: 0, fontSize: 12, color: "#64748b" }}>{Math.round(item.precipitationProbability)}% rain</p>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p style={{ margin: 0, color: "#64748b", fontSize: 14 }}>Loading hourly forecast …</p>
        )}
      </div>
    </div>
  );
}
