import { useState } from "react";
import { apiFetch } from "../lib/api";

const DEFAULT_CATEGORIES = ["Plumber", "Electrician", "Doctor", "Dentist", "Vet", "Locksmith", "Handyman", "Landlord", "Insurance", "Other"];

const CAT_ICONS = {
  Plumber: "🔧", Electrician: "⚡", Doctor: "🏥", Dentist: "🦷",
  Vet: "🐾", Locksmith: "🔐", Handyman: "🛠️", Landlord: "🏠",
  Insurance: "🛡️", Other: "📋",
};

// Deterministic avatar color per category
const CAT_AVATAR_COLORS = {
  Plumber: { bg: "var(--g-sky-bg)", color: "var(--g-sky)" },
  Electrician: { bg: "var(--g-honey-bg)", color: "var(--g-honey)" },
  Doctor: { bg: "var(--g-brick-bg)", color: "var(--g-brick)" },
  Dentist: { bg: "var(--g-sky-bg)", color: "var(--g-sky)" },
  Vet: { bg: "var(--g-sage-bg)", color: "var(--g-sage-dark)" },
  Locksmith: { bg: "var(--g-honey-bg)", color: "var(--g-honey)" },
  Handyman: { bg: "var(--g-sage-bg)", color: "var(--g-sage-dark)" },
  Landlord: { bg: "var(--g-brick-bg)", color: "var(--g-brick)" },
  Insurance: { bg: "var(--g-sky-bg)", color: "var(--g-sky)" },
  Other: { bg: "var(--g-hair2)", color: "var(--g-muted)" },
};
const DEFAULT_AVATAR = { bg: "var(--g-hair2)", color: "var(--g-muted)" };

const labelStyle = { fontSize: 12, color: "var(--g-muted)", display: "block", marginBottom: 6, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" };
const inputStyle = { width: "100%", background: "#fff", border: "1px solid var(--g-hair)", borderRadius: 12, padding: "11px 14px", fontSize: 14, fontFamily: "inherit", color: "var(--g-ink)", boxSizing: "border-box" };
const btnPrimary = { padding: "10px 20px", background: "var(--g-sage)", color: "#fff", border: "none", borderRadius: 12, fontWeight: 600, fontSize: 14, cursor: "pointer", fontFamily: "inherit" };
const btnSecondary = { padding: "10px 20px", background: "var(--g-bg)", color: "var(--g-ink2)", border: "1px solid var(--g-hair)", borderRadius: 12, fontWeight: 600, fontSize: 14, cursor: "pointer", fontFamily: "inherit" };

const EMPTY_FORM = { name: "", category: "Other", phone: "", email: "", address: "", notes: "" };

const getInitials = (name) => {
  return name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
};

export default function HouseholdContacts({ contacts, setContacts, apiEnabled, showToast }) {
  const [catFilter, setCatFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [form, setForm] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [customCats, setCustomCats] = useState([]);
  const [newCatInput, setNewCatInput] = useState("");
  const [showCatManager, setShowCatManager] = useState(false);

  const allCategories = [...DEFAULT_CATEGORIES, ...customCats.filter(c => !DEFAULT_CATEGORIES.includes(c))];

  const visible = contacts
    .filter(c => catFilter === "All" || c.category === catFilter)
    .filter(c => !search || c.name.toLowerCase().includes(search.toLowerCase()) || (c.notes || "").toLowerCase().includes(search.toLowerCase()));

  const sorted = [...visible].sort((a, b) => a.name.localeCompare(b.name));

  const openNew = () => setForm({ ...EMPTY_FORM });
  const openEdit = (c) => setForm({ ...c });
  const closeModal = () => setForm(null);

  const saveForm = async () => {
    if (!form.name?.trim()) return showToast("Name required", "danger");
    const payload = {
      name: form.name.trim(),
      category: form.category,
      phone: form.phone || "",
      email: form.email || "",
      address: form.address || "",
      notes: form.notes || "",
    };
    try {
      if (form.id) {
        const updated = apiEnabled
          ? await apiFetch(`/api/contacts/${form.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
          : { ...form, ...payload };
        if (updated) {
          setContacts(cs => cs.map(c => c.id === form.id ? updated : c));
          showToast("Contact updated");
        }
      } else {
        const created = apiEnabled
          ? await apiFetch("/api/contacts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
          : { ...payload, id: Date.now() };
        if (created) {
          setContacts(cs => [...cs, created]);
          showToast("Contact added");
        }
      }
      closeModal();
    } catch { showToast("Failed to save contact", "danger"); }
  };

  const confirmDelete = async (id) => {
    try {
      if (apiEnabled) await apiFetch(`/api/contacts/${id}`, { method: "DELETE" });
      setContacts(cs => cs.filter(c => c.id !== id));
      setDeleteId(null);
      showToast("Contact deleted");
    } catch { showToast("Failed to delete", "danger"); }
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

  const usedCats = [...new Set(contacts.map(c => c.category))].sort();
  const filterCats = ["All", ...allCategories.filter(c => usedCats.includes(c) || DEFAULT_CATEGORIES.includes(c)), ...customCats.filter(c => !usedCats.includes(c) && !DEFAULT_CATEGORIES.includes(c))].filter((c, i, arr) => arr.indexOf(c) === i);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24, padding: "32px 40px 60px" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
        <div>
          <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: "var(--g-sage)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>Household</p>
          <h1 style={{ margin: 0, fontSize: 44, fontWeight: 400, color: "var(--g-ink)", fontFamily: "var(--g-serif)", lineHeight: 1.1 }}>Contacts</h1>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button style={btnSecondary} onClick={() => setShowCatManager(true)}>Categories</button>
          <button style={btnPrimary} onClick={openNew}>+ Add Contact</button>
        </div>
      </div>

      {/* Search bar */}
      <div style={{ background: "var(--g-card)", borderRadius: 16, padding: "12px 16px", boxShadow: "var(--g-shadow-sm)", display: "flex", alignItems: "center", gap: 10, maxWidth: 360 }}>
        <span style={{ fontSize: 16, color: "var(--g-mute2)" }}>🔍</span>
        <input
          style={{ border: "none", outline: "none", background: "transparent", fontSize: 14, color: "var(--g-ink)", fontFamily: "inherit", width: "100%" }}
          placeholder="Search contacts..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Category filter pills */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {filterCats.map(c => (
          <button
            key={c}
            onClick={() => setCatFilter(c)}
            style={{
              padding: "7px 16px", borderRadius: 999, border: catFilter === c ? "none" : "1px solid var(--g-hair)",
              cursor: "pointer", fontFamily: "inherit", fontWeight: 600, fontSize: 13,
              background: catFilter === c ? "var(--g-sage-bg)" : "var(--g-card)",
              color: catFilter === c ? "var(--g-sage-dark)" : "var(--g-ink2)",
            }}
          >{CAT_ICONS[c] || ""} {c}</button>
        ))}
      </div>

      {sorted.length === 0 ? (
        <div style={{ background: "var(--g-card)", borderRadius: 20, padding: "60px 40px", boxShadow: "var(--g-shadow)", textAlign: "center", color: "var(--g-muted)", fontSize: 15 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📞</div>
          <p style={{ margin: 0 }}>No contacts yet. Click "+ Add Contact" to add one.</p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 16 }}>
          {sorted.map(contact => {
            const avatarColors = CAT_AVATAR_COLORS[contact.category] || DEFAULT_AVATAR;
            return (
              <div key={contact.id} style={{ background: "var(--g-card)", borderRadius: 20, padding: "20px", boxShadow: "var(--g-shadow)", display: "flex", flexDirection: "column", gap: 14 }}>
                {/* Avatar + name */}
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <div style={{
                    width: 52, height: 52, borderRadius: 16, flexShrink: 0,
                    background: avatarColors.bg, color: avatarColors.color,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 18, fontWeight: 700, fontFamily: "var(--g-serif)",
                  }}>
                    {getInitials(contact.name)}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 400, fontSize: 17, color: "var(--g-ink)", fontFamily: "var(--g-serif)", lineHeight: 1.2 }}>{contact.name}</div>
                    <div style={{ fontSize: 13, color: "var(--g-muted)", marginTop: 2 }}>{CAT_ICONS[contact.category] || "📋"} {contact.category}</div>
                  </div>
                </div>

                {/* Category pill */}
                <div style={{ alignSelf: "flex-start", padding: "4px 9px", borderRadius: 999, fontSize: 11.5, fontWeight: 600, background: "var(--g-sage-bg)", color: "var(--g-sage-dark)" }}>{contact.category}</div>

                {/* Contact info */}
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {contact.phone && (
                    <a href={`tel:${contact.phone}`} style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--g-sky)", textDecoration: "none", fontSize: 14, fontWeight: 600 }}>
                      📱 {contact.phone}
                    </a>
                  )}
                  {contact.email && (
                    <a href={`mailto:${contact.email}`} style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--g-muted)", textDecoration: "none", fontSize: 13 }}>
                      ✉️ {contact.email}
                    </a>
                  )}
                  {contact.address && (
                    <div style={{ fontSize: 13, color: "var(--g-mute2)" }}>📍 {contact.address}</div>
                  )}
                </div>

                {contact.notes && (
                  <p style={{ margin: 0, fontSize: 13, color: "var(--g-muted)", borderTop: "1px solid var(--g-hair)", paddingTop: 10, lineHeight: 1.5 }}>{contact.notes}</p>
                )}

                {/* Actions */}
                <div style={{ display: "flex", gap: 8, marginTop: "auto", borderTop: "1px solid var(--g-hair2)", paddingTop: 12 }}>
                  {contact.phone && (
                    <a href={`tel:${contact.phone}`} style={{ ...btnSecondary, padding: "7px 14px", fontSize: 13, textDecoration: "none", flex: 1, textAlign: "center" }}>Call</a>
                  )}
                  {contact.email && (
                    <a href={`mailto:${contact.email}`} style={{ ...btnSecondary, padding: "7px 14px", fontSize: 13, textDecoration: "none", flex: 1, textAlign: "center" }}>Email</a>
                  )}
                  <button onClick={() => openEdit(contact)} style={{ ...btnSecondary, padding: "7px 14px", fontSize: 13 }}>Edit</button>
                  <button onClick={() => setDeleteId(contact.id)} style={{ padding: "7px 14px", background: "var(--g-brick-bg)", color: "var(--g-brick)", border: "1px solid var(--g-hair)", borderRadius: 12, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Del</button>
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
            <h3 style={{ margin: "0 0 24px", fontSize: 24, fontWeight: 400, fontFamily: "var(--g-serif)", color: "var(--g-ink)" }}>{form.id ? "Edit Contact" : "Add Contact"}</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={labelStyle}>Name *</label>
                <input style={inputStyle} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Jan De Vries" />
              </div>
              <div>
                <label style={labelStyle}>Category</label>
                <select style={inputStyle} value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                  {allCategories.map(c => <option key={c} value={c}>{CAT_ICONS[c] || "📋"} {c}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Phone</label>
                <input type="tel" style={inputStyle} value={form.phone || ""} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+32 …" />
              </div>
              <div>
                <label style={labelStyle}>Email</label>
                <input type="email" style={inputStyle} value={form.email || ""} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
              </div>
              <div>
                <label style={labelStyle}>Address</label>
                <input style={inputStyle} value={form.address || ""} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
              </div>
              <div>
                <label style={labelStyle}>Notes</label>
                <textarea style={{ ...inputStyle, resize: "vertical", minHeight: 60 }} value={form.notes || ""} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
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
                  <span key={c} style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 12px", borderRadius: 999, background: "var(--g-bg)", color: "var(--g-ink2)", border: "1px solid var(--g-hair)", fontSize: 13, fontWeight: 600 }}>
                    {CAT_ICONS[c] || "📋"} {c}
                  </span>
                ))}
              </div>
            </div>

            {customCats.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--g-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>Custom</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                  {customCats.map(c => (
                    <span key={c} style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 10px", borderRadius: 999, background: "var(--g-bg)", color: "var(--g-ink2)", border: "1px solid var(--g-hair)", fontSize: 13, fontWeight: 600 }}>
                      📋 {c}
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
                  placeholder="e.g. Accountant"
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
            <h3 style={{ margin: "0 0 10px", fontSize: 22, fontWeight: 400, fontFamily: "var(--g-serif)", color: "var(--g-ink)" }}>Delete Contact?</h3>
            <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 24 }}>
              <button onClick={() => confirmDelete(deleteId)} style={{ padding: "10px 20px", background: "var(--g-brick-bg)", color: "var(--g-brick)", border: "1px solid var(--g-hair)", borderRadius: 12, fontWeight: 600, fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>Delete</button>
              <button style={btnSecondary} onClick={() => setDeleteId(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
