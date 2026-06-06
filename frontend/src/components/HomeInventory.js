import { useState, useRef } from "react";
import { apiFetch } from "../lib/api";

const labelStyle = { fontSize: 12, color: "var(--g-muted)", display: "block", marginBottom: 6, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" };
const inputStyle = { width: "100%", background: "#fff", border: "1px solid var(--g-hair)", borderRadius: 12, padding: "11px 14px", fontSize: 14, fontFamily: "inherit", color: "var(--g-ink)", boxSizing: "border-box" };
const btnPrimary = { padding: "10px 20px", background: "var(--g-sage)", color: "#fff", border: "none", borderRadius: 12, fontWeight: 600, fontSize: 14, cursor: "pointer", fontFamily: "inherit" };
const btnSecondary = { padding: "10px 20px", background: "var(--g-bg)", color: "var(--g-ink2)", border: "1px solid var(--g-hair)", borderRadius: 12, fontWeight: 600, fontSize: 14, cursor: "pointer", fontFamily: "inherit" };

const getDaysUntil = (dateStr) => {
  if (!dateStr) return null;
  return Math.ceil((new Date(dateStr) - new Date()) / (1000 * 60 * 60 * 24));
};

const warrantyBadge = (dateStr) => {
  const days = getDaysUntil(dateStr);
  if (days === null) return null;
  if (days < 0) return { label: "Expired", bg: "var(--g-brick-bg)", color: "var(--g-brick)" };
  if (days <= 30) return { label: `${days}d left`, bg: "var(--g-brick-bg)", color: "var(--g-brick)" };
  if (days <= 90) return { label: `${days}d left`, bg: "var(--g-honey-bg)", color: "var(--g-honey)" };
  return { label: `${Math.round(days / 30)}mo left`, bg: "var(--g-sage-bg)", color: "var(--g-sage-dark)" };
};

const EMPTY_FORM = { name: "", brand: "", model: "", serialNo: "", purchaseDate: "", warrantyExpiry: "", value: "", location: "", documentId: "", notes: "" };

export default function HomeInventory({ inventory, setInventory, documents = [], apiEnabled, showToast }) {
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
      documentId: form.documentId || "",
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

  const totalValue = inventory.reduce((s, i) => s + (parseFloat(i.value) || 0), 0);

  return (
    <div className="page" style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 16 }}>
        <div>
          <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: "var(--g-sage)", textTransform: "uppercase", letterSpacing: "0.1em" }}>What we own</p>
          <h1 style={{ margin: "4px 0 0", fontSize: 44, fontWeight: 400, color: "var(--g-ink)", fontFamily: "var(--g-serif)", lineHeight: 1 }}>Inventory</h1>
        </div>
        <button style={btnPrimary} onClick={openNew}>+ Add item</button>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 16 }}>
        {[
          { label: "Items tracked", value: inventory.length, accent: "var(--g-sage)" },
          { label: "Estimated value", value: `€${totalValue.toLocaleString("en-US", { minimumFractionDigits: 0 })}`, accent: "var(--g-honey)" },
          { label: "Warranty alerts", value: expiringCount, accent: expiringCount > 0 ? "var(--g-brick)" : "var(--g-sage)" },
        ].map(s => (
          <div key={s.label} style={{ background: "var(--g-card)", borderRadius: 20, padding: "20px 22px", boxShadow: "var(--g-shadow)" }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--g-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>{s.label}</div>
            <div style={{ fontSize: 28, fontWeight: 400, fontFamily: "var(--g-serif)", color: "var(--g-ink)", lineHeight: 1 }}>{s.value}</div>
            <div style={{ height: 3, width: 28, background: s.accent, borderRadius: 2, marginTop: 10 }} />
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
          <svg style={{ position: "absolute", left: 12, color: "var(--g-mute2)", pointerEvents: "none" }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input
            style={{ ...inputStyle, paddingLeft: 32, maxWidth: 240 }}
            placeholder="Search items…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {locations.map(loc => (
            <button key={loc} onClick={() => setLocationFilter(loc)} style={{
              all: "unset", cursor: "pointer",
              padding: "7px 14px", borderRadius: 999,
              fontFamily: "var(--g-sans)", fontWeight: 600, fontSize: 13,
              background: locationFilter === loc ? "var(--g-sage-bg)" : "var(--g-card)",
              color: locationFilter === loc ? "var(--g-sage-dark)" : "var(--g-ink2)",
              border: `1px solid ${locationFilter === loc ? "transparent" : "var(--g-hair)"}`,
              boxShadow: "var(--g-shadow-sm)",
            }}>{loc}</button>
          ))}
        </div>
      </div>

      {/* Table */}
      {sorted.length === 0 ? (
        <div style={{ background: "var(--g-card)", borderRadius: 20, padding: "60px 40px", boxShadow: "var(--g-shadow)", textAlign: "center", color: "var(--g-muted)" }}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--g-mute2)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 16 }}><path d="M3 12V4h8l10 10-8 8z"/><circle cx="8" cy="8" r="1.5"/></svg>
          <p style={{ margin: 0, fontSize: 15 }}>No items yet. Start tracking your appliances and valuables.</p>
        </div>
      ) : (
        <div style={{ background: "var(--g-card)", borderRadius: 20, boxShadow: "var(--g-shadow)", overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr 1fr 120px 100px", gap: 0, padding: "10px 24px", borderBottom: "1px solid var(--g-hair)" }}>
            {["Item", "Brand · Model", "Location", "Value", "Warranty", ""].map(h => (
              <div key={h} style={{ fontSize: 11, fontWeight: 600, color: "var(--g-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</div>
            ))}
          </div>
          {sorted.map((item, idx) => {
            const badge = warrantyBadge(item.warrantyExpiry);
            return (
              <div key={item.id} style={{
                display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr 1fr 120px 100px",
                gap: 0, padding: "14px 24px",
                borderTop: idx > 0 ? "1px solid var(--g-hair2)" : "none",
                alignItems: "center",
              }}>
                <div>
                  <div style={{ fontWeight: 600, color: "var(--g-ink)", fontSize: 14, fontFamily: "var(--g-sans)" }}>{item.name}</div>
                  {item.serialNo && <div style={{ fontSize: 11, color: "var(--g-mute2)", marginTop: 2 }}>S/N {item.serialNo}</div>}
                  {item.documentId && (
                    <div style={{ fontSize: 11, color: "var(--g-muted)", marginTop: 4 }}>
                      Linked doc: {documents.find(doc => String(doc.id) === String(item.documentId))?.title || "Missing document"}
                    </div>
                  )}
                </div>
                <div style={{ fontSize: 13, color: "var(--g-ink2)" }}>{[item.brand, item.model].filter(Boolean).join(" · ") || "—"}</div>
                <div style={{ fontSize: 13, color: "var(--g-ink2)" }}>{item.location || "—"}</div>
                <div style={{ fontSize: 14, fontFamily: "var(--g-serif)", color: "var(--g-ink)" }}>
                  {item.value ? `€${Number(item.value).toLocaleString()}` : "—"}
                </div>
                <div>
                  {badge ? (
                    <span style={{ display: "inline-block", padding: "4px 9px", borderRadius: 999, background: badge.bg, color: badge.color, fontSize: 11.5, fontWeight: 600 }}>{badge.label}</span>
                  ) : <span style={{ color: "var(--g-mute2)", fontSize: 13 }}>—</span>}
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={() => openEdit(item)} style={{ all: "unset", cursor: "pointer", padding: "5px 11px", background: "var(--g-bg)", borderRadius: 8, border: "1px solid var(--g-hair)", fontSize: 12, fontWeight: 600, color: "var(--g-ink2)" }}>Edit</button>
                  <button onClick={() => setDeleteId(item.id)} style={{ all: "unset", cursor: "pointer", padding: "5px 11px", background: "var(--g-brick-bg)", borderRadius: 8, border: "1px solid transparent", fontSize: 12, fontWeight: 600, color: "var(--g-brick)" }}>Del</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add/Edit modal */}
      {form && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && closeModal()}>
          <div className="modal-box" style={{ maxWidth: 520 }}>
            <h3 style={{ margin: "0 0 20px", fontSize: 24, fontWeight: 400, fontFamily: "var(--g-serif)", color: "var(--g-ink)" }}>{form.id ? "Edit item" : "Add item"}</h3>
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
                <label style={labelStyle}>Serial number</label>
                <input style={inputStyle} value={form.serialNo || ""} onChange={e => setForm(f => ({ ...f, serialNo: e.target.value }))} />
              </div>
              <div>
                <label style={labelStyle}>Location</label>
                <input style={inputStyle} value={form.location || ""} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} placeholder="e.g. Kitchen" />
              </div>
              <div>
                <label style={labelStyle}>Linked document</label>
                <select
                  style={inputStyle}
                  value={form.documentId || ""}
                  onChange={e => setForm(f => ({ ...f, documentId: e.target.value }))}
                >
                  <option value="">— None —</option>
                  {documents.map(doc => (
                    <option key={doc.id} value={doc.id}>{doc.title}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Purchase date</label>
                <input type="date" style={inputStyle} value={form.purchaseDate || ""} onChange={e => setForm(f => ({ ...f, purchaseDate: e.target.value }))} />
              </div>
              <div>
                <label style={labelStyle}>Warranty expires</label>
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
                  <span style={{ fontSize: 12, color: "var(--g-mute2)" }}>{photo ? photo.name : (form.photo ? "existing photo" : "none")}</span>
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
            <h3 style={{ margin: "0 0 8px", fontSize: 22, fontWeight: 400, fontFamily: "var(--g-serif)", color: "var(--g-ink)" }}>Delete item?</h3>
            <p style={{ margin: "0 0 24px", color: "var(--g-muted)", fontSize: 14 }}>This cannot be undone.</p>
            <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
              <button onClick={() => confirmDelete(deleteId)} style={{ ...btnSecondary, background: "var(--g-brick-bg)", color: "var(--g-brick)", borderColor: "transparent" }}>Delete</button>
              <button style={btnSecondary} onClick={() => setDeleteId(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
