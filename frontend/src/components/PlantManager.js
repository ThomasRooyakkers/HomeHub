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

const labelStyle = { fontSize: 12, color: "var(--g-muted)", display: "block", marginBottom: 6, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" };
const inputStyle = { width: "100%", background: "#fff", border: "1px solid var(--g-hair)", borderRadius: 12, padding: "11px 14px", color: "var(--g-ink)", fontSize: 14, fontFamily: "inherit", boxSizing: "border-box" };
const btnPrimary = { padding: "10px 20px", background: "var(--g-sage)", color: "#fff", border: "none", borderRadius: 12, fontWeight: 600, fontSize: 14, cursor: "pointer", fontFamily: "inherit" };
const btnSecondary = { padding: "10px 20px", background: "var(--g-bg)", color: "var(--g-ink2)", border: "1px solid var(--g-hair)", borderRadius: 12, fontWeight: 600, fontSize: 14, cursor: "pointer", fontFamily: "inherit" };

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
      try {
        const result = await apiFetch(isNew ? "/api/plants" : `/api/plants/${plantData.id}`, {
          method: isNew ? "POST" : "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(plantData),
        });
        setPlants(prev => isNew ? [...prev, result] : prev.map(p => p.id === plantData.id ? result : p));
        showToast(isNew ? "Plant added" : "Plant updated");
        setEditingPlant(null);
        return;
      } catch (err) {
        showToast(err.message || "Request failed", "danger");
        return;
      }
    }
    setPlants(prev => isNew ? [...prev, plantData] : prev.map(p => p.id === plantData.id ? plantData : p));
    showToast(isNew ? "Plant added" : "Plant updated");
    setEditingPlant(null);
  };

  const handleDeletePlant = async () => {
    if (apiEnabled) {
      try {
        await apiFetch(`/api/plants/${deletingPlant}`, { method: "DELETE" });
        setPlants(prev => prev.filter(p => p.id !== deletingPlant));
        showToast("Plant deleted", "danger");
        setDeletingPlant(null);
        return;
      } catch (err) {
        showToast(err.message || "Delete failed", "danger");
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
      try {
        const result = await apiFetch(`/api/plants/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updated),
        });
        setPlants(prev => prev.map(p => p.id === id ? result : p));
        showToast("Marked as watered");
        return;
      } catch (err) {
        showToast(err.message || "Update failed", "danger");
        return;
      }
    }
    setPlants(prev => prev.map(p => p.id === id ? updated : p));
    showToast("Marked as watered");
  };

  const markFed = async (id) => {
    const updated = { ...plants.find(p => p.id === id), lastFed: new Date().toISOString().slice(0, 10) };
    if (apiEnabled) {
      try {
        const result = await apiFetch(`/api/plants/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updated),
        });
        setPlants(prev => prev.map(p => p.id === id ? result : p));
        showToast("Marked as fed");
        return;
      } catch (err) {
        showToast(err.message || "Update failed", "danger");
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

  const needsWaterCount = plants.filter(p => getDaysUntil(getNextDueDate(p.lastWatered, p.wateringFrequency)) <= 0).length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24, padding: "32px 40px 60px" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
        <div>
          <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: "var(--g-sage)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>Indoor Garden</p>
          <h1 style={{ margin: 0, fontSize: 44, fontWeight: 400, color: "var(--g-ink)", fontFamily: "var(--g-serif)", lineHeight: 1.1 }}>My Plants</h1>
        </div>
        <button onClick={() => setEditingPlant({ ...PLANT_FORM_DEFAULT })} style={btnPrimary}>
          + Add Plant
        </button>
      </div>

      {/* Stats strip */}
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        <div style={{ background: "var(--g-card)", borderRadius: 20, padding: "20px 28px", boxShadow: "var(--g-shadow)", minWidth: 140 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--g-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Total Plants</div>
          <div style={{ fontSize: 32, fontWeight: 400, fontFamily: "var(--g-serif)", color: "var(--g-ink)", lineHeight: 1 }}>{plants.length}</div>
          <div style={{ height: 3, width: 40, background: "var(--g-sage)", borderRadius: 2, marginTop: 10 }} />
        </div>
        <div style={{ background: "var(--g-card)", borderRadius: 20, padding: "20px 28px", boxShadow: "var(--g-shadow)", minWidth: 140 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--g-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Needs Water</div>
          <div style={{ fontSize: 32, fontWeight: 400, fontFamily: "var(--g-serif)", color: "var(--g-ink)", lineHeight: 1 }}>{needsWaterCount}</div>
          <div style={{ height: 3, width: 40, background: "var(--g-sky)", borderRadius: 2, marginTop: 10 }} />
        </div>
        <div style={{ background: "var(--g-card)", borderRadius: 20, padding: "20px 28px", boxShadow: "var(--g-shadow)", minWidth: 140 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--g-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Healthy</div>
          <div style={{ fontSize: 32, fontWeight: 400, fontFamily: "var(--g-serif)", color: "var(--g-ink)", lineHeight: 1 }}>{plants.filter(p => plantStatus(p) === "Healthy").length}</div>
          <div style={{ height: 3, width: 40, background: "var(--g-honey)", borderRadius: 2, marginTop: 10 }} />
        </div>
      </div>

      {plants.length === 0 ? (
        <div style={{ background: "var(--g-card)", borderRadius: 20, padding: "60px 40px", boxShadow: "var(--g-shadow)", textAlign: "center", color: "var(--g-muted)", fontSize: 15 }}>
          No plants yet. Add one to start tracking your watering and feeding routine.
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 20 }}>
          {plants.map((plant, index) => {
            const waterDue = getNextDueDate(plant.lastWatered, plant.wateringFrequency);
            const feedDue = getNextDueDate(plant.lastFed, plant.feedingFrequency);
            const waterDays = getDaysUntil(waterDue);
            const feedDays = getDaysUntil(feedDue);
            const status = plantStatus(plant);
            const needsWater = waterDays <= 0;

            return (
              <div key={plant.id} style={{ background: "var(--g-card)", borderRadius: 20, overflow: "hidden", boxShadow: "var(--g-shadow)", display: "flex", flexDirection: "column" }}>
                {/* Plant image area — striped bg */}
                <div style={{
                  background: "repeating-linear-gradient(135deg, var(--g-sage-bg) 0px, var(--g-sage-bg) 10px, var(--g-bg) 10px, var(--g-bg) 20px)",
                  padding: "32px 20px 24px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  position: "relative",
                  minHeight: 160,
                }}>
                  <div style={{ fontSize: 72, lineHeight: 1 }}>{PRESET_IMAGES.find(img => img.id === plant.imageId)?.emoji || "🪴"}</div>
                  <div style={{ position: "absolute", top: 12, right: 12, fontSize: 11, color: "var(--g-mute2)", fontWeight: 600, letterSpacing: "0.1em" }}>#{index + 1}</div>
                  {needsWater && (
                    <div style={{ position: "absolute", top: 12, left: 12, background: "var(--g-sky-bg)", color: "var(--g-sky)", borderRadius: 999, padding: "3px 9px", fontSize: 11, fontWeight: 600 }}>
                      Needs water
                    </div>
                  )}
                </div>

                {/* Body */}
                <div style={{ padding: "16px 20px 20px", display: "flex", flexDirection: "column", gap: 12, flex: 1 }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: 18, fontWeight: 400, fontFamily: "var(--g-serif)", color: "var(--g-ink)", lineHeight: 1.2 }}>{plant.name}</h3>
                    <p style={{ margin: "4px 0 0", color: "var(--g-muted)", fontSize: 13 }}>{plant.wateringFrequency} water · {plant.feedingFrequency} feed</p>
                  </div>

                  <div style={{
                    display: "inline-flex", alignItems: "center", gap: 6,
                    padding: "4px 9px", borderRadius: 999, fontSize: 11.5, fontWeight: 600,
                    background: status === "Healthy" ? "var(--g-sage-bg)" : "var(--g-brick-bg)",
                    color: status === "Healthy" ? "var(--g-sage-dark)" : "var(--g-brick)",
                    alignSelf: "flex-start",
                  }}>{status}</div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    <div style={{ background: "var(--g-bg)", borderRadius: 12, padding: "10px 12px", border: "1px solid var(--g-hair)" }}>
                      <div style={{ fontSize: 11, color: "var(--g-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Water</div>
                      <div style={{ fontSize: 15, fontWeight: 600, color: "var(--g-ink)" }}>{getDueText(waterDays)}</div>
                      <div style={{ fontSize: 12, color: "var(--g-mute2)", marginTop: 2 }}>{plant.lastWatered ? `Last ${plant.lastWatered}` : "No record"}</div>
                    </div>
                    <div style={{ background: "var(--g-bg)", borderRadius: 12, padding: "10px 12px", border: "1px solid var(--g-hair)" }}>
                      <div style={{ fontSize: 11, color: "var(--g-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Feed</div>
                      <div style={{ fontSize: 15, fontWeight: 600, color: "var(--g-ink)" }}>{getDueText(feedDays)}</div>
                      <div style={{ fontSize: 12, color: "var(--g-mute2)", marginTop: 2 }}>{plant.lastFed ? `Last ${plant.lastFed}` : "No record"}</div>
                    </div>
                  </div>

                  {plant.notes && (
                    <div style={{ padding: "10px 12px", borderRadius: 12, background: "var(--g-hair2)", border: "1px solid var(--g-hair)" }}>
                      <p style={{ margin: 0, color: "var(--g-ink2)", fontSize: 13, lineHeight: 1.5 }}>{plant.notes}</p>
                    </div>
                  )}

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: "auto" }}>
                    <button onClick={() => markWatered(plant.id)} style={{ ...btnSecondary, padding: "9px 12px", fontSize: 13 }}>💧 Water</button>
                    <button onClick={() => markFed(plant.id)} style={{ ...btnSecondary, padding: "9px 12px", fontSize: 13 }}>🌿 Feed</button>
                    <button onClick={() => setEditingPlant(plant)} style={{ ...btnSecondary, padding: "9px 12px", fontSize: 13 }}>Edit</button>
                    <button onClick={() => setDeletingPlant(plant.id)} style={{ padding: "9px 12px", background: "var(--g-brick-bg)", border: "1px solid var(--g-hair)", color: "var(--g-brick)", borderRadius: 12, fontWeight: 600, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add/Edit Modal */}
      {editingPlant && (
        <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && setEditingPlant(null)}>
          <div className="modal-box" style={{ maxWidth: 540 }}>
            <h2 style={{ margin: "0 0 24px", fontSize: 26, fontWeight: 400, fontFamily: "var(--g-serif)", color: "var(--g-ink)" }}>
              {editingPlant.id ? "Edit Plant" : "Add Plant"}
            </h2>
            <div style={{ display: "grid", gap: 16 }}>
              <div>
                <label style={labelStyle}>Plant image</label>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(90px, 1fr))", gap: 10 }}>
                  {PRESET_IMAGES.map(img => (
                    <button
                      key={img.id}
                      onClick={() => setEditingPlant(prev => ({ ...prev, imageId: img.id }))}
                      style={{
                        background: editingPlant.imageId === img.id ? "var(--g-sage-bg)" : "#fff",
                        border: editingPlant.imageId === img.id ? "2px solid var(--g-sage)" : "1px solid var(--g-hair)",
                        borderRadius: 12,
                        padding: "10px 8px",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: 6,
                        cursor: "pointer",
                        fontFamily: "inherit",
                      }}
                    >
                      <div style={{ fontSize: 26 }}>{img.emoji}</div>
                      <span style={{ fontSize: 11, color: "var(--g-muted)", fontWeight: 600 }}>{img.label}</span>
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
                  style={{ ...inputStyle, resize: "vertical", minHeight: 100 }}
                  placeholder="Any special care instructions..."
                />
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
              <button onClick={() => setEditingPlant(null)} style={btnSecondary}>Cancel</button>
              <button onClick={handleSavePlant} style={{ ...btnPrimary, flex: 1 }}>Save Plant</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deletingPlant && (
        <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && setDeletingPlant(null)}>
          <div className="modal-box" style={{ maxWidth: 380, textAlign: "center" }}>
            <h3 style={{ margin: "0 0 10px", fontSize: 22, fontWeight: 400, fontFamily: "var(--g-serif)", color: "var(--g-ink)" }}>Delete this plant?</h3>
            <p style={{ margin: "0 0 24px", color: "var(--g-muted)", fontSize: 14 }}>This cannot be undone.</p>
            <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
              <button onClick={() => setDeletingPlant(null)} style={btnSecondary}>Cancel</button>
              <button onClick={handleDeletePlant} style={{ padding: "10px 20px", background: "var(--g-brick-bg)", color: "var(--g-brick)", border: "1px solid var(--g-hair)", borderRadius: 12, fontWeight: 600, fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
