import { useState, useEffect, useMemo } from "react";
import { fmt, displayStatus, useTodayKey } from "../lib/utils";

// ─── Weather ──────────────────────────────────────────────────────────────────

const DEFAULT_LOCATION = { latitude: 40.7128, longitude: -74.006, label: "New York" };

function useWeather(location) {
  const [weather, setWeather] = useState(null);
  useEffect(() => {
    let cancelled = false;
    const fetchWeather = async () => {
      try {
        let lat = DEFAULT_LOCATION.latitude;
        let lon = DEFAULT_LOCATION.longitude;
        let label = DEFAULT_LOCATION.label;

        if (location?.trim()) {
          const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(location.trim())}&count=1&language=en&format=json`;
          const geoResp = await fetch(geoUrl);
          if (geoResp.ok) {
            const geoData = await geoResp.json();
            if (geoData?.results?.length) {
              lat = geoData.results[0].latitude;
              lon = geoData.results[0].longitude;
              label = `${geoData.results[0].name}${geoData.results[0].country ? `, ${geoData.results[0].country}` : ""}`;
            } else {
              label = location.trim();
            }
          }
        }

        const url =
          `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
          `&current=temperature_2m,weathercode&daily=temperature_2m_max,temperature_2m_min,sunrise,sunset` +
          `&timezone=auto&forecast_days=1`;
        const resp = await fetch(url);
        const data = await resp.json();
        if (cancelled) return;
        const c = data.current || data.current_weather;
        const d = data.daily;
        if (c && d) {
          setWeather({
            temp: Math.round(c.temperature_2m ?? c.temperature),
            high: Math.round(d.temperature_2m_max[0]),
            low: Math.round(d.temperature_2m_min[0]),
            sunrise: d.sunrise[0].slice(-5),
            sunset: d.sunset[0].slice(-5),
            code: c.weathercode,
            locationLabel: label,
          });
        }
      } catch {
        if (!cancelled) setWeather(null);
      }
    };
    setWeather(null);
    fetchWeather();
    return () => { cancelled = true; };
  }, [location]);
  return weather;
}

function weatherLabel(code) {
  if (code == null) return "—";
  if (code === 0) return "Sunny";
  if (code <= 2) return "Partly cloudy";
  if (code <= 3) return "Cloudy";
  if (code <= 9) return "Overcast";
  if (code <= 29) return "Foggy";
  if (code <= 39) return "Drizzle";
  if (code <= 59) return "Rainy";
  if (code <= 69) return "Sleet";
  if (code <= 77) return "Snow";
  if (code <= 82) return "Showers";
  return "Stormy";
}

function WeatherCard({ weather }) {
  if (!weather) return null;
  return (
    <div style={{
      background: "var(--g-card)",
      border: "1px solid var(--g-hair)",
      borderRadius: 20,
      padding: "16px 20px",
      display: "flex",
      alignItems: "center",
      gap: 14,
      boxShadow: "var(--g-shadow-sm)",
      minWidth: 200,
    }}>
      <div style={{
        width: 40, height: 40, borderRadius: 12,
        background: "var(--g-sky-bg)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 20, flexShrink: 0,
      }}>
        {weather.code === 0 ? "☀️" : weather.code <= 2 ? "🌤️" : weather.code <= 3 ? "☁️" : weather.code <= 9 ? "🌫️" : weather.code <= 67 ? "🌧️" : "❄️"}
      </div>
      <div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
          <span style={{ fontSize: 26, fontWeight: 400, fontFamily: "var(--g-serif)", color: "var(--g-ink)", lineHeight: 1 }}>
            {weather.temp}°
          </span>
        </div>
        <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--g-muted)", fontFamily: "var(--g-sans)" }}>
          {weatherLabel(weather.code)} · H {weather.high} · L {weather.low}
        </p>
        {weather.locationLabel && (
          <p style={{ margin: "4px 0 0", fontSize: 11, color: "var(--g-mute2)", fontFamily: "var(--g-sans)" }}>
            {weather.locationLabel}
          </p>
        )}
      </div>
      <div style={{ marginLeft: "auto", textAlign: "right" }}>
        <p style={{ margin: 0, fontSize: 11.5, color: "var(--g-mute2)", fontFamily: "var(--g-sans)" }}>↑ {weather.sunrise}</p>
        <p style={{ margin: "2px 0 0", fontSize: 11.5, color: "var(--g-mute2)", fontFamily: "var(--g-sans)" }}>↓ {weather.sunset}</p>
      </div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const NUM_WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
const toWord = (n) => (n < NUM_WORDS.length ? NUM_WORDS[n] : String(n));

function capitalize(s) {
  if (!s) return "";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function freqToDays(freq) {
  if (!freq) return 7;
  const f = freq.toLowerCase();
  if (f === "daily") return 1;
  if (f === "weekly") return 7;
  if (f === "biweekly") return 14;
  if (f === "monthly") return 30;
  const m = f.match(/every\s+(\d+)\s+day/);
  if (m) return parseInt(m[1]);
  const m2 = f.match(/every\s+(\d+)\s+week/);
  if (m2) return parseInt(m2[1]) * 7;
  return 7;
}

function daysUntilWater(plant) {
  if (!plant.lastWatered) return -999;
  const days = freqToDays(plant.wateringFrequency);
  const next = new Date(plant.lastWatered);
  next.setDate(next.getDate() + days);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  next.setHours(0, 0, 0, 0);
  return Math.ceil((next - today) / 86400000);
}

function billDaysLeft(inv) {
  if (!inv.dueDate) return null;
  const due = new Date(inv.dueDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);
  return Math.ceil((due - today) / 86400000);
}

// ─── SVG icons ────────────────────────────────────────────────────────────────

function IconDoc({ color = "var(--g-honey)" }) {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
      <rect x="2.5" y="1.5" width="9" height="13" rx="1.5" stroke={color} strokeWidth="1.4" />
      <path d="M5 5.5h6M5 8h6M5 10.5h4" stroke={color} strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function IconLeaf() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
      <path d="M13 2s-4-1-7 2c-2 2-2.5 5-1.5 7.5M5.5 11.5c2.5 1 6 0 7.5-9.5" stroke="var(--g-sage)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M2.5 13.5c1-1 2-2.5 3-4" stroke="var(--g-sage)" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function IconCart() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M1 1.5h2l1.5 7h7l1.5-5H4" stroke="var(--g-muted)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="6.5" cy="13" r="1" fill="var(--g-muted)" />
      <circle cx="11.5" cy="13" r="1" fill="var(--g-muted)" />
    </svg>
  );
}

function IconWrench() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
      <path d="M11 2a3 3 0 00-2.83 4L2 12.17a1 1 0 001.41 1.41L9.57 7.41A3 3 0 0011 8a3 3 0 000-6z" stroke="var(--g-muted)" strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
  );
}

// ─── Meal card ────────────────────────────────────────────────────────────────

function MealCard({ todayMeal, recipe, onOpenRecipe }) {
  return (
    <div style={{
      background: "var(--g-card)",
      border: "1px solid var(--g-hair)",
      borderRadius: 20,
      padding: 24,
      boxShadow: "var(--g-shadow-sm)",
      marginBottom: 16,
    }}>
      <p style={{
        margin: "0 0 14px",
        fontSize: 11.5, fontWeight: 600, textTransform: "uppercase",
        letterSpacing: 0.9, color: "var(--g-sage-dark)", fontFamily: "var(--g-sans)",
      }}>
        Tonight at the table
      </p>

      {todayMeal ? (
        <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
          <div style={{ flex: 1 }}>
            <h2 style={{
              margin: 0, fontSize: 28, fontWeight: 400,
              fontFamily: "var(--g-serif)", color: "var(--g-ink)", lineHeight: 1.15,
            }}>
              {todayMeal.title}
            </h2>
            {todayMeal.notes && (
              <p style={{
                margin: "6px 0 0", fontSize: 14, fontStyle: "italic",
                color: "var(--g-muted)", fontFamily: "var(--g-serif)",
              }}>
                {todayMeal.notes}
              </p>
            )}

            {/* Tags */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 14 }}>
              {recipe?.prepTime && (
                <span style={tagStyle()}>{recipe.prepTime} min</span>
              )}
              {recipe?.servings && (
                <span style={tagStyle()}>Serves {recipe.servings}</span>
              )}
              {!recipe && todayMeal.recipeId == null && null}
            </div>

            {/* Actions */}
            <div style={{ display: "flex", gap: 8, marginTop: 18 }}>
              <button
                onClick={onOpenRecipe}
                style={{
                  background: "var(--g-sage)", border: "none", color: "#fff",
                  padding: "9px 18px", borderRadius: 999,
                  fontSize: 13.5, fontWeight: 600, fontFamily: "var(--g-sans)", cursor: "pointer",
                }}
              >
                Open recipe
              </button>
            </div>
          </div>

          {/* Photo placeholder */}
          <div style={{
            width: 96, height: 96, borderRadius: 14, flexShrink: 0,
            background: "repeating-linear-gradient(45deg, var(--g-hair2) 0px, var(--g-hair2) 6px, var(--g-hair) 6px, var(--g-hair) 12px)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            {recipe?.image
              ? <img src={recipe.image} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 14 }} />
              : <span style={{ fontSize: 11, color: "var(--g-mute2)", fontFamily: "var(--g-sans)" }}>recipe<br />photo</span>}
          </div>
        </div>
      ) : (
        <div>
          <p style={{ margin: 0, color: "var(--g-muted)", fontSize: 14, fontFamily: "var(--g-sans)" }}>
            Nothing planned yet.
          </p>
          <button
            onClick={onOpenRecipe}
            style={{
              marginTop: 12, background: "var(--g-sage)", border: "none", color: "#fff",
              padding: "9px 18px", borderRadius: 999,
              fontSize: 13.5, fontWeight: 600, fontFamily: "var(--g-sans)", cursor: "pointer",
            }}
          >
            Plan dinner
          </button>
        </div>
      )}
    </div>
  );
}

function tagStyle(variant = "neutral") {
  const variants = {
    neutral: { background: "var(--g-bg2)", color: "var(--g-ink2)" },
    amber:   { background: "var(--g-honey-bg)", color: "var(--g-honey)" },
    brick:   { background: "var(--g-brick-bg)", color: "var(--g-brick)" },
    sage:    { background: "var(--g-sage-bg)", color: "var(--g-sage-dark)" },
  };
  const v = variants[variant] || variants.neutral;
  return {
    ...v,
    fontSize: 12.5, fontWeight: 600, fontFamily: "var(--g-sans)",
    padding: "4px 10px", borderRadius: 999,
  };
}

// ─── Bills card ───────────────────────────────────────────────────────────────

function BillsCard({ invoices, onNavigate, onTogglePaid }) {
  const openInvoices = useMemo(() => invoices.filter(i => displayStatus(i) !== "paid"), [invoices]);
  const total = useMemo(() => openInvoices.reduce((a, i) => a + parseFloat(i.amount || 0), 0), [openInvoices]);

  return (
    <div style={{
      background: "var(--g-card)", border: "1px solid var(--g-hair)",
      borderRadius: 20, padding: "20px 24px", boxShadow: "var(--g-shadow-sm)",
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 4 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, fontFamily: "var(--g-sans)", color: "var(--g-ink)" }}>
            Bills to settle
          </h3>
          <p style={{ margin: "4px 0 0", fontSize: 12.5, color: "var(--g-muted)", fontFamily: "var(--g-sans)" }}>
            {openInvoices.length} open · {fmt(total)} outstanding
          </p>
        </div>
        <button onClick={() => onNavigate("invoices")} style={linkBtnStyle()}>
          All →
        </button>
      </div>

      {openInvoices.length === 0 ? (
        <p style={{ margin: "16px 0 0", color: "var(--g-muted)", fontSize: 14, fontFamily: "var(--g-sans)" }}>
          All clear — no unpaid bills.
        </p>
      ) : (
        <div>
          {openInvoices.map(inv => {
            const days = billDaysLeft(inv);
            const isOverdue = displayStatus(inv) === "overdue";
            const isDueSoon = !isOverdue && days !== null && days <= 3;
            const isDueThisWeek = !isOverdue && !isDueSoon && days !== null && days <= 7;

            const iconBg = isOverdue ? "var(--g-brick-bg)" : isDueSoon ? "var(--g-honey-bg)" : "var(--g-bg2)";
            const iconColor = isOverdue ? "var(--g-brick)" : isDueSoon ? "var(--g-honey)" : "var(--g-mute2)";

            let badge = null;
            if (isOverdue && days !== null) badge = { label: `${Math.abs(days)} d late`, color: "var(--g-brick)", bg: "var(--g-brick-bg)" };
            else if (isDueSoon) badge = { label: `in ${days} d`, color: "var(--g-honey)", bg: "var(--g-honey-bg)" };
            else if (isDueThisWeek) badge = { label: `in ${days} d`, color: "var(--g-honey)", bg: "var(--g-honey-bg)" };

            const subtitle = [
              inv.category,
              inv.invoiceNo ? inv.invoiceNo : null,
            ].filter(Boolean).join(" · ");

            return (
              <div key={inv.id} style={{
                display: "flex", alignItems: "center", gap: 14,
                padding: "14px 0", borderTop: "1px solid var(--g-hair2)",
              }}>
                {/* Icon */}
                <div style={{
                  width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                  background: iconBg,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <IconDoc color={iconColor} />
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontWeight: 600, fontSize: 14, fontFamily: "var(--g-sans)", color: "var(--g-ink)" }}>
                      {inv.vendor}
                    </span>
                    {badge && (
                      <span style={{
                        fontSize: 11.5, fontWeight: 600, fontFamily: "var(--g-sans)",
                        color: badge.color, background: badge.bg,
                        padding: "2px 8px", borderRadius: 999,
                      }}>
                        {badge.label}
                      </span>
                    )}
                  </div>
                  {subtitle && (
                    <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--g-mute2)", fontFamily: "var(--g-sans)" }}>
                      {subtitle}
                    </p>
                  )}
                </div>

                {/* Amount */}
                <span style={{ fontWeight: 700, fontSize: 14, fontFamily: "var(--g-sans)", color: "var(--g-ink)", flexShrink: 0 }}>
                  {fmt(inv.amount)}
                </span>

                {/* Action */}
                <button
                  onClick={() => onTogglePaid(inv.id)}
                  style={{
                    background: "var(--g-sage-bg)", border: "none", color: "var(--g-sage-dark)",
                    padding: "7px 14px", borderRadius: 999, flexShrink: 0,
                    fontSize: 12.5, fontWeight: 600, fontFamily: "var(--g-sans)", cursor: "pointer",
                  }}
                >
                  Mark paid
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Up next card ─────────────────────────────────────────────────────────────

const DOT_COLORS = ["#e05c5c", "#5c9ee0", "#5cb87a", "#c47ed6", "#e0965c"];

function UpNextCard({ events, onNavigate }) {
  const upcoming = useMemo(() => {
    const now = new Date();
    return events
      .map(e => ({ ...e, startDate: new Date(e.start) }))
      .filter(e => e.startDate >= now)
      .sort((a, b) => a.startDate - b.startDate)
      .slice(0, 4);
  }, [events]);

  return (
    <div style={{
      background: "var(--g-card)", border: "1px solid var(--g-hair)",
      borderRadius: 20, padding: "20px 24px", boxShadow: "var(--g-shadow-sm)",
      marginBottom: 14,
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: upcoming.length ? 4 : 0 }}>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, fontFamily: "var(--g-sans)", color: "var(--g-ink)" }}>
          Up next
        </h3>
        <button onClick={() => onNavigate("calendar")} style={linkBtnStyle()}>
          Calendar →
        </button>
      </div>

      {upcoming.length === 0 ? (
        <p style={{ margin: "12px 0 0", fontSize: 13.5, color: "var(--g-muted)", fontFamily: "var(--g-sans)" }}>
          No upcoming events. Import a calendar to get started.
        </p>
      ) : (
        <div>
          {upcoming.map((ev, i) => {
            const d = ev.startDate;
            const weekday = d.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase();
            const date = d.getDate();
            const timeStr = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
            const dotColor = DOT_COLORS[i % DOT_COLORS.length];

            return (
              <div key={ev.uid || i} style={{
                display: "flex", gap: 14, alignItems: "flex-start",
                padding: "13px 0", borderTop: "1px solid var(--g-hair2)",
              }}>
                {/* Date column */}
                <div style={{ flexShrink: 0, width: 34, textAlign: "center" }}>
                  <p style={{ margin: 0, fontSize: 10, fontWeight: 700, fontFamily: "var(--g-sans)", color: "var(--g-mute2)", letterSpacing: 0.5 }}>
                    {weekday}
                  </p>
                  <p style={{ margin: "2px 0 0", fontSize: 20, fontWeight: 400, fontFamily: "var(--g-serif)", color: "var(--g-ink)", lineHeight: 1 }}>
                    {date}
                  </p>
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0, paddingTop: 2 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                    <span style={{ width: 7, height: 7, borderRadius: "50%", background: dotColor, flexShrink: 0 }} />
                    <span style={{ fontWeight: 600, fontSize: 14, fontFamily: "var(--g-sans)", color: "var(--g-ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {ev.title}
                    </span>
                  </div>
                  <p style={{ margin: "3px 0 0", fontSize: 12, color: "var(--g-mute2)", fontFamily: "var(--g-sans)" }}>
                    {timeStr}{ev.location ? ` · ${ev.location}` : ""}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Mini stat cards ──────────────────────────────────────────────────────────

function MiniCard({ icon, value, label, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: "var(--g-card)", border: "1px solid var(--g-hair)",
        borderRadius: 20, padding: "18px 20px", boxShadow: "var(--g-shadow-sm)",
        textAlign: "left", cursor: "pointer", width: "100%",
        transition: "box-shadow 0.15s ease, transform 0.15s ease",
      }}
      onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "var(--g-shadow)"; }}
      onMouseLeave={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = "var(--g-shadow-sm)"; }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <p style={{ margin: 0, fontSize: 14, fontWeight: 600, fontFamily: "var(--g-sans)", color: "var(--g-ink)" }}>
          {label.split("\n")[0]}
        </p>
        {icon}
      </div>
      <p style={{ margin: "8px 0 2px", fontSize: 30, fontWeight: 400, fontFamily: "var(--g-serif)", color: "var(--g-ink)", lineHeight: 1 }}>
        {value}
      </p>
      {label.split("\n")[1] && (
        <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--g-mute2)", fontFamily: "var(--g-sans)" }}>
          {label.split("\n")[1]}
        </p>
      )}
    </button>
  );
}

// ─── Garden card ──────────────────────────────────────────────────────────────

function GardenCard({ plants, onNavigate, onWaterPlant }) {
  const displayed = plants.slice(0, 6);

  return (
    <div style={{
      background: "var(--g-card)", border: "1px solid var(--g-hair)",
      borderRadius: 20, padding: "20px 24px", boxShadow: "var(--g-shadow-sm)",
      marginTop: 14,
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, fontFamily: "var(--g-sans)", color: "var(--g-ink)" }}>
          The garden
        </h3>
        <button onClick={() => onNavigate("plants")} style={linkBtnStyle()}>
          All plants →
        </button>
      </div>

      {displayed.length === 0 ? (
        <p style={{ margin: "12px 0 0", fontSize: 13.5, color: "var(--g-muted)", fontFamily: "var(--g-sans)" }}>
          No plants yet. Add some to track watering.
        </p>
      ) : (
        <div>
          {displayed.map(plant => {
            const daysLeft = daysUntilWater(plant);
            const needsWater = daysLeft <= 0;

            return (
              <div key={plant.id} style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "12px 0", borderTop: "1px solid var(--g-hair2)",
              }}>
                {/* Icon */}
                <div style={{
                  width: 32, height: 32, borderRadius: 9, flexShrink: 0,
                  background: "var(--g-sage-bg)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <IconLeaf />
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ fontWeight: 600, fontSize: 13.5, fontFamily: "var(--g-sans)", color: "var(--g-ink)" }}>
                    {plant.name}
                  </span>
                  {plant.location && (
                    <p style={{ margin: "1px 0 0", fontSize: 11.5, color: "var(--g-mute2)", fontFamily: "var(--g-sans)" }}>
                      {plant.location}
                    </p>
                  )}
                </div>

                {/* Water action */}
                {needsWater ? (
                  <button
                    onClick={() => onWaterPlant(plant.id)}
                    style={{
                      background: "var(--g-sky-bg)", border: "none", color: "var(--g-sky)",
                      padding: "6px 13px", borderRadius: 999,
                      fontSize: 12.5, fontWeight: 600, fontFamily: "var(--g-sans)", cursor: "pointer",
                      display: "flex", alignItems: "center", gap: 5, flexShrink: 0,
                    }}
                  >
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                      <path d="M8 2c-3 4-5 6-5 9a5 5 0 0010 0c0-3-2-5-5-9z" stroke="var(--g-sky)" strokeWidth="1.4" strokeLinejoin="round" />
                    </svg>
                    Water
                  </button>
                ) : (
                  <span style={{ fontSize: 12.5, fontWeight: 600, fontFamily: "var(--g-sans)", color: "var(--g-mute2)", flexShrink: 0 }}>
                    ◯ {daysLeft}d
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function linkBtnStyle() {
  return {
    background: "none", border: "none", padding: 0,
    color: "var(--g-muted)", fontFamily: "var(--g-sans)",
    fontSize: 13, fontWeight: 600, cursor: "pointer",
  };
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export default function Dashboard({
  invoices, mealPlan, recipes, maintenanceTasks,
  calendarEvents,
  shopping = { stores: [], items: [] },
  plants = [],
  currentUser,
  settings,
  enabledFeatures = {},
  onNavigate,
  onToggleInvoicePaid, onToggleMaintenanceDone, onWaterPlant,
}) {
  const isFeatureEnabled = (feature) => enabledFeatures[feature] !== false;
  const weather = useWeather(settings?.location);
  const todayKey = useTodayKey();

  const now = useMemo(() => new Date(), []);
  const hour = now.getHours();
  const timeOfDay = hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening";
  const dayName = now.toLocaleDateString("en-US", { weekday: "long" }).toUpperCase();

  const todayMeal = mealPlan[todayKey];
  const todayRecipe = useMemo(() => {
    if (!todayMeal?.recipeId) return null;
    return recipes.find(r => String(r.id) === String(todayMeal.recipeId)) || null;
  }, [todayMeal, recipes]);

  const firstName = useMemo(() => {
    if (currentUser?.username) {
      const name = currentUser.username.split(/[._\s]/)[0];
      return capitalize(name);
    }
    return "there";
  }, [currentUser]);

  const sevenDaysOut = useMemo(() => {
    const d = new Date(now);
    d.setDate(d.getDate() + 7);
    return d;
  }, [now]);

  const attentionInvoices = useMemo(() => {
    if (enabledFeatures.invoices === false) return [];
    return invoices.filter(i => {
    const s = displayStatus(i);
    if (s === "paid") return false;
    if (s === "overdue") return true;
    if (!i.dueDate) return false;
    return new Date(i.dueDate) <= sevenDaysOut;
  });
  }, [enabledFeatures, invoices, sevenDaysOut]);

  const subtitle = useMemo(() => {
    const n = attentionInvoices.length;
    if (n === 0) return "The house is calm.";
    const word = capitalize(toWord(n));
    return `${word} bill${n !== 1 ? "s" : ""} want${n === 1 ? "s" : ""} attention this week. Otherwise — the house is calm.`;
  }, [attentionInvoices]);

  const shoppingUnchecked = useMemo(() => (shopping.items || []).filter(i => !i.checked).length, [shopping]);
  const shoppingStores = (shopping.stores || []).length;

  const maintenanceDueCount = useMemo(() => maintenanceTasks.filter(t => {
    if (t.completed) return false;
    if (!t.nextDue) return true;
    const d = new Date(t.nextDue);
    return d <= sevenDaysOut;
  }).length, [maintenanceTasks, sevenDaysOut]);

  return (
    <div className="page" style={{ fontFamily: "var(--g-sans)" }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 36, gap: 24, flexWrap: "wrap" }}>
        <div>
          <p style={{
            margin: "0 0 6px", fontSize: 11, fontWeight: 700, fontFamily: "var(--g-sans)",
            textTransform: "uppercase", letterSpacing: 1.5, color: "var(--g-mute2)",
          }}>
            {dayName} {timeOfDay}
          </p>
          <h1 style={{
            margin: 0, fontSize: 48, fontWeight: 400,
            fontFamily: "var(--g-serif)", color: "var(--g-ink)",
            lineHeight: 1.05, letterSpacing: "-0.5px",
          }}>
            Good {timeOfDay}, <em>{firstName}</em>
          </h1>
          <p style={{
            margin: "10px 0 0", fontSize: 14.5, color: "var(--g-muted)",
            fontFamily: "var(--g-sans)", lineHeight: 1.5,
          }}>
            {subtitle}
          </p>
        </div>
        <div style={{ flexShrink: 0, paddingTop: 4 }}>
          <WeatherCard weather={weather} />
        </div>
      </div>

      {/* ── Two-column body ─────────────────────────────────────────────────── */}
      <div className="dashboard-main">

        {/* Left column */}
        <div>
          {isFeatureEnabled("meal") && (
            <MealCard
              todayMeal={todayMeal}
              recipe={todayRecipe}
              onOpenRecipe={() => onNavigate("meal")}
            />
          )}
          {isFeatureEnabled("invoices") && (
            <BillsCard
              invoices={invoices}
              onNavigate={onNavigate}
              onTogglePaid={onToggleInvoicePaid}
            />
          )}
        </div>

        {/* Right column */}
        <div>
          {isFeatureEnabled("calendar") && <UpNextCard events={calendarEvents} onNavigate={onNavigate} />}

          {(isFeatureEnabled("shopping") || isFeatureEnabled("maintenance")) && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 0 }}>
              {isFeatureEnabled("shopping") && (
                <MiniCard
                  icon={<IconCart />}
                  value={shoppingUnchecked}
                  label={`Shopping\n${shoppingStores} store${shoppingStores !== 1 ? "s" : ""}`}
                  onClick={() => onNavigate("shopping")}
                />
              )}
              {isFeatureEnabled("maintenance") && (
                <MiniCard
                  icon={<IconWrench />}
                  value={maintenanceDueCount}
                  label={"Maintenance\nthis month"}
                  onClick={() => onNavigate("maintenance")}
                />
              )}
            </div>
          )}

          {isFeatureEnabled("plants") && (
            <GardenCard
              plants={plants}
              onNavigate={onNavigate}
              onWaterPlant={onWaterPlant}
            />
          )}
        </div>
      </div>
    </div>
  );
}
