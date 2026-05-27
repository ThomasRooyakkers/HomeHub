import { useState } from "react";
import { apiFetch } from "../lib/api";

const CATEGORIES = ["Plumber", "Electrician", "Doctor", "Dentist", "Vet", "Locksmith", "Handyman", "Landlord", "Insurance", "Other"];

const CAT_ICONS = {
  Plumber: "🔧", Electrician: "⚡", Doctor: "🏥", Dentist: "🦷",
  Vet: "🐾", Locksmith: "🔐", Handyman: "🛠️", Landlord: "🏠",
  Insurance: "🛡️", Other: "📋",
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

const EMPTY_FORM = { name: "", category: "Other", phone: "", email: "", address: "", notes: "" };

export default function HouseholdContacts({ contacts, setContacts, apiEnabled, showToast }) {
  const [catFilter, setCatFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [form, setForm] = useState(null);
  const [deleteId, setDeleteId] = useState(null);

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

  const usedCats = [...new Set(contacts.map(c => c.category))].sort();

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "28px 20px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <h2 style={{ margin: 0, fontSize: 26, fontWeight: 800, color: "#111827" }}>📞 Household Contacts</h2>
        <button style={btnPrimary} onClick={openNew}>+ Add Contact</button>
      </div>

      {/* Search + filter */}
      <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
        <input
          style={{ ...inputStyle, flex: "1 1 200px", maxWidth: 300 }}
          placeholder="Search contacts…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {["All", ...usedCats].map(c => (
            <button
              key={c}
              onClick={() => setCatFilter(c)}
              style={{
                padding: "8px 16px", borderRadius: 20, border: "none", cursor: "pointer",
                fontFamily: "inherit", fontWeight: 600, fontSize: 13,
                background: catFilter === c ? "var(--accent, #16a34a)" : "#f1f5f9",
                color: catFilter === c ? "#fff" : "#374151",
              }}
            >{CAT_ICONS[c] || ""} {c}</button>
          ))}
        </div>
      </div>

      {sorted.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 20px", color: "#9ca3af" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📞</div>
          <p style={{ margin: 0 }}>No contacts yet. Click "+ Add Contact" to add one.</p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 16 }}>
          {sorted.map(contact => (
            <div key={contact.id} style={{ background: "rgba(255,255,255,0.88)", borderRadius: 18, padding: 20, border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 2px 12px rgba(15,23,42,0.04)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                <span style={{ fontSize: 28 }}>{CAT_ICONS[contact.category] || "📋"}</span>
                <span style={{ padding: "3px 10px", borderRadius: 8, background: "#f1f5f9", color: "#6b7280", fontSize: 12, fontWeight: 600 }}>{contact.category}</span>
              </div>
              <div style={{ fontWeight: 700, fontSize: 17, color: "#111827", marginBottom: 10 }}>{contact.name}</div>
              {contact.phone && (
                <a href={`tel:${contact.phone}`} style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--accent, #16a34a)", textDecoration: "none", fontSize: 14, fontWeight: 600, marginBottom: 6 }}>
                  📱 {contact.phone}
                </a>
              )}
              {contact.email && (
                <a href={`mailto:${contact.email}`} style={{ display: "flex", alignItems: "center", gap: 8, color: "#6b7280", textDecoration: "none", fontSize: 13, marginBottom: 6 }}>
                  ✉️ {contact.email}
                </a>
              )}
              {contact.address && (
                <div style={{ fontSize: 13, color: "#9ca3af", marginBottom: 6 }}>📍 {contact.address}</div>
              )}
              {contact.notes && (
                <p style={{ margin: "8px 0 0", fontSize: 13, color: "#6b7280", borderTop: "1px solid #f3f4f6", paddingTop: 8 }}>{contact.notes}</p>
              )}
              <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                <button onClick={() => openEdit(contact)} style={{ padding: "6px 14px", background: "#f1f5f9", borderRadius: 10, border: "none", fontSize: 13, fontWeight: 600, color: "#374151", cursor: "pointer", fontFamily: "inherit" }}>Edit</button>
                <button onClick={() => setDeleteId(contact.id)} style={{ padding: "6px 14px", background: "rgba(252,165,165,0.1)", borderRadius: 10, border: "1px solid rgba(220,38,38,0.2)", fontSize: 13, fontWeight: 600, color: "#dc2626", cursor: "pointer", fontFamily: "inherit" }}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit modal */}
      {form && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && closeModal()}>
          <div className="modal-box" style={{ maxWidth: 480 }}>
            <h3 style={{ margin: "0 0 20px", fontSize: 20, fontWeight: 700 }}>{form.id ? "Edit Contact" : "Add Contact"}</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={labelStyle}>Name *</label>
                <input style={inputStyle} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Jan De Vries" />
              </div>
              <div>
                <label style={labelStyle}>Category</label>
                <select style={inputStyle} value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                  {CATEGORIES.map(c => <option key={c} value={c}>{CAT_ICONS[c]} {c}</option>)}
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

      {/* Delete confirm */}
      {deleteId && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setDeleteId(null)}>
          <div className="modal-box" style={{ maxWidth: 360, textAlign: "center" }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>🗑️</div>
            <h3 style={{ margin: "0 0 10px", fontSize: 20, fontWeight: 700 }}>Delete Contact?</h3>
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
