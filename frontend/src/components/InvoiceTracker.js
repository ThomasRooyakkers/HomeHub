import { useState, useEffect, useRef } from "react";
import { apiFetch } from "../lib/api";
import { fmt, fmtDate, displayStatus, statusStyle } from "../lib/utils";

const STATUSES = { ALL: "all", UNPAID: "unpaid", PAID: "paid", OVERDUE: "overdue" };

const EMPTY_FORM = { id: null, vendor: "", amount: "", dueDate: "", invoiceNo: "", notes: "", status: "unpaid", file: null };

export default function InvoiceTracker({ invoices, setInvoices, apiEnabled, showToast }) {
  const [filter, setFilter] = useState(STATUSES.ALL);
  const [form, setForm] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const fileRef = useRef();

  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      if (form) setForm(null);
      else if (deleteId) setDeleteId(null);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [form, deleteId]);

  const handleFile = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = (ev) => setForm(p => ({ ...p, file: { name: f.name, data: ev.target.result }, _file: f }));
    reader.readAsDataURL(f);
  };

  const saveForm = async () => {
    if (!form.vendor.trim() || !form.amount) return;
    const { _file, ...payload } = form;

    if (apiEnabled) {
      const method = form.id ? "PUT" : "POST";
      const endpoint = form.id ? `/api/invoices/${form.id}` : "/api/invoices";
      let body, headers;
      if (_file) {
        body = new FormData();
        body.append("data", JSON.stringify({ ...payload, file: null }));
        body.append("file", _file);
      } else {
        body = JSON.stringify(payload);
        headers = { "Content-Type": "application/json" };
      }
      const result = await apiFetch(endpoint, { method, body, headers });
      if (result) {
        setInvoices(prev => form.id ? prev.map(i => i.id === form.id ? result : i) : [...prev, result]);
        showToast(form.id ? "Invoice updated" : "Invoice added");
        setForm(null);
        return;
      }
    }

    if (form.id) {
      setInvoices(prev => prev.map(i => i.id === form.id ? { ...payload } : i));
    } else {
      setInvoices(prev => [...prev, { ...payload, id: Date.now() }]);
    }
    showToast(form.id ? "Invoice updated" : "Invoice added");
    setForm(null);
  };

  const togglePaid = async (id) => {
    const invoice = invoices.find(i => i.id === id);
    if (!invoice) return;
    const updated = { ...invoice, status: invoice.status === "paid" ? "unpaid" : "paid" };
    if (apiEnabled) {
      const result = await apiFetch(`/api/invoices/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updated),
      });
      if (result) { setInvoices(prev => prev.map(i => i.id === id ? result : i)); showToast("Status updated"); return; }
    }
    setInvoices(prev => prev.map(i => i.id === id ? updated : i));
    showToast("Status updated");
  };

  const confirmDelete = async () => {
    if (apiEnabled) await apiFetch(`/api/invoices/${deleteId}`, { method: "DELETE" });
    setInvoices(prev => prev.filter(i => i.id !== deleteId));
    setDeleteId(null);
    showToast("Invoice deleted", "danger");
  };

  const totalUnpaid = invoices.filter(i => displayStatus(i) !== "paid").reduce((a, i) => a + parseFloat(i.amount || 0), 0);
  const totalPaid = invoices.filter(i => i.status === "paid").reduce((a, i) => a + parseFloat(i.amount || 0), 0);
  const overdueCount = invoices.filter(i => displayStatus(i) === "overdue").length;

  const filtered = invoices.filter(inv => {
    const s = displayStatus(inv);
    return filter === STATUSES.ALL || s === filter;
  });

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16, marginBottom: 32 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 28, fontWeight: 800, color: "#166534" }}>Invoice Tracker</h2>
          <p style={{ margin: "8px 0 0", color: "#64748b", fontSize: 16 }}>Track household bills, due dates, and payment status.</p>
        </div>
        <button onClick={() => setForm({ ...EMPTY_FORM })} style={{ background: "linear-gradient(135deg, #16a34a, #22c55e)", border: "none", color: "#fff", padding: "14px 24px", borderRadius: 16, fontSize: 15, fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 12px rgba(22,163,74,0.3)" }}>
          + Add Invoice
        </button>
      </div>

      {/* Stats */}
      <div className="stats-grid-3" style={{ marginBottom: 32 }}>
        {[
          { label: "Total unpaid", value: fmt(totalUnpaid), color: "#16a34a" },
          { label: "Total paid", value: fmt(totalPaid), color: "#22c55e" },
          { label: "Overdue", value: overdueCount, color: "#dc2626" },
        ].map(s => (
          <div key={s.label} style={{ background: "linear-gradient(135deg, #f0fdf4, #dcfce7)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: 20, padding: "24px", boxShadow: "0 4px 12px rgba(0,0,0,0.05)" }}>
            <p style={{ margin: 0, fontSize: 13, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 600 }}>{s.label}</p>
            <p style={{ margin: "8px 0 0", fontSize: 28, fontWeight: 800, color: s.color }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div style={{ display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
        {[["All", STATUSES.ALL], ["Unpaid", STATUSES.UNPAID], ["Paid", STATUSES.PAID], ["Overdue", STATUSES.OVERDUE]].map(([label, val]) => (
          <button key={val} onClick={() => setFilter(val)} style={{
            padding: "12px 20px", borderRadius: 12,
            border: filter === val ? "2px solid #16a34a" : "2px solid rgba(34,197,94,0.2)",
            background: filter === val ? "linear-gradient(135deg, #dcfce7, #bbf7d0)" : "rgba(255,255,255,0.8)",
            color: filter === val ? "#166534" : "#64748b",
            fontSize: 14, fontWeight: 600, cursor: "pointer", transition: "all 0.2s ease",
          }}>{label}</button>
        ))}
      </div>

      {/* Invoice list */}
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {filtered.length === 0 && (
          <div style={{ textAlign: "center", color: "#64748b", padding: "48px 0", fontSize: 16 }}>No invoices found.</div>
        )}
        {filtered.map(inv => {
          const s = statusStyle(displayStatus(inv));
          return (
            <div key={inv.id} style={{ background: "linear-gradient(135deg, #f8fafc, #f1f5f9)", border: "1px solid rgba(34,197,94,0.1)", borderRadius: 16, padding: "20px 24px", display: "flex", alignItems: "center", gap: 20, boxShadow: "0 2px 8px rgba(0,0,0,0.05)", flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                  <span style={{ fontWeight: 700, fontSize: 18, color: "#166534" }}>{inv.vendor}</span>
                  <span style={{ background: s.bg, color: s.color, fontSize: 12, fontWeight: 700, padding: "4px 12px", borderRadius: 20, textTransform: "uppercase", letterSpacing: 0.5 }}>{s.label}</span>
                  {inv.file && <span style={{ fontSize: 12, color: "#3b82f6", background: "rgba(59,130,246,0.1)", padding: "4px 10px", borderRadius: 20 }}>📎 {inv.file.name}</span>}
                </div>
                <div style={{ display: "flex", gap: 24, marginTop: 8, fontSize: 14, color: "#64748b", flexWrap: "wrap" }}>
                  <span>#{inv.invoiceNo || "—"}</span>
                  <span>Due: {fmtDate(inv.dueDate)}</span>
                  {inv.notes && <span>· {inv.notes}</span>}
                </div>
              </div>
              <div style={{ fontSize: 20, fontWeight: 800, color: "#166534", minWidth: 100, textAlign: "right" }}>{fmt(inv.amount)}</div>
              <div style={{ display: "flex", gap: 8, flexShrink: 0, flexWrap: "wrap" }}>
                <button onClick={() => togglePaid(inv.id)} title={inv.status === "paid" ? "Mark unpaid" : "Mark paid"} style={{ background: inv.status === "paid" ? "rgba(34,197,94,0.1)" : "rgba(22,163,74,0.1)", border: "1px solid rgba(34,197,94,0.2)", color: "#16a34a", borderRadius: 10, padding: "8px 12px", cursor: "pointer", fontSize: 16 }}>
                  {inv.status === "paid" ? "✓" : "○"}
                </button>
                <button onClick={() => setForm({ ...inv })} style={{ background: "rgba(255,255,255,0.8)", border: "1px solid rgba(34,197,94,0.1)", color: "#64748b", borderRadius: 10, padding: "8px 12px", cursor: "pointer", fontSize: 14 }}>✏️</button>
                <button onClick={() => setDeleteId(inv.id)} style={{ background: "rgba(252,165,165,0.1)", border: "1px solid rgba(252,165,165,0.2)", color: "#dc2626", borderRadius: 10, padding: "8px 12px", cursor: "pointer", fontSize: 14 }}>🗑</button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add / Edit modal */}
      {form && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setForm(null)}>
          <div className="modal-box">
            <h2 style={{ margin: "0 0 24px", fontSize: 20, fontWeight: 800, color: "#166534" }}>{form.id ? "Edit Invoice" : "Add Invoice"}</h2>
            <div style={{ display: "grid", gap: 16 }}>
              {[
                ["Vendor name", "vendor", "text", "e.g. Engie"],
                ["Amount (€)", "amount", "number", "0.00"],
                ["Invoice number", "invoiceNo", "text", form.id ? "" : "Auto-generated if left empty"],
                ["Due date", "dueDate", "date", ""],
              ].map(([label, key, type, ph]) => (
                <div key={key}>
                  <label style={labelStyle}>{label}</label>
                  <input type={type} value={form[key] || ""} placeholder={ph}
                    onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
                    style={inputStyle} />
                </div>
              ))}
              <div>
                <label style={labelStyle}>Notes</label>
                <textarea value={form.notes || ""} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={3} style={{ ...inputStyle, resize: "none" }} />
              </div>
              <div>
                <label style={labelStyle}>Attachment (PDF / image)</label>
                <input ref={fileRef} type="file" accept=".pdf,image/*" onChange={handleFile} style={{ display: "none" }} />
                <button onClick={() => fileRef.current.click()} style={uploadBtnStyle}>
                  {form.file ? `📎 ${form.file.name}` : "Click to upload file"}
                </button>
              </div>
              <div>
                <label style={labelStyle}>Status</label>
                <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))} style={inputStyle}>
                  <option value="unpaid">Unpaid</option>
                  <option value="paid">Paid</option>
                </select>
              </div>
            </div>
            <div style={modalFooterStyle}>
              <button onClick={() => setForm(null)} style={cancelBtnStyle}>Cancel</button>
              <button onClick={saveForm} style={primaryBtnStyle}>{form.id ? "Save changes" : "Add invoice"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteId && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setDeleteId(null)}>
          <div className="modal-box" style={{ maxWidth: 400, textAlign: "center" }}>
            <p style={{ fontSize: 18, marginBottom: 24, color: "#166534" }}>Delete this invoice? This cannot be undone.</p>
            <div style={{ display: "flex", gap: 12 }}>
              <button onClick={() => setDeleteId(null)} style={cancelBtnStyle}>Cancel</button>
              <button onClick={confirmDelete} style={{ ...cancelBtnStyle, background: "rgba(252,165,165,0.1)", border: "1px solid rgba(252,165,165,0.3)", color: "#dc2626" }}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

const labelStyle = { fontSize: 14, color: "#4b5563", display: "block", marginBottom: 6, fontWeight: 600 };
const inputStyle = { width: "100%", background: "rgba(255,255,255,0.9)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: 12, padding: "12px 16px", color: "#166534", fontSize: 15, boxSizing: "border-box", transition: "all 0.2s ease" };
const uploadBtnStyle = { background: "rgba(255,255,255,0.9)", border: "2px dashed rgba(34,197,94,0.3)", borderRadius: 12, padding: "16px", color: "#16a34a", cursor: "pointer", fontSize: 14, width: "100%", fontWeight: 600 };
const modalFooterStyle = { display: "flex", gap: 12, marginTop: 24, flexWrap: "wrap" };
const cancelBtnStyle = { flex: 1, padding: "14px", background: "rgba(255,255,255,0.9)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: 12, color: "#64748b", cursor: "pointer", fontSize: 15, fontWeight: 600 };
const primaryBtnStyle = { flex: 2, padding: "14px", background: "linear-gradient(135deg, #16a34a, #22c55e)", border: "none", borderRadius: 12, color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 15, boxShadow: "0 4px 12px rgba(22,163,74,0.3)" };
