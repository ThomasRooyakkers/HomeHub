import { useState, useEffect } from "react";
import { apiFetch } from "../lib/api";

const PRESET_IMAGES = [
  { id: "bird-of-paradise", label: "Bird of Paradise", emoji: "🌴" },
  { id: "monstera", label: "Monstera", emoji: "🍃" },
  { id: "pothos", label: "Pothos", emoji: "🌿" },
  { id: "snake-plant", label: "Snake Plant", emoji: "🌱" },
  { id: "peace-lily", label: "Peace Lily", emoji: "💮" },
  { id: "philodendron", label: "Philodendron", emoji: "🪴" },
];

const PLANT_FORM_DEFAULT = { id: null, name: "", wateringFrequency: "weekly", lastWatered: "", feedingFrequency: "monthly", lastFed: "", notes: "", imageId: "bird-of-paradise" };

const labelStyle = { fontSize: 14, color: "#4b5563", display: "block", marginBottom: 6, fontWeight: 600 };
const inputStyle = { width: "100%", background: "rgba(255,255,255,0.95)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: 16, padding: "14px 16px", color: "#134e4a", fontSize: 15, boxSizing: "border-box" };
const buttonStyle = { background: "linear-gradient(135deg, #16a34a, #22c55e)", border: "none", color: "#fff", padding: "14px 22px", borderRadius: 999, fontSize: 15, fontWeight: 700, cursor: "pointer", boxShadow: "0 12px 28px rgba(22,163,74,0.25)" };
const cancelButtonStyle = { flex: 1, padding: "14px", background: "rgba(255,255,255,0.95)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: 16, color: "#64748b", cursor: "pointer", fontSize: 15, fontWeight: 600 };
const modalBackdropStyle = { position: "fixed", inset: 0, background: "rgba(0,0,0,0.36)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 };
const modalBoxStyle = { background: "rgba(255,255,255,0.98)", backdropFilter: "blur(18px)", border: "1px solid rgba(34,197,94,0.12)", borderRadius: 24, padding: 32, maxWidth: 540, width: "100%", boxShadow: "0 24px 48px rgba(15,23,42,0.16)", maxHeight: "calc(100dvh - 64px)", overflowY: "auto" };
const actionButtonStyle = { background: "rgba(255,255,255,0.95)", border: "1px solid rgba(34,197,94,0.2)", color: "#16a34a", borderRadius: 14, padding: "12px 16px", cursor: "pointer", fontSize: 14, fontWeight: 700 };

export default function PlantManager({ plants, setPlants, apiEnabled, showToast }) {
  const [editingPlant, setEditingPlant] = useState(null);
  const [deletingPlant, setDeletingPlant] = useState(null);

  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === "Escape") {
        setEditingPlant(null);
        setDeletingPlant(null);
      }
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, []);

  const handleSavePlant = async () => {
    if (!editingPlant.name.trim()) return;
    const isNew = !editingPlant.id;
    const plantData = { ...editingPlant, id: editingPlant.id || Date.now() };
    if (apiEnabled) {
      const method = isNew ? "POST" : "PUT";
      const url = isNew ? "/api/plants" : `/api/plants/${plantData.id}`;
      const result = await apiFetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(plantData),
      });
      if (result) {
        setPlants(prev => isNew ? [...prev, result] : prev.map(p => p.id === plantData.id ? result : p));
        showToast(isNew ? "Plant added" : "Plant updated");
        setEditingPlant(null);
        return;
      }
    }
    setPlants(prev => isNew ? [...prev, plantData] : prev.map(p => p.id === plantData.id ? plantData : p));
    showToast(isNew ? "Plant added" : "Plant updated");
    setEditingPlant(null);
  };

  const handleDeletePlant = async () => {
    if (apiEnabled) {
      const result = await apiFetch(`/api/plants/${deletingPlant}`, { method: "DELETE" });
      if (result) {
        setPlants(prev => prev.filter(p => p.id !== deletingPlant));
        showToast("Plant deleted", "danger");
        setDeletingPlant(null);
        return;
      }
    }
    setPlants(prev => prev.filter(p => p.id !== deletingPlant));
    showToast("Plant deleted", "danger");
    setDeletingPlant(null);
  };

  const markWatered = async (id) => {
    const updated = { ...plants.find(p => p.id === id), lastWatered: new Date().toISOString().slice(0, 10) };
    if (apiEnabled) {
      const result = await apiFetch(`/api/plants/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updated),
      });
      if (result) {
        setPlants(prev => prev.map(p => p.id === id ? result : p));
        showToast("Marked as watered");
        return;
      }
    }
    setPlants(prev => prev.map(p => p.id === id ? updated : p));
    showToast("Marked as watered");
  };

  const markFed = async (id) => {
    const updated = { ...plants.find(p => p.id === id), lastFed: new Date().toISOString().slice(0, 10) };
    if (apiEnabled) {
      const result = await apiFetch(`/api/plants/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updated),
      });
      if (result) {
        setPlants(prev => prev.map(p => p.id === id ? result : p));
        showToast("Marked as fed");
        return;
      }
    }
    setPlants(prev => prev.map(p => p.id === id ? updated : p));
    showToast("Marked as fed");
  };

  const getFrequencyDays = (frequency) => {
    switch (frequency) {
      case "daily": return 1;
      case "weekly": return 7;
      case "biweekly": return 14;
      case "monthly": return 30;
      case "quarterly": return 90;
      default: return 7;
    }
  };

  const parseDate = (value) => {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : new Date(date.getFullYear(), date.getMonth(), date.getDate());
  };

  const addDays = (date, days) => new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
  const normalize = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

  const getNextDueDate = (lastDate, frequency) => {
    const start = parseDate(lastDate) || normalize(new Date());
    return addDays(start, getFrequencyDays(frequency));
  };

  const getDaysUntil = (date) => {
    const today = normalize(new Date());
    return Math.ceil((date.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
  };

  const getDueText = (days) => {
    if (days < 0) return `${Math.abs(days)}d overdue`;
    if (days === 0) return "Today";
    return `${days}d`;
  };

  const plantStatus = (plant) => {
    const waterDue = getNextDueDate(plant.lastWatered, plant.wateringFrequency);
    const feedDue = getNextDueDate(plant.lastFed, plant.feedingFrequency);
    const needsWater = getDaysUntil(waterDue) <= 0;
    const needsFeed = getDaysUntil(feedDue) <= 0;
    if (needsWater || needsFeed) return "Needs attention";
    return "Healthy";
  };

  const statusBadgeStyle = (status) => ({
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "10px 16px",
    borderRadius: 999,
    fontSize: 13,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: ".08em",
    background: status === "Healthy" ? "rgba(16,185,129,0.14)" : "rgba(254,202,202,0.3)",
    color: status === "Healthy" ? "#166534" : "#991b1b",
    border: status === "Healthy" ? "1px solid rgba(16,185,129,0.22)" : "1px solid rgba(239,68,68,0.18)",
  });

  const cardHeaderStyle = { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 18, flexWrap: "wrap" };
  const plantCardStyle = {
    background: "#fbf7ee",
    border: "1px solid rgba(216,207,184,0.55)",
    borderRadius: 24,
    overflow: "hidden",
    boxShadow: "0 14px 28px rgba(15, 23, 42, 0.08)",
    position: "relative",
  };
  const cardIndexStyle = {
    position: "absolute",
    top: 14,
    right: 16,
    fontFamily: "Inter, system-ui, sans-serif",
    fontSize: 11,
    color: "#6b6b57",
    letterSpacing: ".12em",
    fontWeight: 700,
  };
  const plantImageWrapperStyle = {
    background: "linear-gradient(180deg, #f3ecde 0%, #fbf7ee 100%)",
    padding: "28px 18px 16px",
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "center",
    minHeight: 220,
  };
  const plantImageStyle = {
    width: "100%",
    maxWidth: 160,
    minHeight: 160,
    borderRadius: 28,
    background: "linear-gradient(135deg, #e6d5b8, #fdfbf7)",
    display: "grid",
    placeItems: "center",
    fontSize: 80,
    color: "#2d5a3d",
    boxShadow: "0 28px 48px rgba(26, 38, 29, 0.18), 0 12px 24px rgba(26, 38, 29, 0.12)",
  };
  const plantBodyStyle = { display: "grid", gap: 14, padding: "16px 16px 20px" };
  const plantHeaderStyle = { display: "grid", gap: 6 };
  const plantTitleStyle = { margin: 0, fontSize: 18, fontWeight: 700, color: "#1a261d", lineHeight: 1.1 };
  const plantSubtextStyle = { margin: 0, color: "#4a5648", fontSize: 13, lineHeight: 1.5 };
  const plantInfoRowStyle = { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 };
  const plantInfoItemStyle = {
    background: "rgba(255,255,255,0.92)",
    borderRadius: 18,
    padding: 12,
    border: "1px solid rgba(216,207,184,0.6)",
    display: "grid",
    gap: 6,
  };
  const detailLabelStyle = { fontSize: 11, color: "#4b5643", textTransform: "uppercase", letterSpacing: ".12em", fontWeight: 700 };
  const detailValueStyle = { fontSize: 15, fontWeight: 700, color: "#1a261d" };

  return (
    <div style={{ display: "grid", gap: 24 }}>
      <div style={cardHeaderStyle}>
        <div>
          <p style={{ margin: 0, textTransform: "uppercase", letterSpacing: ".18em", fontSize: 12, color: "#15803d", fontWeight: 800 }}>My plants</p>
          <h2 style={{ margin: "12px 0 0", fontSize: 38, fontWeight: 900, color: "#0f766e" }}>All your plants</h2>
          <p style={{ margin: "16px 0 0", color: "#475569", fontSize: 16, maxWidth: 620, lineHeight: 1.7 }}>
            Keep your indoor garden thriving with care reminders, water and feed tracking, and a polished overview of every plant.
          </p>
        </div>
        <button onClick={() => setEditingPlant({ ...PLANT_FORM_DEFAULT })} style={buttonStyle}>
          + Add Plant
        </button>
      </div>

      {plants.length === 0 ? (
        <div style={{ padding: 36, borderRadius: 28, background: "rgba(255,255,255,0.96)", border: "1px solid rgba(16,185,129,0.16)", color: "#475569", fontSize: 17, textAlign: "center", boxShadow: "0 18px 36px rgba(16,185,129,0.08)" }}>
          No plants yet. Add one to start tracking your watering and feeding routine.
        </div>
      ) : (
        <div className="plant-cards-grid">
          {plants.map((plant, index) => {
            const waterDue = getNextDueDate(plant.lastWatered, plant.wateringFrequency);
            const feedDue = getNextDueDate(plant.lastFed, plant.feedingFrequency);
            const waterDays = getDaysUntil(waterDue);
            const feedDays = getDaysUntil(feedDue);
            const status = plantStatus(plant);

            return (
              <div key={plant.id} style={plantCardStyle}>
                <div style={cardIndexStyle}>{`#${index + 1}`}</div>
                <div style={plantImageWrapperStyle}>
                  <div style={plantImageStyle}>{PRESET_IMAGES.find(img => img.id === plant.imageId)?.emoji || '🪴'}</div>
                </div>
                <div style={plantBodyStyle}>
                  <div style={plantHeaderStyle}>
                    <div>
                      <h3 style={plantTitleStyle}>{plant.name}</h3>
                      <p style={plantSubtextStyle}>{plant.wateringFrequency} water · {plant.feedingFrequency} feed</p>
                    </div>
                    <div style={statusBadgeStyle(status)}>{status}</div>
                  </div>

                  <div style={plantInfoRowStyle}>
                    <div style={plantInfoItemStyle}>
                      <span style={detailLabelStyle}>Water</span>
                      <span style={detailValueStyle}>{getDueText(waterDays)}</span>
                      <span style={{ color: "#4b5563", fontSize: 12 }}>{plant.lastWatered ? `Last ${plant.lastWatered}` : "No record"}</span>
                    </div>
                    <div style={plantInfoItemStyle}>
                      <span style={detailLabelStyle}>Feed</span>
                      <span style={detailValueStyle}>{getDueText(feedDays)}</span>
                      <span style={{ color: "#4b5563", fontSize: 12 }}>{plant.lastFed ? `Last ${plant.lastFed}` : "No record"}</span>
                    </div>
                  </div>

                  {plant.notes && (
                    <div style={{ marginTop: 10, padding: 14, borderRadius: 20, background: "rgba(255,255,255,0.92)", border: "1px solid rgba(216,207,184,0.7)" }}>
                      <p style={{ margin: 0, color: "#1a261d", fontSize: 13, fontWeight: 700 }}>Notes</p>
                      <p style={{ margin: "8px 0 0", color: "#4a5648", fontSize: 13, lineHeight: 1.6 }}>{plant.notes}</p>
                    </div>
                  )}

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10, marginTop: 20 }}>
                    <button onClick={() => markWatered(plant.id)} style={{ ...actionButtonStyle, minWidth: 0, width: "100%", padding: "10px 12px", fontSize: 14 }}>💧 Water</button>
                    <button onClick={() => markFed(plant.id)} style={{ ...actionButtonStyle, minWidth: 0, width: "100%", padding: "10px 12px", fontSize: 14 }}>🌿 Feed</button>
                    <button onClick={() => setEditingPlant(plant)} style={{ ...actionButtonStyle, minWidth: 0, width: "100%", padding: "10px 12px", fontSize: 14 }}>✏️ Edit</button>
                    <button onClick={() => setDeletingPlant(plant.id)} style={{ ...actionButtonStyle, minWidth: 0, width: "100%", padding: "10px 12px", fontSize: 14, background: "rgba(254,226,226,0.95)", border: "1px solid rgba(239,68,68,0.2)", color: "#b91c1c" }}>
                      🗑️ Delete
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {editingPlant && (
        <div style={{ ...modalBackdropStyle, backdropFilter: "blur(8px)" }} onClick={(e) => e.target === e.currentTarget && setEditingPlant(null)}>
          <div style={modalBoxStyle}>
            <h2 style={{ margin: "0 0 20px", fontSize: 24, fontWeight: 900, color: "#0f766e" }}>
              {editingPlant.id ? "Edit Plant" : "Add Plant"}
            </h2>
            <div style={{ display: "grid", gap: 18 }}>
              <div>
                <label style={labelStyle}>Plant image</label>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))", gap: 12 }}>
                  {PRESET_IMAGES.map(img => (
                    <button
                      key={img.id}
                      onClick={() => setEditingPlant(prev => ({ ...prev, imageId: img.id }))}
                      style={{
                        ...inputStyle,
                        background: editingPlant.imageId === img.id ? "rgba(22,163,74,0.15)" : "rgba(255,255,255,0.95)",
                        border: editingPlant.imageId === img.id ? "2px solid #16a34a" : "1px solid rgba(34,197,94,0.2)",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: 6,
                        paddingTop: 12,
                        paddingBottom: 12,
                        cursor: "pointer",
                        transition: "all 0.2s",
                      }}
                    >
                      <div style={{ fontSize: 28 }}>{img.emoji}</div>
                      <span style={{ fontSize: 12, color: "#4b5563", fontWeight: 600 }}>{img.label}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label style={labelStyle}>Plant name</label>
                <input
                  value={editingPlant.name}
                  onChange={(e) => setEditingPlant(prev => ({ ...prev, name: e.target.value }))}
                  style={inputStyle}
                  placeholder="e.g. Basil"
                />
              </div>
              <div>
                <label style={labelStyle}>Watering frequency</label>
                <select
                  value={editingPlant.wateringFrequency}
                  onChange={(e) => setEditingPlant(prev => ({ ...prev, wateringFrequency: e.target.value }))}
                  style={inputStyle}
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="biweekly">Bi-weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>Feeding frequency</label>
                <select
                  value={editingPlant.feedingFrequency}
                  onChange={(e) => setEditingPlant(prev => ({ ...prev, feedingFrequency: e.target.value }))}
                  style={inputStyle}
                >
                  <option value="weekly">Weekly</option>
                  <option value="biweekly">Bi-weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>Notes</label>
                <textarea
                  value={editingPlant.notes}
                  onChange={(e) => setEditingPlant(prev => ({ ...prev, notes: e.target.value }))}
                  rows={4}
                  style={{ ...inputStyle, resize: "vertical", minHeight: 120 }}
                  placeholder="Any special care instructions..."
                />
              </div>
            </div>
            <div style={{ display: "flex", gap: 12, marginTop: 28, flexWrap: "wrap" }}>
              <button onClick={() => setEditingPlant(null)} style={cancelButtonStyle}>Cancel</button>
              <button onClick={handleSavePlant} style={{ ...buttonStyle, flex: 2, minWidth: 160 }}>Save Plant</button>
            </div>
          </div>
        </div>
      )}

      {deletingPlant && (
        <div style={{ ...modalBackdropStyle, backdropFilter: "blur(8px)" }} onClick={(e) => e.target === e.currentTarget && setDeletingPlant(null)}>
          <div style={{ ...modalBoxStyle, maxWidth: 420, textAlign: "center" }}>
            <p style={{ fontSize: 18, marginBottom: 24, color: "#0f766e" }}>Delete this plant? This cannot be undone.</p>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
              <button onClick={() => setDeletingPlant(null)} style={cancelButtonStyle}>Cancel</button>
              <button onClick={handleDeletePlant} style={{ ...cancelButtonStyle, background: "rgba(254,226,226,0.95)", border: "1px solid rgba(239,68,68,0.2)", color: "#b91c1c" }}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
