import { useState, useEffect } from "react";
import { apiFetch } from "../lib/api";
import { parseICS } from "../lib/ics";
import { fmtDate, dateKey, useTodayKey } from "../lib/utils";

const PROVIDER_COLORS = ["#16a34a", "#3b82f6", "#8b5cf6", "#f59e0b", "#ef4444", "#06b6d4", "#ec4899"];
const DAY_NAMES    = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTH_NAMES  = ["January","February","March","April","May","June","July","August","September","October","November","December"];

function providerColor(providers, calendarId) {
  const idx = providers.findIndex(p => p.id === calendarId);
  return PROVIDER_COLORS[idx >= 0 ? idx % PROVIDER_COLORS.length : 0];
}

// ─── Month grid ────────────────────────────────────────────────────────────────

function MonthGrid({ year, month, events, providers, selectedDay, onDayClick, today }) {
  const todayStr = today;

  // Group events by start date (show on start day only)
  const byDay = {};
  events.forEach(e => {
    const k = dateKey(e.start);
    (byDay[k] = byDay[k] || []).push(e);
  });

  // Cells: leading blanks + day numbers, padded to full weeks
  const firstDow = (new Date(year, month, 1).getDay() + 6) % 7; // Mon=0
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", marginBottom: 6 }}>
        {DAY_NAMES.map((d, i) => (
          <div key={d} style={{ textAlign: "center", fontSize: 12, fontWeight: 700, color: i >= 5 ? "#94a3b8" : "#64748b", padding: "6px 0" }}>{d}</div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 3 }}>
        {cells.map((day, idx) => {
          if (!day) return <div key={`b-${idx}`} />;
          const ds     = `${year}-${String(month + 1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
          const evs    = byDay[ds] || [];
          const isToday    = ds === todayStr;
          const isSel      = ds === selectedDay;
          const isWeekend  = idx % 7 >= 5;
          return (
            <button
              key={ds}
              onClick={() => onDayClick(isSel ? null : ds)}
              className="cal-day-btn"
              style={{
                background: isSel ? "#16a34a" : isToday ? "rgba(22,163,74,0.1)" : "#fff",
                border: isSel ? "2px solid #16a34a" : isToday ? "2px solid rgba(22,163,74,0.4)" : "1px solid #e5e7eb",
                borderRadius: 10, padding: "6px 2px 8px",
                cursor: "pointer", textAlign: "center",
                display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
                transition: "background 0.12s ease",
              }}
              onMouseEnter={e => { if (!isSel) e.currentTarget.style.background = "rgba(22,163,74,0.06)"; }}
              onMouseLeave={e => { if (!isSel) e.currentTarget.style.background = isToday ? "rgba(22,163,74,0.1)" : "#fff"; }}
            >
              <span style={{ fontSize: 13, fontWeight: isToday ? 800 : 400, color: isSel ? "#fff" : isToday ? "#16a34a" : isWeekend ? "#9ca3af" : "#374151" }}>
                {day}
              </span>
              {evs.length > 0 && (
                <div style={{ display: "flex", gap: 2, flexWrap: "wrap", justifyContent: "center", maxWidth: 36 }}>
                  {evs.slice(0, 3).map((ev, i) => (
                    <span key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: isSel ? "rgba(255,255,255,0.8)" : providerColor(providers, ev.calendarId), flexShrink: 0 }} />
                  ))}
                  {evs.length > 3 && <span style={{ fontSize: 9, color: isSel ? "rgba(255,255,255,0.8)" : "#94a3b8" }}>+{evs.length - 3}</span>}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── CalendarView ──────────────────────────────────────────────────────────────

export default function CalendarView({
  calendarProviders, setCalendarProviders,
  calendarEvents, setCalendarEvents,
  apiEnabled, showToast, onRefresh,
}) {
  const todayKey = useTodayKey();
  const [viewDate,    setViewDate]    = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(() => dateKey(new Date()));
  const [provider,    setProvider]    = useState("Apple Calendar");
  const [refreshing,  setRefreshing]  = useState(false);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [calName,     setCalName]     = useState("");
  const [calUrl,      setCalUrl]      = useState("");
  const [importError, setImportError] = useState("");
  const [importing,   setImporting]   = useState(false);

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") setImportError(""); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const year  = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const prevMonth = () => setViewDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  const nextMonth = () => setViewDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1));
  const goToday   = () => { setViewDate(new Date()); setSelectedDay(todayKey); };

  const handleRefresh = async () => {
    setRefreshing(true);
    await onRefresh();
    setLastRefresh(new Date());
    setRefreshing(false);
    showToast("Calendars refreshed");
  };

  // Events for the selected day
  const selectedDayEvents = selectedDay
    ? calendarEvents
        .filter(e => dateKey(e.start) === selectedDay)
        .sort((a, b) => new Date(a.start) - new Date(b.start))
    : [];

  // Upcoming events (for when no day is selected)
  const upcomingEvents = calendarEvents
    .map(e => ({ ...e, _d: new Date(e.start) }))
    .filter(e => dateKey(e._d) >= todayKey)
    .sort((a, b) => a._d - b._d)
    .slice(0, 12);

  // ── Import helpers ────────────────────────────────────────────────────────────

  const persistCalendar = async (nextProviders, nextEvents) => {
    if (apiEnabled) {
      await apiFetch("/api/calendar", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ providers: nextProviders, events: nextEvents }),
      });
    }
  };

  const addCalendar = (events, sourceName = null) => {
    const cal = {
      id: Date.now(), provider, name: calName || sourceName || provider,
      source: calUrl.trim() || (sourceName ? "file upload" : "unknown"),
      addedAt: new Date().toISOString(),
    };
    const nextProviders = [...calendarProviders, cal];
    const nextEvents    = [...calendarEvents, ...events.map(ev => ({ ...ev, calendarId: cal.id }))];
    setCalendarProviders(nextProviders);
    setCalendarEvents(nextEvents);
    persistCalendar(nextProviders, nextEvents);
    showToast(`${events.length} events imported from ${provider}`);
    setCalName(""); setCalUrl(""); setImportError("");
  };

  const handleImportFromUrl = async () => {
    if (!calUrl.trim()) { setImportError("Enter a calendar URL first."); return; }
    setImportError(""); setImporting(true);
    try {
      if (apiEnabled) {
        // Use raw fetch (not apiFetch) so we can read the error body on non-2xx
        const resp = await fetch("/api/calendar-import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: calUrl.trim(), provider }),
        });
        const data = await resp.json();
        if (!resp.ok) { setImportError(data.error || `Import failed (HTTP ${resp.status})`); return; }
        addCalendar(data.events);
      } else {
        // Direct fetch — will fail for most external URLs due to CORS
        let fetchUrl = calUrl.trim()
          .replace(/^webcal:\/\//,  "https://")
          .replace(/^webcals:\/\//, "https://");
        const res = await fetch(fetchUrl);
        if (!res.ok) { setImportError(`Calendar server returned HTTP ${res.status}`); return; }
        const events = parseICS(await res.text(), provider);
        if (!events.length) { setImportError("No events found in this calendar."); return; }
        addCalendar(events);
      }
    } catch (err) {
      setImportError(`Error: ${err.message || "Unable to import calendar"}`);
    } finally {
      setImporting(false);
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const events = parseICS(ev.target.result, provider);
      if (!events.length) { setImportError("No events found in this file."); return; }
      addCalendar(events, file.name);
    };
    reader.readAsText(file);
  };

  const removeCalendar = async (calId) => {
    if (apiEnabled) {
      const result = await apiFetch(`/api/calendar/providers/${calId}`, { method: "DELETE" });
      if (result) { setCalendarProviders(result.providers); setCalendarEvents(result.events); showToast("Calendar removed", "danger"); return; }
    }
    setCalendarProviders(prev => prev.filter(p => p.id !== calId));
    setCalendarEvents(prev => prev.filter(e => e.calendarId !== calId));
    showToast("Calendar removed", "danger");
  };

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: "grid", gap: 24 }}>

      {/* ── Monthly calendar card ──────────────────────────────────────────── */}
      <div style={card}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button onClick={prevMonth} style={navBtn}>‹</button>
            <h3 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: "#166534", minWidth: 180, textAlign: "center" }}>
              {MONTH_NAMES[month]} {year}
            </h3>
            <button onClick={nextMonth} style={navBtn}>›</button>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button onClick={goToday} style={{ background: "rgba(22,163,74,0.1)", border: "1px solid rgba(22,163,74,0.2)", color: "#16a34a", borderRadius: 10, padding: "8px 16px", cursor: "pointer", fontSize: 13, fontWeight: 700 }}>
              Today
            </button>
            {calendarProviders.some(p => p.source && !["file upload", "unknown"].includes(p.source)) && (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2 }}>
                <button
                  onClick={handleRefresh}
                  disabled={refreshing}
                  style={{ background: refreshing ? "#f1f5f9" : "rgba(22,163,74,0.08)", border: "1px solid rgba(22,163,74,0.15)", color: refreshing ? "#94a3b8" : "#16a34a", borderRadius: 10, padding: "8px 14px", cursor: refreshing ? "not-allowed" : "pointer", fontSize: 13, fontWeight: 700 }}
                >
                  {refreshing ? "Refreshing…" : "↻ Refresh"}
                </button>
                {lastRefresh && (
                  <span style={{ fontSize: 11, color: "#94a3b8" }}>
                    {lastRefresh.toLocaleTimeString("nl-BE", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {calendarProviders.length === 0 ? (
          <div style={{ padding: "32px 0", textAlign: "center", color: "#94a3b8", fontSize: 14 }}>
            No calendars imported yet. Add one below to see events on the grid.
          </div>
        ) : (
          <MonthGrid
            year={year} month={month}
            events={calendarEvents} providers={calendarProviders}
            selectedDay={selectedDay} onDayClick={setSelectedDay}
            today={todayKey}
          />
        )}

        {/* Provider legend */}
        {calendarProviders.length > 0 && (
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 18 }}>
            {calendarProviders.map((p, i) => (
              <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 10, height: 10, borderRadius: "50%", background: PROVIDER_COLORS[i % PROVIDER_COLORS.length], display: "block", flexShrink: 0 }} />
                <span style={{ fontSize: 13, color: "#64748b", fontWeight: 500 }}>{p.name}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Events + Import ────────────────────────────────────────────────── */}
      <div className="cal-grid">

        {/* Events panel */}
        <div style={card}>
          {selectedDay ? (
            <>
              <h3 style={{ margin: "0 0 16px", fontSize: 18, fontWeight: 800, color: "#166534" }}>
                {fmtDate(selectedDay)}
              </h3>
              {selectedDayEvents.length ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {selectedDayEvents.map(ev => <EventRow key={ev.uid} ev={ev} providers={calendarProviders} />)}
                </div>
              ) : (
                <p style={{ margin: 0, color: "#94a3b8", fontSize: 14 }}>No events on this day.</p>
              )}
            </>
          ) : (
            <>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#166534" }}>Upcoming events</h3>
                <span style={{ fontSize: 13, color: "#94a3b8", fontWeight: 600 }}>{upcomingEvents.length} shown</span>
              </div>
              {upcomingEvents.length ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {upcomingEvents.map(ev => <EventRow key={ev.uid} ev={ev} providers={calendarProviders} />)}
                </div>
              ) : (
                <p style={{ margin: 0, color: "#94a3b8", fontSize: 14 }}>No upcoming events. Import a calendar to see your schedule.</p>
              )}
            </>
          )}
        </div>

        {/* Import + providers */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Imported calendars */}
          <div style={card}>
            <h3 style={{ margin: "0 0 14px", fontSize: 16, fontWeight: 800, color: "#166534" }}>Imported calendars</h3>
            {calendarProviders.length ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {calendarProviders.map((item, i) => (
                  <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: "rgba(240,253,244,0.8)", border: "1px solid rgba(34,197,94,0.1)", borderRadius: 12 }}>
                    <span style={{ width: 10, height: 10, borderRadius: "50%", background: PROVIDER_COLORS[i % PROVIDER_COLORS.length], flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#166534", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.name}</p>
                      <p style={{ margin: "2px 0 0", color: "#94a3b8", fontSize: 12 }}>{item.provider} · {calendarEvents.filter(e => e.calendarId === item.id).length} events</p>
                    </div>
                    <button onClick={() => removeCalendar(item.id)} title="Remove" style={{ background: "none", border: "none", color: "#dc2626", cursor: "pointer", fontSize: 16, padding: "2px 4px", flexShrink: 0 }}>×</button>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ margin: 0, color: "#94a3b8", fontSize: 13 }}>No calendars yet.</p>
            )}
          </div>

          {/* Import form */}
          <div style={card}>
            <h3 style={{ margin: "0 0 14px", fontSize: 16, fontWeight: 800, color: "#166534" }}>Import calendar</h3>
            <div style={{ display: "grid", gap: 12 }}>
              <div>
                <label style={lbl}>Provider</label>
                <select value={provider} onChange={e => setProvider(e.target.value)} style={inp}>
                  {["Apple Calendar", "Google Calendar", "Outlook", "Other"].map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Name (optional)</label>
                <input value={calName} onChange={e => setCalName(e.target.value)} placeholder={`My ${provider}`} style={inp} />
              </div>
              <div>
                <label style={lbl}>Calendar URL</label>
                <input value={calUrl} onChange={e => setCalUrl(e.target.value)} placeholder="webcal:// or https://" style={inp} />
                <button onClick={handleImportFromUrl} disabled={importing} style={{ width: "100%", marginTop: 8, background: importing ? "#94a3b8" : "linear-gradient(135deg, #16a34a, #22c55e)", border: "none", borderRadius: 10, padding: "11px", color: "#fff", fontWeight: 700, cursor: importing ? "not-allowed" : "pointer", fontSize: 13 }}>
                  {importing ? "Importing…" : "Import from URL"}
                </button>
              </div>
              <div>
                <label style={lbl}>Upload .ics file</label>
                <input type="file" accept=".ics" onChange={handleFileUpload} style={{ width: "100%", fontSize: 13 }} />
              </div>
              {importError && (
                <div style={{ background: "#fef2f2", border: "1px solid rgba(220,38,38,0.2)", color: "#b91c1c", borderRadius: 10, padding: "12px 14px", fontSize: 13, lineHeight: 1.5 }}>
                  {importError}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Event row ─────────────────────────────────────────────────────────────────

function EventRow({ ev, providers }) {
  const color = providerColor(providers, ev.calendarId);
  return (
    <div style={{ display: "flex", gap: 12, padding: "12px 14px", background: "rgba(240,253,244,0.7)", border: "1px solid rgba(34,197,94,0.1)", borderRadius: 14, alignItems: "flex-start" }}>
      <span style={{ width: 10, height: 10, borderRadius: "50%", background: color, flexShrink: 0, marginTop: 4 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#166534" }}>{ev.title}</p>
        <p style={{ margin: "3px 0 0", fontSize: 12, color: "#64748b" }}>
          {fmtDate(ev.start)}
          {ev.end && ev.end !== ev.start ? ` – ${fmtDate(ev.end)}` : ""}
        </p>
        {ev.location && <p style={{ margin: "3px 0 0", fontSize: 12, color: "#94a3b8" }}>📍 {ev.location}</p>}
        {ev.description && <p style={{ margin: "4px 0 0", fontSize: 12, color: "#94a3b8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ev.description}</p>}
      </div>
    </div>
  );
}

// ─── Style constants ───────────────────────────────────────────────────────────

const card   = { background: "rgba(255,255,255,0.95)", border: "1px solid rgba(34,197,94,0.1)", borderRadius: 20, padding: 22, boxShadow: "0 4px 16px rgba(22,163,74,0.06)" };
const navBtn = { background: "rgba(22,163,74,0.08)", border: "1px solid rgba(22,163,74,0.15)", color: "#16a34a", borderRadius: 8, padding: "6px 14px", cursor: "pointer", fontSize: 18, fontWeight: 700, lineHeight: 1 };
const lbl    = { fontSize: 13, color: "#4b5563", display: "block", marginBottom: 5, fontWeight: 600 };
const inp    = { width: "100%", background: "#fff", border: "1px solid rgba(34,197,94,0.2)", borderRadius: 10, padding: "10px 14px", color: "#166534", fontSize: 14, boxSizing: "border-box" };
