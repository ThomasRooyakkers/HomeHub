import { useState, useRef } from "react";
import { apiFetch } from "../lib/api";

const labelStyle = { fontSize: 14, color: "#4b5563", display: "block", marginBottom: 6, fontWeight: 600 };
const inputStyle = {
  width: "100%", background: "rgba(255,255,255,0.95)", border: "1px solid rgba(0,0,0,0.12)",
  borderRadius: 12, padding: "11px 14px", fontSize: 15, fontFamily: "inherit", color: "#111827",
};
const btnPrimary = {
  padding: "10px 20px", background: "linear-gradient(135deg, var(--accent, #16a34a), #22c55e)",
  color: "#fff", border: "none", borderRadius: 12, fontWeight: 700, fontSize: 14,
  cursor: "pointer", fontFamily: "inherit",
};
const btnSecondary = {
  padding: "10px 20px", background: "#f1f5f9", color: "#374151",
  border: "1px solid #e5e7eb", borderRadius: 12, fontWeight: 600, fontSize: 14,
  cursor: "pointer", fontFamily: "inherit",
};

const getDaysUntil = (dateStr) => {
  if (!dateStr) return null;
  return Math.ceil((new Date(dateStr) - new Date()) / (1000 * 60 * 60 * 24));
};

const warrantyBadge = (dateStr) => {
  const days = getDaysUntil(dateStr);
  if (days === null) return null;
  if (days < 0) return { label: "Expired", bg: "#fef2f2", color: "#dc2626", ring: "#fca5a5" };
  if (days <= 30) return { label: `${days}d left`, bg: "#fef2f2", color: "#dc2626", ring: "#fca5a5" };
  if (days <= 90) return { label: `${days}d left`, bg: "#fffbeb", color: "#d97706", ring: "#fcd34d" };
  return { label: `${Math.round(days / 30)}mo left`, bg: "#f0fdf4", color: "#16a34a", ring: "#86efac" };
};

const EMPTY_FORM = { name: "", brand: "", model: "", serialNo: "", purchaseDate: "", warrantyExpiry: "", value: "", location: "", notes: "" };

export default function HomeInventory({ inventory, setInventory, apiEnabled, showToast }) {
  const [locationFilter, setLocationFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [form, setForm] = useState(null);
  const [photo, setPhoto] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const fileRef = useRef();

  const locations = ["All", ...new Set(inventory.map(i => i.location).filter(Boolean))].sort();

  const visible = inventory
    .filter(i => locationFilter === "All" || i.location === locationFilter)
    .filter(i => !search || i.name.toLowerCase().includes(search.toLowerCase()) || (i.brand || "").toLowerCase().includes(search.toLowerCase()));

  const sorted = [...visible].sort((a, b) => {
    const da = getDaysUntil(a.warrantyExpiry);
    const db = getDaysUntil(b.warrantyExpiry);
    if (da !== null && db !== null) return da - db;
    if (da !== null) return -1;
    if (db !== null) return 1;
    return a.name.localeCompare(b.name);
  });

  const openNew = () => { setForm({ ...EMPTY_FORM }); setPhoto(null); };
  const openEdit = (item) => { setForm({ ...item }); setPhoto(null); };
  const closeModal = () => { setForm(null); setPhoto(null); };

  const handlePhoto = (e) => {
    const f = e.target.files?.[0];
    if (f) setPhoto(f);
  };

  const saveForm = async () => {
    if (!form.name?.trim()) return showToast("Name required", "danger");
    const payload = {
      name: form.name.trim(),
      brand: form.brand || "",
      model: form.model || "",
      serialNo: form.serialNo || "",
      purchaseDate: form.purchaseDate || "",
      warrantyExpiry: form.warrantyExpiry || "",
      value: form.value ? parseFloat(form.value) : null,
      location: form.location || "",
      notes: form.notes || "",
    };
    try {
      const fd = new FormData();
      fd.append("data", JSON.stringify(payload));
      if (photo) fd.append("photo", photo);

      if (form.id) {
        const updated = apiEnabled
          ? await apiFetch(`/api/inventory/${form.id}`, { method: "PUT", body: fd })
          : { ...form, ...payload };
        if (updated) {
          setInventory(inv => inv.map(i => i.id === form.id ? updated : i));
          showToast("Item updated");
        }
      } else {
        const created = apiEnabled
          ? await apiFetch("/api/inventory", { method: "POST", body: fd })
          : { ...payload, id: Date.now(), photo: null };
        if (created) {
          setInventory(inv => [...inv, created]);
          showToast("Item added");
        }
      }
      closeModal();
    } catch { showToast("Failed to save item", "danger"); }
  };

  const confirmDelete = async (id) => {
    try {
      if (apiEnabled) await apiFetch(`/api/inventory/${id}`, { method: "DELETE" });
      setInventory(inv => inv.filter(i => i.id !== id));
      setDeleteId(null);
      showToast("Item deleted");
    } catch { showToast("Failed to delete", "danger"); }
  };

  const expiringCount = inventory.filter(i => {
    const d = getDaysUntil(i.warrantyExpiry);
    return d !== null && d <= 90;
  }).length;

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", padding: "28px 20px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <h2 style={{ margin: 0, fontSize: 26, fontWeight: 800, color: "#111827" }}>🏷️ Home Inventory</h2>
        <button style={btnPrimary} onClick={openNew}>+ Add Item</button>
      </div>

      {expiringCount > 0 && (
        <div style={{ marginBottom: 20, padding: "12px 18px", background: "#fffbeb", border: "1px solid #fcd34d", borderRadius: 14, color: "#92400e", fontSize: 14, fontWeight: 600 }}>
          ⚠️ {expiringCount} item{expiringCount > 1 ? "s" : ""} with warranty expiring within 90 days
        </div>
      )}

      {/* Filters */}
      <div style={{ display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
        <input
          style={{ ...inputStyle, flex: "1 1 200px", maxWidth: 280 }}
          placeholder="Search items…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {locations.map(loc => (
            <button
              key={loc}
              onClick={() => setLocationFilter(loc)}
              style={{
                padding: "8px 16px", borderRadius: 20, border: "none", cursor: "pointer",
                fontFamily: "inherit", fontWeight: 600, fontSize: 13,
                background: locationFilter === loc ? "var(--accent, #16a34a)" : "#f1f5f9",
                color: locationFilter === loc ? "#fff" : "#374151",
              }}
            >{loc}</button>
          ))}
        </div>
      </div>

      {/* Table */}
      {sorted.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 20px", color: "#9ca3af" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🏷️</div>
          <p style={{ margin: 0 }}>No items yet. Start tracking your appliances and valuables.</p>
        </div>
      ) : (
        <div style={{ background: "rgba(255,255,255,0.85)", borderRadius: 20, border: "1px solid rgba(0,0,0,0.06)", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #f3f4f6" }}>
                {["Item", "Brand / Model", "Location", "Value", "Warranty", ""].map(h => (
                  <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontSize: 12, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: 0.5 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((item, idx) => {
                const badge = warrantyBadge(item.warrantyExpiry);
                return (
                  <tr key={item.id} style={{ borderBottom: idx < sorted.length - 1 ? "1px solid #f9fafb" : "none", background: idx % 2 === 0 ? "transparent" : "rgba(248,250,252,0.5)" }}>
                    <td style={{ padding: "14px 16px" }}>
                      <div style={{ fontWeight: 700, color: "#111827" }}>{item.name}</div>
                      {item.serialNo && <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 2 }}>S/N: {item.serialNo}</div>}
                    </td>
                    <td style={{ padding: "14px 16px", color: "#6b7280" }}>
                      {[item.brand, item.model].filter(Boolean).join(" · ") || "—"}
                    </td>
                    <td style={{ padding: "14px 16px", color: "#6b7280" }}>{item.location || "—"}</td>
                    <td style={{ padding: "14px 16px", color: "#374151", fontWeight: 600 }}>
                      {item.value ? `€${Number(item.value).toLocaleString()}` : "—"}
                    </td>
                    <td style={{ padding: "14px 16px" }}>
                      {badge ? (
                        <span style={{ padding: "4px 10px", borderRadius: 8, background: badge.bg, color: badge.color, fontSize: 12, fontWeight: 700, border: `1px solid ${badge.ring}` }}>{badge.label}</span>
                      ) : "—"}
                    </td>
                    <td style={{ padding: "14px 16px" }}>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button onClick={() => openEdit(item)} style={{ padding: "5px 12px", background: "#f1f5f9", borderRadius: 8, border: "none", fontSize: 12, fontWeight: 600, color: "#374151", cursor: "pointer", fontFamily: "inherit" }}>Edit</button>
                        <button onClick={() => setDeleteId(item.id)} style={{ padding: "5px 12px", background: "rgba(252,165,165,0.1)", borderRadius: 8, border: "1px solid rgba(220,38,38,0.2)", fontSize: 12, fontWeight: 600, color: "#dc2626", cursor: "pointer", fontFamily: "inherit" }}>Del</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Add/Edit modal */}
      {form && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && closeModal()}>
          <div className="modal-box" style={{ maxWidth: 520 }}>
            <h3 style={{ margin: "0 0 20px", fontSize: 20, fontWeight: 700 }}>{form.id ? "Edit Item" : "Add Item"}</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={labelStyle}>Name *</label>
                <input style={inputStyle} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Washing Machine" />
              </div>
              <div>
                <label style={labelStyle}>Brand</label>
                <input style={inputStyle} value={form.brand || ""} onChange={e => setForm(f => ({ ...f, brand: e.target.value }))} placeholder="e.g. Miele" />
              </div>
              <div>
                <label style={labelStyle}>Model</label>
                <input style={inputStyle} value={form.model || ""} onChange={e => setForm(f => ({ ...f, model: e.target.value }))} placeholder="e.g. W1" />
              </div>
              <div>
                <label style={labelStyle}>Serial Number</label>
                <input style={inputStyle} value={form.serialNo || ""} onChange={e => setForm(f => ({ ...f, serialNo: e.target.value }))} />
              </div>
              <div>
                <label style={labelStyle}>Location</label>
                <input style={inputStyle} value={form.location || ""} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} placeholder="e.g. Kitchen" />
              </div>
              <div>
                <label style={labelStyle}>Purchase Date</label>
                <input type="date" style={inputStyle} value={form.purchaseDate || ""} onChange={e => setForm(f => ({ ...f, purchaseDate: e.target.value }))} />
              </div>
              <div>
                <label style={labelStyle}>Warranty Expires</label>
                <input type="date" style={inputStyle} value={form.warrantyExpiry || ""} onChange={e => setForm(f => ({ ...f, warrantyExpiry: e.target.value }))} />
              </div>
              <div>
                <label style={labelStyle}>Value (€)</label>
                <input type="number" style={inputStyle} value={form.value || ""} onChange={e => setForm(f => ({ ...f, value: e.target.value }))} placeholder="0" />
              </div>
              <div>
                <label style={labelStyle}>Photo</label>
                <input ref={fileRef} type="file" accept=".jpg,.jpeg,.png,.webp" style={{ display: "none" }} onChange={handlePhoto} />
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <button type="button" style={{ ...btnSecondary, padding: "8px 14px", fontSize: 13 }} onClick={() => fileRef.current.click()}>Choose</button>
                  <span style={{ fontSize: 12, color: "#9ca3af" }}>{photo ? photo.name : (form.photo ? "existing photo" : "none")}</span>
                </div>
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={labelStyle}>Notes</label>
                <textarea style={{ ...inputStyle, resize: "vertical", minHeight: 60 }} value={form.notes || ""} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <button style={btnPrimary} onClick={saveForm}>Save</button>
              <button style={btnSecondary} onClick={closeModal}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteId && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setDeleteId(null)}>
          <div className="modal-box" style={{ maxWidth: 360, textAlign: "center" }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>🗑️</div>
            <h3 style={{ margin: "0 0 10px", fontSize: 20, fontWeight: 700 }}>Delete Item?</h3>
            <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 24 }}>
              <button onClick={() => confirmDelete(deleteId)} style={{ padding: "10px 20px", background: "rgba(252,165,165,0.12)", color: "#dc2626", border: "1px solid rgba(220,38,38,0.2)", borderRadius: 12, fontWeight: 600, fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>Delete</button>
              <button style={btnSecondary} onClick={() => setDeleteId(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
