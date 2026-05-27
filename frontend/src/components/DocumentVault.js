import { useState, useRef } from "react";
import { apiFetch } from "../lib/api";

const DEFAULT_CATEGORIES = ["Insurance", "Warranty", "Legal", "Medical", "Financial", "Manuals", "Other"];

const CAT_COLORS = {
  Insurance: "#3b82f6", Warranty: "#f59e0b", Legal: "#8b5cf6",
  Medical: "#ec4899", Financial: "#10b981", Manuals: "#6b7280", Other: "#9ca3af",
};

const DEFAULT_CAT_COLOR = "#6b7280";

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

const isImage = (name) => {
  if (!name) return false;
  return /\.(jpg|jpeg|png|webp)$/i.test(name);
};

const isPdf = (name) => {
  if (!name) return false;
  return /\.pdf$/i.test(name);
};

const EMPTY_FORM = { title: "", category: "Insurance", expiryDate: "", notes: "" };

export default function DocumentVault({ documents, setDocuments, apiEnabled, showToast }) {
  const [catFilter, setCatFilter] = useState("All");
  const [form, setForm] = useState(null);
  const [file, setFile] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [previewDoc, setPreviewDoc] = useState(null);
  const [customCats, setCustomCats] = useState([]);
  const [newCatInput, setNewCatInput] = useState("");
  const [showCatManager, setShowCatManager] = useState(false);
  const fileRef = useRef();

  const allCategories = [...DEFAULT_CATEGORIES, ...customCats.filter(c => !DEFAULT_CATEGORIES.includes(c))];

  const getCatColor = (cat) => CAT_COLORS[cat] || DEFAULT_CAT_COLOR;

  const visible = catFilter === "All" ? documents : documents.filter(d => d.category === catFilter);
  const sorted = [...visible].sort((a, b) => {
    const da = getDaysUntil(a.expiryDate);
    const db = getDaysUntil(b.expiryDate);
    if (da === null && db === null) return 0;
    if (da === null) return 1;
    if (db === null) return -1;
    return da - db;
  });

  const usedCats = [...new Set(documents.map(d => d.category))];
  const filterCats = ["All", ...allCategories.filter(c => usedCats.includes(c) || DEFAULT_CATEGORIES.includes(c)), ...customCats.filter(c => !DEFAULT_CATEGORIES.includes(c))];
  const uniqueFilterCats = [...new Set(filterCats)];

  const openNew = () => { setForm({ ...EMPTY_FORM }); setFile(null); };
  const openEdit = (doc) => { setForm({ ...doc }); setFile(null); };
  const closeModal = () => { setForm(null); setFile(null); };

  const handleFile = (e) => {
    const f = e.target.files?.[0];
    if (f) setFile(f);
  };

  const addCustomCategory = () => {
    const cat = newCatInput.trim();
    if (!cat || allCategories.includes(cat)) return;
    setCustomCats(prev => [...prev, cat]);
    setNewCatInput("");
  };

  const removeCustomCategory = (cat) => {
    setCustomCats(prev => prev.filter(c => c !== cat));
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
    <div style={{ maxWidth: 960, margin: "0 auto", padding: "28px 20px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, gap: 12, flexWrap: "wrap" }}>
        <h2 style={{ margin: 0, fontSize: 26, fontWeight: 800, color: "#111827" }}>📁 Document Vault</h2>
        <div style={{ display: "flex", gap: 8 }}>
          <button style={btnSecondary} onClick={() => setShowCatManager(true)}>Categories</button>
          <button style={btnPrimary} onClick={openNew}>+ Add Document</button>
        </div>
      </div>

      {/* Category filter */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 24 }}>
        {uniqueFilterCats.map(c => (
          <button
            key={c}
            onClick={() => setCatFilter(c)}
            style={{
              padding: "7px 16px", borderRadius: 20, border: "none", cursor: "pointer",
              fontFamily: "inherit", fontWeight: 600, fontSize: 13,
              background: catFilter === c ? (getCatColor(c) || "var(--accent, #16a34a)") : "#f1f5f9",
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
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
          {sorted.map(doc => {
            const badge = expiryBadge(doc.expiryDate);
            const catColor = getCatColor(doc.category);
            return (
              <div key={doc.id} style={{ background: "rgba(255,255,255,0.88)", borderRadius: 18, border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 2px 12px rgba(15,23,42,0.04)", overflow: "hidden" }}>
                {/* File preview thumbnail */}
                {doc.file && (
                  <div
                    onClick={() => setPreviewDoc(doc)}
                    style={{
                      height: 140, background: "#1e293b", cursor: "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      overflow: "hidden", position: "relative",
                    }}
                  >
                    {isImage(doc.originalName) ? (
                      <img
                        src={`/uploads/${doc.file}`}
                        alt={doc.title}
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      />
                    ) : (
                      <div style={{ textAlign: "center", color: "#94a3b8" }}>
                        <div style={{ fontSize: 48, marginBottom: 6 }}>📕</div>
                        <div style={{ fontSize: 12, fontWeight: 600 }}>Click to preview</div>
                      </div>
                    )}
                    <div style={{
                      position: "absolute", inset: 0, background: "rgba(0,0,0,0)",
                      transition: "background 0.15s",
                    }} className="doc-preview-overlay" />
                  </div>
                )}

                <div style={{ padding: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                    <span style={{ fontSize: doc.file ? 22 : 32 }}>{fileIcon(doc.originalName)}</span>
                    <span style={{ padding: "4px 10px", borderRadius: 8, background: catColor + "18", color: catColor, fontSize: 12, fontWeight: 700 }}>{doc.category}</span>
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 15, color: "#111827", marginBottom: 4 }}>{doc.title}</div>
                  {doc.originalName && <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 6 }}>{doc.originalName}</div>}
                  {badge && (
                    <div style={{ display: "inline-block", padding: "3px 10px", borderRadius: 8, background: badge.bg, color: badge.color, fontSize: 12, fontWeight: 700, marginBottom: 8 }}>{badge.label}</div>
                  )}
                  {doc.notes && <p style={{ margin: "0 0 10px", fontSize: 13, color: "#6b7280", lineHeight: 1.4 }}>{doc.notes}</p>}
                  <div style={{ display: "flex", gap: 7, marginTop: 8, flexWrap: "wrap" }}>
                    {doc.file && (
                      <button
                        onClick={() => setPreviewDoc(doc)}
                        style={{ padding: "6px 12px", background: "#f1f5f9", borderRadius: 9, border: "none", fontSize: 12, fontWeight: 600, color: "#374151", cursor: "pointer", fontFamily: "inherit" }}
                      >👁 Preview</button>
                    )}
                    {doc.file && (
                      <a href={`/uploads/${doc.file}`} download={doc.originalName || doc.file} style={{ padding: "6px 12px", background: "#f1f5f9", borderRadius: 9, textDecoration: "none", fontSize: 12, fontWeight: 600, color: "#374151" }}>⬇ Download</a>
                    )}
                    <button onClick={() => openEdit(doc)} style={{ padding: "6px 12px", background: "#f1f5f9", borderRadius: 9, border: "none", fontSize: 12, fontWeight: 600, color: "#374151", cursor: "pointer", fontFamily: "inherit" }}>Edit</button>
                    <button onClick={() => setDeleteId(doc.id)} style={{ padding: "6px 12px", background: "rgba(252,165,165,0.1)", borderRadius: 9, border: "1px solid rgba(220,38,38,0.2)", fontSize: 12, fontWeight: 600, color: "#dc2626", cursor: "pointer", fontFamily: "inherit" }}>Delete</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Preview modal */}
      {previewDoc && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setPreviewDoc(null)}>
          <div style={{
            background: "#fff", borderRadius: 20, width: "min(900px, 96vw)",
            maxHeight: "calc(100vh - 40px)", display: "flex", flexDirection: "column",
            overflow: "hidden", boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", borderBottom: "1px solid #e5e7eb" }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 16, color: "#111827" }}>{previewDoc.title}</div>
                {previewDoc.originalName && <div style={{ fontSize: 12, color: "#9ca3af" }}>{previewDoc.originalName}</div>}
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <a href={`/uploads/${previewDoc.file}`} download={previewDoc.originalName || previewDoc.file} style={{ padding: "7px 14px", background: "#f1f5f9", borderRadius: 10, textDecoration: "none", fontSize: 13, fontWeight: 600, color: "#374151" }}>⬇ Download</a>
                <button onClick={() => setPreviewDoc(null)} style={{ padding: "7px 14px", background: "#f1f5f9", borderRadius: 10, border: "none", fontSize: 13, fontWeight: 600, color: "#374151", cursor: "pointer", fontFamily: "inherit" }}>Close</button>
              </div>
            </div>
            <div style={{ flex: 1, overflow: "hidden", background: "#1e293b", display: "flex", alignItems: "center", justifyContent: "center", minHeight: 400 }}>
              {isImage(previewDoc.originalName) ? (
                <img
                  src={`/uploads/${previewDoc.file}`}
                  alt={previewDoc.title}
                  style={{ maxWidth: "100%", maxHeight: "calc(100vh - 160px)", objectFit: "contain" }}
                />
              ) : isPdf(previewDoc.originalName) ? (
                <iframe
                  src={`/uploads/${previewDoc.file}`}
                  title={previewDoc.title}
                  style={{ width: "100%", height: "calc(100vh - 160px)", border: "none" }}
                />
              ) : (
                <div style={{ textAlign: "center", color: "#94a3b8", padding: 40 }}>
                  <div style={{ fontSize: 64, marginBottom: 16 }}>📄</div>
                  <div style={{ fontSize: 16 }}>Preview not available for this file type.</div>
                  <a href={`/uploads/${previewDoc.file}`} download={previewDoc.originalName || previewDoc.file} style={{ display: "inline-block", marginTop: 16, padding: "10px 20px", background: "var(--accent, #16a34a)", borderRadius: 10, textDecoration: "none", fontSize: 14, fontWeight: 600, color: "#fff" }}>⬇ Download</a>
                </div>
              )}
            </div>
          </div>
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
                  {allCategories.map(c => <option key={c} value={c}>{c}</option>)}
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

      {/* Category manager modal */}
      {showCatManager && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setShowCatManager(false)}>
          <div className="modal-box" style={{ maxWidth: 420 }}>
            <h3 style={{ margin: "0 0 20px", fontSize: 20, fontWeight: 700 }}>Manage Categories</h3>

            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Default</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                {DEFAULT_CATEGORIES.map(c => (
                  <span key={c} style={{ padding: "5px 12px", borderRadius: 10, background: (CAT_COLORS[c] || DEFAULT_CAT_COLOR) + "18", color: CAT_COLORS[c] || DEFAULT_CAT_COLOR, fontSize: 13, fontWeight: 600 }}>{c}</span>
                ))}
              </div>
            </div>

            {customCats.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Custom</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                  {customCats.map(c => (
                    <span key={c} style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 10px", borderRadius: 10, background: "#f1f5f9", color: "#374151", fontSize: 13, fontWeight: 600 }}>
                      {c}
                      <button onClick={() => removeCustomCategory(c)} style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af", fontSize: 14, padding: 0, lineHeight: 1 }}>×</button>
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label style={labelStyle}>Add Custom Category</label>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  style={{ ...inputStyle, flex: 1 }}
                  value={newCatInput}
                  onChange={e => setNewCatInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && addCustomCategory()}
                  placeholder="e.g. Contracts"
                />
                <button style={btnPrimary} onClick={addCustomCategory}>Add</button>
              </div>
            </div>

            <div style={{ marginTop: 20 }}>
              <button style={btnSecondary} onClick={() => setShowCatManager(false)}>Done</button>
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
