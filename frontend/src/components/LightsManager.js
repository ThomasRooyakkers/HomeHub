import { useState, useEffect, useCallback, useRef } from "react";
import { apiFetch } from "../lib/api";

const ROOM_ICONS = {
  "living room": "🛋",
  "bedroom":     "🛏",
  "master":      "🛏",
  "kitchen":     "🍳",
  "bathroom":    "🚿",
  "toilet":      "🚽",
  "office":      "💼",
  "study":       "📚",
  "hallway":     "🚪",
  "corridor":    "🚪",
  "garage":      "🚗",
  "garden":      "🌿",
  "outdoor":     "🌿",
  "terrace":     "🌿",
  "dining":      "🍽",
  "laundry":     "🧺",
  "nursery":     "🍼",
  "gym":         "💪",
  "attic":       "📦",
  "basement":    "📦",
};

const ICON_CHOICES = [
  "💡","🛋","🛏","🍳","🚿","🚽","💼","📚","🚪","🚗",
  "🌿","🍽","🧺","🍼","💪","📦","🌅","🎮","🎬","🎵",
  "🖥","🛁","🪴","🧸","🏠","⭐","🌙","☀️","🔆","🎨",
  "🧘","🍷","🐾","🎸","🔬","📷","🛒","🧹","🪑","🛋",
];

function getRoomIcon(name, customIcon) {
  if (customIcon) return customIcon;
  const lower = name.toLowerCase();
  for (const [key, icon] of Object.entries(ROOM_ICONS)) {
    if (lower.includes(key)) return icon;
  }
  return "💡";
}

const LAYOUT_KEY = "hue_layout_v2";
const ORDER_KEY  = "hue_order_v2";
const ICONS_KEY  = "hue_icons_v1";

const loadLayout = () => {
  try { return JSON.parse(localStorage.getItem(LAYOUT_KEY) || "{}"); } catch { return {}; }
};
const saveLayout = (l) => localStorage.setItem(LAYOUT_KEY, JSON.stringify(l));
const loadOrder  = () => {
  try { return JSON.parse(localStorage.getItem(ORDER_KEY) || "[]"); } catch { return []; }
};
const saveOrder  = (o) => localStorage.setItem(ORDER_KEY, JSON.stringify(o));
const loadIcons  = () => {
  try { return JSON.parse(localStorage.getItem(ICONS_KEY) || "{}"); } catch { return {}; }
};
const saveIcons  = (i) => localStorage.setItem(ICONS_KEY, JSON.stringify(i));

// ── Room detail popup ────────────────────────────────────────────────────────

function RoomPopup({ groupId, group, lights, scenes, customIcon, onClose, onToggleLight, onActivateScene, onPickIcon }) {
  const groupLights = (group.lights || []).map(lid => [lid, lights[lid]]).filter(([, l]) => l);
  const roomScenes  = Object.entries(scenes).filter(([, s]) => s.group === groupId && s.type === "GroupScene");
  const icon        = getRoomIcon(group.name, customIcon);

  return (
    <div
      style={{
        position: "fixed", inset: 0,
        background: "rgba(0,0,0,0.55)",
        display: "flex", alignItems: "center", justifyContent: "center",
        zIndex: 1000, padding: 16,
      }}
      onPointerDown={onClose}
    >
      <div
        style={{
          background: "#fff", borderRadius: 24, padding: "24px 24px 28px",
          width: "100%", maxWidth: 480, maxHeight: "80vh", overflowY: "auto",
          boxShadow: "0 24px 64px rgba(0,0,0,0.25)",
        }}
        onPointerDown={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button
              onClick={() => { onPickIcon(groupId); onClose(); }}
              title="Change icon"
              style={{
                background: "#f0fdf4", border: "1.5px solid rgba(34,197,94,0.3)",
                borderRadius: 12, width: 40, height: 40, fontSize: 20,
                cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0,
              }}
            >
              {icon}
            </button>
            <h3 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: "#0f766e" }}>
              {group.name}
            </h3>
          </div>
          <button
            onClick={onClose}
            style={{ background: "#f1f5f9", border: "none", borderRadius: 10, width: 32, height: 32, fontSize: 16, cursor: "pointer", color: "#64748b", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
          >
            ✕
          </button>
        </div>

        {/* Individual lights */}
        <p style={{ margin: "0 0 10px", fontSize: 11, fontWeight: 800, color: "#94a3b8", textTransform: "uppercase", letterSpacing: ".1em" }}>
          Lights
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 20 }}>
          {groupLights.map(([lightId, light]) => (
            <button
              key={lightId}
              onClick={() => onToggleLight(lightId)}
              style={{
                background: light.state.on ? "linear-gradient(135deg,#f0fdf4,#dcfce7)" : "#f8fafc",
                border: `1.5px solid ${light.state.on ? "rgba(34,197,94,0.4)" : "rgba(0,0,0,0.08)"}`,
                borderRadius: 14, padding: "12px 10px", textAlign: "left",
                cursor: "pointer", transition: "all 0.15s ease",
              }}
            >
              <span style={{ fontSize: 20 }}>{light.state.on ? "💡" : "🔌"}</span>
              <p style={{ margin: "6px 0 2px", fontWeight: 700, fontSize: 12, color: "#1e293b", lineHeight: 1.2 }}>{light.name}</p>
              <p style={{ margin: 0, fontSize: 11, color: light.state.on ? "#16a34a" : "#94a3b8", fontWeight: 600 }}>
                {light.state.on ? `${Math.round((light.state.bri / 254) * 100)}%` : "Off"}
              </p>
            </button>
          ))}
        </div>

        {/* Scenes */}
        {roomScenes.length > 0 && (
          <>
            <p style={{ margin: "0 0 10px", fontSize: 11, fontWeight: 800, color: "#94a3b8", textTransform: "uppercase", letterSpacing: ".1em" }}>
              Scenes
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {roomScenes.map(([sceneId, scene]) => (
                <button
                  key={sceneId}
                  onClick={() => { onActivateScene(groupId, sceneId); onClose(); }}
                  style={{
                    background: "linear-gradient(135deg,#f0fdf4,#dcfce7)",
                    border: "1.5px solid rgba(34,197,94,0.3)",
                    borderRadius: 10, padding: "8px 14px",
                    fontSize: 13, fontWeight: 600, color: "#166534",
                    cursor: "pointer", transition: "all 0.15s ease",
                  }}
                >
                  ✨ {scene.name}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Icon picker ──────────────────────────────────────────────────────────────

function IconPicker({ groupName, currentIcon, onSelect, onClose }) {
  return (
    <div
      style={{
        position: "fixed", inset: 0,
        background: "rgba(0,0,0,0.45)",
        display: "flex", alignItems: "center", justifyContent: "center",
        zIndex: 1100, padding: 16,
      }}
      onPointerDown={onClose}
    >
      <div
        style={{
          background: "#fff", borderRadius: 20, padding: 20,
          width: "100%", maxWidth: 360,
          boxShadow: "0 20px 56px rgba(0,0,0,0.22)",
        }}
        onPointerDown={e => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <p style={{ margin: 0, fontWeight: 800, fontSize: 15, color: "#0f766e" }}>
            Pick icon — {groupName}
          </p>
          <button
            onClick={onClose}
            style={{ background: "#f1f5f9", border: "none", borderRadius: 8, width: 28, height: 28, fontSize: 14, cursor: "pointer", color: "#64748b" }}
          >
            ✕
          </button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(8, 1fr)", gap: 6 }}>
          {ICON_CHOICES.map(emoji => (
            <button
              key={emoji}
              onClick={() => { onSelect(emoji); onClose(); }}
              style={{
                background: currentIcon === emoji ? "rgba(34,197,94,0.15)" : "transparent",
                border: currentIcon === emoji ? "2px solid rgba(34,197,94,0.5)" : "2px solid transparent",
                borderRadius: 10, padding: 4, fontSize: 22,
                cursor: "pointer", lineHeight: 1, aspectRatio: "1",
                display: "flex", alignItems: "center", justifyContent: "center",
                transition: "background 0.1s ease",
              }}
              title={emoji}
            >
              {emoji}
            </button>
          ))}
        </div>
        {currentIcon && (
          <button
            onClick={() => { onSelect(null); onClose(); }}
            style={{
              marginTop: 14, width: "100%", background: "#f8fafc",
              border: "1px solid rgba(0,0,0,0.08)", borderRadius: 10,
              padding: "8px 0", fontSize: 12, fontWeight: 700,
              color: "#64748b", cursor: "pointer",
            }}
          >
            Reset to default
          </button>
        )}
      </div>
    </div>
  );
}

// ── Room card ────────────────────────────────────────────────────────────────

const SIZE_BTN = {
  background: "rgba(15,118,110,0.12)",
  border: "1px solid rgba(15,118,110,0.25)",
  borderRadius: 6, padding: "3px 7px",
  fontSize: 10, fontWeight: 800, color: "#0f766e",
  cursor: "pointer", lineHeight: 1.4, whiteSpace: "nowrap",
};

function RoomCard({ groupId, group, lights, scenes, layout, customIcon, onToggleGroup, onToggleLight, onActivateScene, editMode, onLayoutChange, onPickIcon, onDragStart, onDragOver, onDrop, isDragging, isDragTarget }) {
  const [showPopup, setShowPopup] = useState(false);
  const pressTimer   = useRef(null);
  const didLongPress = useRef(false);

  const { w = 1, h = 1 } = layout;
  const isOn = group.action?.on ?? false;
  const icon = getRoomIcon(group.name, customIcon);

  const lightsInRoom = (group.lights || []).map(lid => lights[lid]).filter(Boolean);
  const lightsOn     = lightsInRoom.filter(l => l.state.on).length;

  const handlePointerDown = (e) => {
    if (editMode) return;
    e.preventDefault();
    didLongPress.current = false;
    pressTimer.current = setTimeout(() => {
      didLongPress.current = true;
      setShowPopup(true);
    }, 600);
  };

  const handlePointerUp = () => {
    if (editMode) return;
    clearTimeout(pressTimer.current);
    if (!didLongPress.current) onToggleGroup(groupId);
  };

  const handlePointerLeave = () => clearTimeout(pressTimer.current);
  const handlePointerCancel = () => clearTimeout(pressTimer.current);

  const iconSize = h === 1 ? (w === 1 ? 36 : 44) : 56;
  const nameSize = h === 1 ? (w === 1 ? 13 : 15) : 17;

  return (
    <>
      <div
        draggable={editMode}
        onDragStart={editMode ? () => onDragStart(groupId) : undefined}
        onDragOver={editMode ? (e) => { e.preventDefault(); onDragOver(groupId); } : undefined}
        onDrop={editMode ? (e) => { e.preventDefault(); onDrop(groupId); } : undefined}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerLeave}
        onPointerCancel={handlePointerCancel}
        style={{
          gridColumn: `span ${w}`,
          gridRow: `span ${h}`,
          position: "relative",
          background: isOn
            ? "linear-gradient(145deg, rgba(240,253,244,0.97), rgba(220,252,231,0.93))"
            : "rgba(248,250,252,0.97)",
          border: `2px solid ${isDragTarget ? "#16a34a" : isOn ? "rgba(34,197,94,0.35)" : "rgba(0,0,0,0.07)"}`,
          borderRadius: 20,
          overflow: "hidden",
          cursor: editMode ? "grab" : "pointer",
          userSelect: "none",
          transition: editMode ? "border 0.15s ease" : "all 0.2s ease",
          opacity: isDragging ? 0.45 : 1,
          boxShadow: isOn
            ? "0 4px 20px rgba(34,197,94,0.15)"
            : "0 2px 8px rgba(0,0,0,0.06)",
        }}
      >
        {/* Glow for on-state */}
        {isOn && (
          <div style={{
            position: "absolute", top: -30, right: -30,
            width: 100, height: 100, borderRadius: "50%",
            background: "radial-gradient(circle, rgba(250,204,21,0.25) 0%, transparent 70%)",
            pointerEvents: "none",
          }} />
        )}

        {/* Card body */}
        <div style={{
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          height: "100%", padding: 16,
          minHeight: h === 1 ? 140 : 260,
        }}>
          <div style={{
            fontSize: iconSize, lineHeight: 1, marginBottom: 10,
            filter: isOn ? "none" : "grayscale(0.3) opacity(0.55)",
            transition: "all 0.2s ease",
          }}>
            {icon}
          </div>

          <p style={{
            margin: 0, fontWeight: 800, fontSize: nameSize,
            color: isOn ? "#166534" : "#475569",
            textAlign: "center", lineHeight: 1.2,
          }}>
            {group.name}
          </p>

          <p style={{
            margin: "6px 0 0", fontSize: 11, fontWeight: 600,
            color: isOn ? "#16a34a" : "#94a3b8",
          }}>
            {lightsInRoom.length === 0
              ? "No lights"
              : isOn
                ? `${lightsOn} / ${lightsInRoom.length} on`
                : "Off"}
          </p>
        </div>

        {/* Edit-mode overlay */}
        {editMode && (
          <div style={{
            position: "absolute", inset: 0,
            background: "rgba(15,118,110,0.04)",
            border: "2px dashed rgba(15,118,110,0.25)",
            borderRadius: 18,
            display: "flex", flexDirection: "column",
            alignItems: "flex-end", justifyContent: "flex-start",
            padding: 8, gap: 4,
            pointerEvents: "none",
          }}>
            <div
              style={{ display: "flex", gap: 4, flexWrap: "wrap", justifyContent: "flex-end", pointerEvents: "all" }}
              onPointerDown={e => e.stopPropagation()}
            >
              <button style={SIZE_BTN} onClick={e => { e.stopPropagation(); onLayoutChange(groupId, { w: Math.max(1, w - 1), h }); }} title="Narrower">←W</button>
              <button style={SIZE_BTN} onClick={e => { e.stopPropagation(); onLayoutChange(groupId, { w: Math.min(4, w + 1), h }); }} title="Wider">W→</button>
              <button style={SIZE_BTN} onClick={e => { e.stopPropagation(); onLayoutChange(groupId, { w, h: Math.max(1, h - 1) }); }} title="Shorter">↑H</button>
              <button style={SIZE_BTN} onClick={e => { e.stopPropagation(); onLayoutChange(groupId, { w, h: Math.min(3, h + 1) }); }} title="Taller">H↓</button>
            </div>
            <div style={{ fontSize: 10, color: "#0f766e", fontWeight: 700, pointerEvents: "none" }}>{w}×{h}</div>
          </div>
        )}
      </div>

      {showPopup && (
        <RoomPopup
          groupId={groupId}
          group={group}
          lights={lights}
          scenes={scenes}
          customIcon={customIcon}
          onClose={() => setShowPopup(false)}
          onToggleLight={onToggleLight}
          onActivateScene={onActivateScene}
          onPickIcon={onPickIcon}
        />
      )}
    </>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export default function LightsManager({ apiEnabled, showToast }) {
  const [lights, setLights]           = useState({});
  const [groups, setGroups]           = useState({});
  const [scenes, setScenes]           = useState({});
  const [loading, setLoading]         = useState(true);
  const [hueAvailable, setHueAvailable] = useState(true);
  const [layout, setLayout]           = useState(loadLayout);
  const [order, setOrder]             = useState(loadOrder);
  const [editMode, setEditMode]       = useState(false);
  const [dragSource, setDragSource]   = useState(null);
  const [dragTarget, setDragTarget]   = useState(null);
  const [customIcons, setCustomIcons] = useState(loadIcons);
  const [iconPickerFor, setIconPickerFor] = useState(null);

  const fetchState = useCallback(async () => {
    if (!apiEnabled) return;
    try {
      const [l, g, s] = await Promise.all([
        apiFetch("/api/hue/lights"),
        apiFetch("/api/hue/groups"),
        apiFetch("/api/hue/scenes"),
      ]);
      setLights(l || {});
      setGroups(g || {});
      setScenes(s || {});
      setHueAvailable(true);
    } catch (err) {
      if (err?.status === 503) setHueAvailable(false);
      console.warn("Hue fetch failed:", err?.message);
    } finally {
      setLoading(false);
    }
  }, [apiEnabled]);

  useEffect(() => {
    fetchState();
    const id = setInterval(fetchState, 30_000);
    return () => clearInterval(id);
  }, [fetchState]);

  // Merge any new room IDs into order array
  useEffect(() => {
    const roomIds = Object.entries(groups)
      .filter(([, g]) => g.type === "Room")
      .map(([id]) => id);
    setOrder(prev => {
      const kept    = prev.filter(id => roomIds.includes(id));
      const newOnes = roomIds.filter(id => !kept.includes(id));
      const merged  = [...kept, ...newOnes];
      saveOrder(merged);
      return merged;
    });
  }, [groups]);

  const handleLayoutChange = useCallback((groupId, newLayout) => {
    setLayout(prev => {
      const updated = { ...prev, [groupId]: newLayout };
      saveLayout(updated);
      return updated;
    });
  }, []);

  const handleIconSelect = useCallback((groupId, emoji) => {
    setCustomIcons(prev => {
      const updated = emoji ? { ...prev, [groupId]: emoji } : Object.fromEntries(Object.entries(prev).filter(([k]) => k !== groupId));
      saveIcons(updated);
      return updated;
    });
  }, []);

  const toggleLight = async (id) => {
    const light = lights[id];
    if (!light) return;
    const newOn = !light.state.on;
    setLights(prev => ({ ...prev, [id]: { ...prev[id], state: { ...prev[id].state, on: newOn } } }));
    try {
      await apiFetch(`/api/hue/lights/${id}/state`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ on: newOn }),
      });
    } catch (err) {
      setLights(prev => ({ ...prev, [id]: { ...prev[id], state: { ...prev[id].state, on: !newOn } } }));
      showToast(err?.message || "Failed to toggle light", "danger");
    }
  };

  const toggleGroup = async (id) => {
    const group = groups[id];
    if (!group) return;
    const newOn = !group.action?.on;
    setGroups(prev => ({ ...prev, [id]: { ...prev[id], action: { ...prev[id].action, on: newOn } } }));
    try {
      await apiFetch(`/api/hue/groups/${id}/action`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ on: newOn }),
      });
    } catch (err) {
      setGroups(prev => ({ ...prev, [id]: { ...prev[id], action: { ...prev[id].action, on: !newOn } } }));
      showToast(err?.message || "Failed to toggle group", "danger");
    }
  };

  const activateScene = async (groupId, sceneId) => {
    try {
      await apiFetch(`/api/hue/groups/${groupId}/scene`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scene: sceneId }),
      });
      showToast("Scene activated", "success");
      setTimeout(fetchState, 800);
    } catch (err) {
      showToast(err?.message || "Failed to activate scene", "danger");
    }
  };

  const handleDragStart  = (id) => { setDragSource(id); setDragTarget(null); };
  const handleDragOver   = (id) => { if (id !== dragSource) setDragTarget(id); };
  const handleDrop       = (targetId) => {
    if (!dragSource || dragSource === targetId) { setDragSource(null); setDragTarget(null); return; }
    setOrder(prev => {
      const next    = [...prev];
      const fromIdx = next.indexOf(dragSource);
      const toIdx   = next.indexOf(targetId);
      next.splice(fromIdx, 1);
      next.splice(toIdx, 0, dragSource);
      saveOrder(next);
      return next;
    });
    setDragSource(null);
    setDragTarget(null);
  };

  if (!hueAvailable) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "#64748b" }}>
        <p style={{ fontSize: 32, margin: 0 }}>💡</p>
        <p style={{ margin: "16px 0 8px", fontSize: 18, fontWeight: 800, color: "#0f766e" }}>Hue not configured</p>
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.7 }}>
          Set <code style={{ background: "#f1f5f9", padding: "2px 6px", borderRadius: 6 }}>HUE_BRIDGE_IP</code> and{" "}
          <code style={{ background: "#f1f5f9", padding: "2px 6px", borderRadius: 6 }}>HUE_API_KEY</code> in your{" "}
          <code style={{ background: "#f1f5f9", padding: "2px 6px", borderRadius: 6 }}>.env</code> file and restart the server.
        </p>
      </div>
    );
  }

  if (loading) {
    return <p style={{ color: "#64748b", padding: 32, fontSize: 15 }}>Loading lights…</p>;
  }

  const orderedRooms = order
    .filter(id => groups[id]?.type === "Room")
    .map(id => [id, groups[id]]);

  return (
    <div style={{ display: "grid", gap: 24 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
        <div>
          <p style={{ margin: 0, textTransform: "uppercase", letterSpacing: ".18em", fontSize: 12, color: "#15803d", fontWeight: 800 }}>Smart Home</p>
          <h2 style={{ margin: "12px 0 0", fontSize: 38, fontWeight: 900, color: "#0f766e" }}>Lights</h2>
          <p style={{ margin: "16px 0 0", color: "#475569", fontSize: 16, lineHeight: 1.7 }}>
            {editMode
              ? "Drag to reorder • buttons to resize"
              : "Tap to toggle all • hold to see lights & scenes"}
          </p>
        </div>
        <button
          onClick={() => setEditMode(e => !e)}
          style={{
            background: editMode ? "linear-gradient(135deg,#16a34a,#22c55e)" : "#f1f5f9",
            border: "none", color: editMode ? "#fff" : "#475569",
            padding: "10px 20px", borderRadius: 12,
            fontWeight: 700, cursor: "pointer", fontSize: 14,
            transition: "all 0.15s ease",
          }}
        >
          {editMode ? "✓ Done" : "✏ Edit Layout"}
        </button>
      </div>

      {iconPickerFor && groups[iconPickerFor] && (
        <IconPicker
          groupName={groups[iconPickerFor].name}
          currentIcon={customIcons[iconPickerFor] || null}
          onSelect={(emoji) => handleIconSelect(iconPickerFor, emoji)}
          onClose={() => setIconPickerFor(null)}
        />
      )}

      {/* Grid */}
      {orderedRooms.length === 0 ? (
        <div style={{ padding: 32, borderRadius: 20, background: "rgba(255,255,255,0.9)", border: "1px solid rgba(34,197,94,0.1)", color: "#64748b", fontSize: 15, textAlign: "center" }}>
          No rooms found on your Hue bridge.
        </div>
      ) : (
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gridAutoRows: "170px",
          gap: 16,
        }}>
          {orderedRooms.map(([groupId, group]) => (
            <RoomCard
              key={groupId}
              groupId={groupId}
              group={group}
              lights={lights}
              scenes={scenes}
              layout={layout[groupId] || { w: 1, h: 1 }}
              customIcon={customIcons[groupId] || null}
              onToggleGroup={toggleGroup}
              onToggleLight={toggleLight}
              onActivateScene={activateScene}
              editMode={editMode}
              onLayoutChange={handleLayoutChange}
              onPickIcon={setIconPickerFor}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              isDragging={dragSource === groupId}
              isDragTarget={dragTarget === groupId}
            />
          ))}
        </div>
      )}
    </div>
  );
}
