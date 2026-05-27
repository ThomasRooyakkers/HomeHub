import { useState, useRef } from "react";
import { apiFetch } from "../lib/api";

const CATEGORIES = ["Insurance", "Warranty", "Legal", "Medical", "Financial", "Manuals", "Other"];

const CAT_COLORS = {
  Insurance: "#3b82f6", Warranty: "#f59e0b", Legal: "#8b5cf6",
  Medical: "#ec4899", Financial: "#10b981", Manuals: "#6b7280", Other: "#9ca3af",
};

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

const expiryBadge = (dateStr) => {
  const days = getDaysUntil(dateStr);
  if (days === null) return null;
  if (days < 0) return { label: "Expired", color: "#dc2626", bg: "rgba(220,38,38,0.08)" };
  if (days <= 30) return { label: `Expires in ${days}d`, color: "#dc2626", bg: "rgba(220,38,38,0.08)" };
  if (days <= 90) return { label: `Expires in ${days}d`, color: "#d97706", bg: "rgba(217,119,6,0.08)" };
  return { label: dateStr, color: "#6b7280", bg: "rgba(0,0,0,0.04)" };
};

const fileIcon = (name) => {
  if (!name) return "📄";
  const ext = name.split(".").pop().toLowerCase();
  if (ext === "pdf") return "📕";
  if (["jpg", "jpeg", "png", "webp"].includes(ext)) return "🖼️";
  return "📄";
};

const EMPTY_FORM = { title: "", category: "Insurance", expiryDate: "", notes: "" };

export default function DocumentVault({ documents, setDocuments, apiEnabled, showToast }) {
  const [catFilter, setCatFilter] = useState("All");
  const [form, setForm] = useState(null);
  const [file, setFile] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const fileRef = useRef();

  const visible = catFilter === "All" ? documents : documents.filter(d => d.category === catFilter);
  const sorted = [...visible].sort((a, b) => {
    const da = getDaysUntil(a.expiryDate);
    const db = getDaysUntil(b.expiryDate);
    if (da === null && db === null) return 0;
    if (da === null) return 1;
    if (db === null) return -1;
    return da - db;
  });

  const openNew = () => { setForm({ ...EMPTY_FORM }); setFile(null); };
  const openEdit = (doc) => { setForm({ ...doc }); setFile(null); };
  const closeModal = () => { setForm(null); setFile(null); };

  const handleFile = (e) => {
    const f = e.target.files?.[0];
    if (f) setFile(f);
  };

  const saveForm = async () => {
    if (!form.title?.trim()) return showToast("Title required", "danger");

    try {
      const fd = new FormData();
      const payload = { title: form.title, category: form.category, expiryDate: form.expiryDate || "", notes: form.notes || "" };
      fd.append("data", JSON.stringify(payload));
      if (file) fd.append("file", file);

      if (form.id) {
        const updated = apiEnabled
          ? await apiFetch(`/api/documents/${form.id}`, { method: "PUT", body: fd })
          : { ...form, ...payload };
        if (updated) {
          setDocuments(d => d.map(x => x.id === form.id ? updated : x));
          showToast("Document updated");
        }
      } else {
        const created = apiEnabled
          ? await apiFetch("/api/documents", { method: "POST", body: fd })
          : { ...payload, id: Date.now(), uploadedAt: new Date().toISOString().slice(0, 10), file: null, originalName: file?.name || null };
        if (created) {
          setDocuments(d => [...d, created]);
          showToast("Document saved");
        }
      }
      closeModal();
    } catch { showToast("Failed to save document", "danger"); }
  };

  const confirmDelete = async (id) => {
    try {
      if (apiEnabled) await apiFetch(`/api/documents/${id}`, { method: "DELETE" });
      setDocuments(d => d.filter(x => x.id !== id));
      setDeleteId(null);
      showToast("Document deleted");
    } catch { showToast("Failed to delete", "danger"); }
  };

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "28px 20px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <h2 style={{ margin: 0, fontSize: 26, fontWeight: 800, color: "#111827" }}>📁 Document Vault</h2>
        <button style={btnPrimary} onClick={openNew}>+ Add Document</button>
      </div>

      {/* Category filter */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 24 }}>
        {["All", ...CATEGORIES].map(c => (
          <button
            key={c}
            onClick={() => setCatFilter(c)}
            style={{
              padding: "7px 16px", borderRadius: 20, border: "none", cursor: "pointer",
              fontFamily: "inherit", fontWeight: 600, fontSize: 13,
              background: catFilter === c ? (CAT_COLORS[c] || "var(--accent, #16a34a)") : "#f1f5f9",
              color: catFilter === c ? "#fff" : "#374151",
            }}
          >{c}</button>
        ))}
      </div>

      {/* Cards grid */}
      {sorted.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 20px", color: "#9ca3af" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📁</div>
          <p style={{ margin: 0 }}>No documents yet. Click "+ Add Document" to store one.</p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 16 }}>
          {sorted.map(doc => {
            const badge = expiryBadge(doc.expiryDate);
            return (
              <div key={doc.id} style={{ background: "rgba(255,255,255,0.88)", borderRadius: 18, padding: 20, border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 2px 12px rgba(15,23,42,0.04)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                  <span style={{ fontSize: 32 }}>{fileIcon(doc.originalName)}</span>
                  <span style={{ padding: "4px 10px", borderRadius: 8, background: CAT_COLORS[doc.category] + "18", color: CAT_COLORS[doc.category] || "#6b7280", fontSize: 12, fontWeight: 700 }}>{doc.category}</span>
                </div>
                <div style={{ fontWeight: 700, fontSize: 16, color: "#111827", marginBottom: 6 }}>{doc.title}</div>
                {doc.originalName && <div style={{ fontSize: 13, color: "#9ca3af", marginBottom: 8 }}>{doc.originalName}</div>}
                {badge && (
                  <div style={{ display: "inline-block", padding: "3px 10px", borderRadius: 8, background: badge.bg, color: badge.color, fontSize: 12, fontWeight: 700, marginBottom: 8 }}>{badge.label}</div>
                )}
                {doc.notes && <p style={{ margin: "0 0 12px", fontSize: 13, color: "#6b7280" }}>{doc.notes}</p>}
                <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                  {doc.file && (
                    <a href={`/uploads/${doc.file}`} download={doc.originalName || doc.file} style={{ padding: "7px 14px", background: "#f1f5f9", borderRadius: 10, textDecoration: "none", fontSize: 13, fontWeight: 600, color: "#374151" }}>⬇ Download</a>
                  )}
                  <button onClick={() => openEdit(doc)} style={{ padding: "7px 14px", background: "#f1f5f9", borderRadius: 10, border: "none", fontSize: 13, fontWeight: 600, color: "#374151", cursor: "pointer", fontFamily: "inherit" }}>Edit</button>
                  <button onClick={() => setDeleteId(doc.id)} style={{ padding: "7px 14px", background: "rgba(252,165,165,0.1)", borderRadius: 10, border: "1px solid rgba(220,38,38,0.2)", fontSize: 13, fontWeight: 600, color: "#dc2626", cursor: "pointer", fontFamily: "inherit" }}>Delete</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add/Edit modal */}
      {form && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && closeModal()}>
          <div className="modal-box" style={{ maxWidth: 480 }}>
            <h3 style={{ margin: "0 0 20px", fontSize: 20, fontWeight: 700 }}>{form.id ? "Edit Document" : "Add Document"}</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={labelStyle}>Title *</label>
                <input style={inputStyle} value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Home Insurance 2026" />
              </div>
              <div>
                <label style={labelStyle}>Category</label>
                <select style={inputStyle} value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Expiry Date</label>
                <input type="date" style={inputStyle} value={form.expiryDate || ""} onChange={e => setForm(f => ({ ...f, expiryDate: e.target.value }))} />
              </div>
              <div>
                <label style={labelStyle}>Notes</label>
                <textarea style={{ ...inputStyle, resize: "vertical", minHeight: 72 }} value={form.notes || ""} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
              <div>
                <label style={labelStyle}>File {form.id ? "(leave empty to keep existing)" : ""}</label>
                <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" style={{ display: "none" }} onChange={handleFile} />
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <button type="button" style={btnSecondary} onClick={() => fileRef.current.click()}>Choose File</button>
                  <span style={{ fontSize: 13, color: "#6b7280" }}>{file ? file.name : (form.originalName || "No file selected")}</span>
                </div>
              </div>
              <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
                <button style={btnPrimary} onClick={saveForm}>Save</button>
                <button style={btnSecondary} onClick={closeModal}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteId && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setDeleteId(null)}>
          <div className="modal-box" style={{ maxWidth: 360, textAlign: "center" }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>🗑️</div>
            <h3 style={{ margin: "0 0 10px", fontSize: 20, fontWeight: 700 }}>Delete Document?</h3>
            <p style={{ margin: "0 0 24px", color: "#6b7280" }}>The file will be permanently removed.</p>
            <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
              <button onClick={() => confirmDelete(deleteId)} style={{ padding: "10px 20px", background: "rgba(252,165,165,0.12)", color: "#dc2626", border: "1px solid rgba(220,38,38,0.2)", borderRadius: 12, fontWeight: 600, fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>Delete</button>
              <button style={btnSecondary} onClick={() => setDeleteId(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
