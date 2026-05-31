import { useState, useRef } from "react";
import { apiFetch } from "../lib/api";

const DEFAULT_CATEGORIES = ["Insurance", "Warranty", "Legal", "Medical", "Financial", "Manuals", "Other"];

const CAT_COLORS = {
  Insurance: "#5d7c95", Warranty: "#b8853e", Legal: "#8b5cf6",
  Medical: "#a85a3e", Financial: "#5a7a5e", Manuals: "#6b7c73", Other: "#94a39a",
};

const CAT_ICONS = {
  Insurance: "🛡️", Warranty: "🏷️", Legal: "⚖️",
  Medical: "🏥", Financial: "💰", Manuals: "📖", Other: "📄",
};

const DEFAULT_CAT_COLOR = "#6b7c73";

const labelStyle = { fontSize: 12, color: "var(--g-muted)", display: "block", marginBottom: 6, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" };
const inputStyle = { width: "100%", background: "#fff", border: "1px solid var(--g-hair)", borderRadius: 12, padding: "11px 14px", fontSize: 14, fontFamily: "inherit", color: "var(--g-ink)", boxSizing: "border-box" };
const btnPrimary = { padding: "10px 20px", background: "var(--g-sage)", color: "#fff", border: "none", borderRadius: 12, fontWeight: 600, fontSize: 14, cursor: "pointer", fontFamily: "inherit" };
const btnSecondary = { padding: "10px 20px", background: "var(--g-bg)", color: "var(--g-ink2)", border: "1px solid var(--g-hair)", borderRadius: 12, fontWeight: 600, fontSize: 14, cursor: "pointer", fontFamily: "inherit" };

const getDaysUntil = (dateStr) => {
  if (!dateStr) return null;
  return Math.ceil((new Date(dateStr) - new Date()) / (1000 * 60 * 60 * 24));
};

const expiryBadge = (dateStr) => {
  const days = getDaysUntil(dateStr);
  if (days === null) return null;
  if (days < 0) return { label: "Expired", color: "var(--g-brick)", bg: "var(--g-brick-bg)" };
  if (days <= 30) return { label: `Expires in ${days}d`, color: "var(--g-brick)", bg: "var(--g-brick-bg)" };
  if (days <= 90) return { label: `Expires in ${days}d`, color: "var(--g-honey)", bg: "var(--g-honey-bg)" };
  return { label: dateStr, color: "var(--g-muted)", bg: "var(--g-hair2)" };
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
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [customCats, setCustomCats] = useState([]);
  const [newCatInput, setNewCatInput] = useState("");
  const [showCatManager, setShowCatManager] = useState(false);
  const fileRef = useRef();

  const allCategories = [...DEFAULT_CATEGORIES, ...customCats.filter(c => !DEFAULT_CATEGORIES.includes(c))];

  const getCatColor = (cat) => CAT_COLORS[cat] || DEFAULT_CAT_COLOR;
  const getCatIcon = (cat) => CAT_ICONS[cat] || "📁";

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
    <div className="page" style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
        <div>
          <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: "var(--g-sage)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>Household</p>
          <h1 style={{ margin: 0, fontSize: 44, fontWeight: 400, color: "var(--g-ink)", fontFamily: "var(--g-serif)", lineHeight: 1.1 }}>Document Vault</h1>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button style={btnSecondary} onClick={() => setShowCatManager(true)}>Categories</button>
          <button style={btnPrimary} onClick={openNew}>+ Add Document</button>
        </div>
      </div>

      {/* 3-column layout: categories | list | preview */}
      <div className="doc-vault-grid">
        {/* Category sidebar */}
        <div style={{ background: "var(--g-card)", borderRadius: 20, boxShadow: "var(--g-shadow)", overflow: "hidden" }}>
          <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--g-hair)" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--g-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Categories</div>
          </div>
          {uniqueFilterCats.map(c => (
            <button
              key={c}
              onClick={() => setCatFilter(c)}
              style={{
                display: "flex", alignItems: "center", gap: 10,
                width: "100%", padding: "11px 16px",
                border: "none", borderBottom: "1px solid var(--g-hair2)",
                background: catFilter === c ? "var(--g-sage-bg)" : "transparent",
                color: catFilter === c ? "var(--g-sage-dark)" : "var(--g-ink2)",
                fontFamily: "inherit", fontWeight: catFilter === c ? 600 : 500, fontSize: 13,
                cursor: "pointer", textAlign: "left",
              }}
            >
              <span style={{ fontSize: 16 }}>{c === "All" ? "📁" : getCatIcon(c)}</span>
              {c}
            </button>
          ))}
        </div>

        {/* Document list */}
        <div>
          {sorted.length === 0 ? (
            <div style={{ background: "var(--g-card)", borderRadius: 20, padding: "60px 40px", boxShadow: "var(--g-shadow)", textAlign: "center", color: "var(--g-muted)", fontSize: 15 }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>📁</div>
              <p style={{ margin: 0 }}>No documents yet. Click "+ Add Document" to store one.</p>
            </div>
          ) : (
            <div style={{ background: "var(--g-card)", borderRadius: 20, boxShadow: "var(--g-shadow)", overflow: "hidden" }}>
              {sorted.map((doc, idx) => {
                const badge = expiryBadge(doc.expiryDate);
                const catColor = getCatColor(doc.category);
                const isSelected = selectedDoc?.id === doc.id;
                return (
                  <div
                    key={doc.id}
                    onClick={() => setSelectedDoc(isSelected ? null : doc)}
                    style={{
                      display: "flex", alignItems: "center", gap: 16, padding: "14px 24px",
                      borderTop: idx > 0 ? "1px solid var(--g-hair2)" : "none",
                      cursor: "pointer",
                      background: isSelected ? "var(--g-sage-bg)" : "transparent",
                      transition: "background 0.1s",
                    }}
                  >
                    {/* Type badge */}
                    <div style={{ fontSize: 28, flexShrink: 0 }}>{fileIcon(doc.originalName)}</div>

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
                        <span style={{ fontWeight: 600, fontSize: 14, color: "var(--g-ink)" }}>{doc.title}</span>
                        <span style={{ padding: "3px 9px", borderRadius: 999, fontSize: 11.5, fontWeight: 600, background: catColor + "18", color: catColor }}>{doc.category}</span>
                        {badge && (
                          <span style={{ padding: "3px 9px", borderRadius: 999, fontSize: 11.5, fontWeight: 600, background: badge.bg, color: badge.color }}>{badge.label}</span>
                        )}
                      </div>
                      {doc.originalName && <div style={{ fontSize: 12, color: "var(--g-mute2)" }}>{doc.originalName}</div>}
                      {doc.notes && <div style={{ fontSize: 12, color: "var(--g-muted)", marginTop: 2 }}>{doc.notes}</div>}
                    </div>

                    {/* Actions */}
                    <div style={{ display: "flex", gap: 6, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                      {doc.file && (
                        <a href={`/uploads/${doc.file}`} download={doc.originalName || doc.file} style={{ ...btnSecondary, padding: "6px 12px", fontSize: 12, textDecoration: "none" }}>↓</a>
                      )}
                      <button onClick={() => openEdit(doc)} style={{ ...btnSecondary, padding: "6px 12px", fontSize: 12 }}>Edit</button>
                      <button onClick={() => setDeleteId(doc.id)} style={{ padding: "6px 12px", background: "var(--g-brick-bg)", color: "var(--g-brick)", border: "1px solid var(--g-hair)", borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Del</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right column: document preview */}
        <div style={{
          background: "var(--g-card)", borderRadius: 20, boxShadow: "var(--g-shadow)",
          display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 400,
        }}>
          {selectedDoc ? (
            <>
              <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--g-hair)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexShrink: 0 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, color: "var(--g-ink)", fontFamily: "var(--g-serif)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{selectedDoc.title}</div>
                  {selectedDoc.originalName && <div style={{ fontSize: 11, color: "var(--g-mute2)", marginTop: 1 }}>{selectedDoc.originalName}</div>}
                </div>
                <button onClick={() => setSelectedDoc(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--g-mute2)", fontSize: 18, lineHeight: 1, flexShrink: 0, padding: "2px 4px" }}>×</button>
              </div>
              <div style={{ flex: 1, overflow: "hidden", background: "#1e293b", display: "flex", alignItems: "center", justifyContent: "center", minHeight: 300 }}>
                {selectedDoc.file ? (
                  isImage(selectedDoc.originalName) ? (
                    <img src={`/uploads/${selectedDoc.file}`} alt={selectedDoc.title} style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
                  ) : isPdf(selectedDoc.originalName) ? (
                    <iframe src={`/uploads/${selectedDoc.file}`} title={selectedDoc.title} style={{ width: "100%", height: "100%", border: "none", minHeight: 380 }} />
                  ) : (
                    <div style={{ textAlign: "center", color: "rgba(255,255,255,0.5)", padding: 32 }}>
                      <div style={{ fontSize: 48, marginBottom: 12 }}>📄</div>
                      <div style={{ fontSize: 14 }}>Preview not available</div>
                      <a href={`/uploads/${selectedDoc.file}`} download={selectedDoc.originalName || selectedDoc.file} style={{ display: "inline-block", marginTop: 14, padding: "8px 18px", background: "var(--g-sage)", borderRadius: 10, textDecoration: "none", fontSize: 13, fontWeight: 600, color: "#fff" }}>Download</a>
                    </div>
                  )
                ) : (
                  <div style={{ textAlign: "center", color: "rgba(255,255,255,0.5)", padding: 32 }}>
                    <div style={{ fontSize: 48, marginBottom: 12 }}>📄</div>
                    <div style={{ fontSize: 14 }}>No file attached</div>
                  </div>
                )}
              </div>
              {selectedDoc.file && (
                <div style={{ padding: "10px 16px", borderTop: "1px solid var(--g-hair)", display: "flex", justifyContent: "flex-end", flexShrink: 0 }}>
                  <a href={`/uploads/${selectedDoc.file}`} download={selectedDoc.originalName || selectedDoc.file} style={{ ...btnSecondary, padding: "7px 16px", fontSize: 13, textDecoration: "none" }}>Download</a>
                </div>
              )}
            </>
          ) : (
            <div style={{
              flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
              border: "2px dashed var(--g-hair)", borderRadius: 20, margin: 16, gap: 12, padding: 24, textAlign: "center",
            }}>
              <div style={{ fontSize: 40, opacity: 0.3 }}>📄</div>
              <p style={{ margin: 0, fontSize: 14, color: "var(--g-muted)", fontFamily: "var(--g-sans)" }}>Select a document to preview</p>
            </div>
          )}
        </div>
      </div>

      {/* Add/Edit modal */}
      {form && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && closeModal()}>
          <div className="modal-box" style={{ maxWidth: 480 }}>
            <h3 style={{ margin: "0 0 24px", fontSize: 24, fontWeight: 400, fontFamily: "var(--g-serif)", color: "var(--g-ink)" }}>{form.id ? "Edit Document" : "Add Document"}</h3>
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
                  <span style={{ fontSize: 13, color: "var(--g-muted)" }}>{file ? file.name : (form.originalName || "No file selected")}</span>
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
            <h3 style={{ margin: "0 0 24px", fontSize: 24, fontWeight: 400, fontFamily: "var(--g-serif)", color: "var(--g-ink)" }}>Manage Categories</h3>

            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--g-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>Default</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                {DEFAULT_CATEGORIES.map(c => (
                  <span key={c} style={{ padding: "5px 12px", borderRadius: 999, background: (CAT_COLORS[c] || DEFAULT_CAT_COLOR) + "18", color: CAT_COLORS[c] || DEFAULT_CAT_COLOR, fontSize: 13, fontWeight: 600 }}>{c}</span>
                ))}
              </div>
            </div>

            {customCats.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--g-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>Custom</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                  {customCats.map(c => (
                    <span key={c} style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 10px", borderRadius: 999, background: "var(--g-bg)", color: "var(--g-ink2)", border: "1px solid var(--g-hair)", fontSize: 13, fontWeight: 600 }}>
                      {c}
                      <button onClick={() => removeCustomCategory(c)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--g-mute2)", fontSize: 14, padding: 0, lineHeight: 1 }}>×</button>
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
            <h3 style={{ margin: "0 0 10px", fontSize: 22, fontWeight: 400, fontFamily: "var(--g-serif)", color: "var(--g-ink)" }}>Delete Document?</h3>
            <p style={{ margin: "0 0 24px", color: "var(--g-muted)", fontSize: 14 }}>The file will be permanently removed.</p>
            <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
              <button onClick={() => confirmDelete(deleteId)} style={{ padding: "10px 20px", background: "var(--g-brick-bg)", color: "var(--g-brick)", border: "1px solid var(--g-hair)", borderRadius: 12, fontWeight: 600, fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>Delete</button>
              <button style={btnSecondary} onClick={() => setDeleteId(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
