import { useState, useEffect, useRef } from "react";
import { apiFetch } from "../lib/api";
import { fmt, fmtDate, displayStatus } from "../lib/utils";

const STATUSES = { ALL: "all", UNPAID: "unpaid", PAID: "paid", OVERDUE: "overdue" };
const CATEGORIES = ["Utilities", "Rent", "Internet", "Insurance", "Subscriptions", "Other"];
const EMPTY_FORM = { id: null, vendor: "", amount: "", dueDate: "", invoiceNo: "", structuredMessage: "", notes: "", category: "", status: "unpaid", file: null };
const EMPTY_RECURRING = { vendor: "", amount: "", category: "Subscriptions", frequency: "monthly", dayOfMonth: new Date().getDate(), nextDueDate: new Date().toISOString().slice(0, 10), notes: "", active: true };
const FIELDS = [["Vendor", "vendor"], ["Amount", "amount"], ["Due date", "dueDate"], ["Invoice #", "invoiceNo"], ["Structured msg", "structuredMessage"]];

const isPdfFile = (file) => {
  if (!file) return false;
  return file.type?.toLowerCase().includes("pdf") || file.name?.toLowerCase().endsWith(".pdf");
};

// Map displayStatus → Garden color tokens
const gardenStatusStyle = (status) => {
  switch (status) {
    case "overdue":  return { bg: "var(--g-brick-bg)", color: "var(--g-brick)", label: "Overdue" };
    case "paid":     return { bg: "var(--g-hair2)", color: "var(--g-muted)", label: "Paid" };
    case "due soon": return { bg: "var(--g-honey-bg)", color: "var(--g-honey)", label: "Due soon" };
    default:         return { bg: "var(--g-sky-bg)", color: "var(--g-sky)", label: "Unpaid" };
  }
};

// Icon square bg by status
const iconBg = (status) => {
  switch (status) {
    case "overdue":  return "var(--g-brick-bg)";
    case "paid":     return "var(--g-hair2)";
    case "due soon": return "var(--g-honey-bg)";
    default:         return "var(--g-sky-bg)";
  }
};

const iconColor = (status) => {
  switch (status) {
    case "overdue":  return "var(--g-brick)";
    case "paid":     return "var(--g-muted)";
    case "due soon": return "var(--g-honey)";
    default:         return "var(--g-sky)";
  }
};

export default function InvoiceTracker({ invoices, setInvoices, recurringInvoices = [], setRecurringInvoices, apiEnabled, queueMutation, showToast }) {
  const [view, setView] = useState("invoices");
  const [filter, setFilter] = useState(STATUSES.ALL);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState(null);
  const [recurringForm, setRecurringForm] = useState(null);
  const [step, setStep] = useState(null); // 'upload' | 'edit'
  const [isDragging, setIsDragging] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [viewInvoice, setViewInvoice] = useState(null);

  // Interactive document state
  const [docWords, setDocWords] = useState([]);   // [{text,left,top,width,height}] in full-res space
  const [previewDims, setPreviewDims] = useState(null); // {width,height} of full-res render
  const [selectedWord, setSelectedWord] = useState(null);
  const [pdfLoading, setPdfLoading] = useState(false);

  const fileRef = useRef();
  const canvasRef = useRef();

  // Escape to close
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      if (selectedWord) { setSelectedWord(null); return; }
      if (form) closeModal();
      else if (deleteId) setDeleteId(null);
      else if (viewInvoice) setViewInvoice(null);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [form, deleteId, selectedWord, viewInvoice]);

  // Render PDF to canvas and extract word positions when a PDF file is loaded
  useEffect(() => {
    if (!form?.file?.data || !isPdfFile(form.file) || step !== "edit") return;

    let cancelled = false;
    setPdfLoading(true);
    setDocWords([]);
    setSelectedWord(null);
    setPreviewDims(null);

    (async () => {
      // Dynamic import keeps this out of the main bundle
      const pdfjs = await import("pdfjs-dist");
      if (!pdfjs.GlobalWorkerOptions.workerSrc) {
        pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
      }

      // Decode base64 data URL to bytes
      const base64 = form.file.data.split(",")[1];
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

      const pdf = await pdfjs.getDocument({ data: bytes }).promise;
      const page = await pdf.getPage(1);

      // Scale so the rendered canvas is ~1400px wide for sharp text
      const natural = page.getViewport({ scale: 1 });
      const scale = 1400 / natural.width;
      const viewport = page.getViewport({ scale });

      if (cancelled) return;

      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width = viewport.width;
      canvas.height = viewport.height;

      await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;

      if (cancelled) return;
      setPreviewDims({ width: viewport.width, height: viewport.height });

      // Extract text items with bounding boxes
      const textContent = await page.getTextContent();
      const words = [];
      for (const item of textContent.items) {
        if (!item.str || !item.str.trim() || item.width <= 0) continue;
        const tx = pdfjs.Util.transform(viewport.transform, item.transform);
        // item.width / item.height are in PDF user-space units; multiply by
        // viewport.scale to convert to canvas pixels.
        const pixelW = Math.max(item.width * scale, 4);
        const pixelH = item.height > 0 ? Math.max(item.height * scale, 8) : 12;
        words.push({
          text: item.str.trim(),
          left: tx[4],
          top: tx[5] - pixelH, // tx[5] is baseline in canvas-px; subtract height to get top
          width: pixelW,
          height: pixelH,
        });
      }

      if (!cancelled) {
        setDocWords(words);
        setPdfLoading(false);
      }
    })().catch((err) => {
      console.error("PDF render error:", err);
      if (!cancelled) setPdfLoading(false);
    });

    return () => { cancelled = true; };
  }, [form?.file, step]);

  const openNew = () => {
    setForm({ ...EMPTY_FORM });
    setStep("upload");
    setDocWords([]);
    setSelectedWord(null);
    setPreviewDims(null);
  };

  const openEdit = (inv) => {
    setForm({ ...inv });
    setStep("edit");
    setDocWords([]);
    setSelectedWord(null);
    setPreviewDims(null);
  };

  const closeModal = () => {
    setForm(null);
    setStep(null);
    setDocWords([]);
    setSelectedWord(null);
    setPreviewDims(null);
    setPdfLoading(false);
  };

  const handleFile = async (f) => {
    if (!f) return;

    const dataUrl = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.readAsDataURL(f);
    });

    setDocWords([]);
    setSelectedWord(null);
    setPreviewDims(null);
    setForm((p) => ({ ...p, file: { name: f.name, data: dataUrl, type: f.type }, _file: f }));
    setStep("edit");

    // For images: fetch word bboxes from backend OCR
    if (f.type !== "application/pdf" && apiEnabled) {
      try {
        const fd = new FormData();
        fd.append("file", f);
        const result = await apiFetch("/api/ocr", { method: "POST", body: fd });
        if (result?.words) {
          setDocWords(
            result.words.map((w) => ({
              text: w.text,
              left: w.x0,
              top: w.y0,
              width: w.x1 - w.x0,
              height: Math.max(w.y1 - w.y0, 8),
            }))
          );
        }
      } catch { /* non-fatal */ }
    }
    // PDF word extraction happens in the useEffect above once the canvas mounts
  };

  const onFileInput = (e) => { handleFile(e.target.files[0]); e.target.value = ""; };
  const onDrop = (e) => { e.preventDefault(); setIsDragging(false); handleFile(e.dataTransfer.files[0]); };

  const parseAmount = (text) => {
    let s = text.replace(/[€$£ ]/g, "").trim();
    if (s.includes(".") && s.includes(",")) {
      // Both separators: whichever comes last is the decimal separator
      if (s.lastIndexOf(",") > s.lastIndexOf(".")) {
        s = s.replace(/\./g, "").replace(",", "."); // 1.234,56 → 1234.56
      } else {
        s = s.replace(/,/g, ""); // 1,234.56 → 1234.56
      }
    } else if (s.includes(",")) {
      // Comma only: decimal if followed by ≤2 digits at end, else thousands
      s = /,\d{1,2}$/.test(s) ? s.replace(",", ".") : s.replace(/,/g, "");
    }
    const match = s.match(/\d+(\.\d+)?/);
    if (!match) return text;
    const n = parseFloat(match[0]);
    return isNaN(n) ? text : String(n);
  };

  const parseDate = (text) => {
    const MONTHS = {
      jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
      jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
    };
    if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
    // DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY
    const numeric = text.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/);
    if (numeric) {
      const [, d, m, y] = numeric;
      return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
    }
    // "15 April 2026" or "15 Apr 2026"
    const wordDMY = text.match(/(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/);
    if (wordDMY) {
      const [, d, mon, y] = wordDMY;
      const m = MONTHS[mon.slice(0, 3).toLowerCase()];
      if (m) return `${y}-${m}-${d.padStart(2, "0")}`;
    }
    // "April 15, 2026" or "Apr 15 2026"
    const wordMDY = text.match(/([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})/);
    if (wordMDY) {
      const [, mon, d, y] = wordMDY;
      const m = MONTHS[mon.slice(0, 3).toLowerCase()];
      if (m) return `${y}-${m}-${d.padStart(2, "0")}`;
    }
    return text;
  };

  const parseStructuredMessage = (text) => {
    // Full delimited format: +++XXX/XXXX/XXXXX+++ or ***XXX/XXXX/XXXXX***
    const full = text.match(/[+*]{3}(\d{3})\/(\d{4})\/(\d{5})[+*]{3}/);
    if (full) return `+++${full[1]}/${full[2]}/${full[3]}+++`;
    // Slashed digits without delimiters: 123/4567/89012
    const slashed = text.match(/(\d{3})\/(\d{4})\/(\d{5})/);
    if (slashed) return `+++${slashed[1]}/${slashed[2]}/${slashed[3]}+++`;
    // 12 bare digits anywhere in the text (strips labels like "Mededeling: 123456789012")
    const digits = text.replace(/\D/g, "");
    if (digits.length === 12) return `+++${digits.slice(0, 3)}/${digits.slice(3, 7)}/${digits.slice(7)}+++`;
    return text;
  };

  const fillField = (field, value) => {
    let parsed = value;
    if (field === "amount") parsed = parseAmount(value);
    else if (field === "dueDate") parsed = parseDate(value);
    else if (field === "structuredMessage") parsed = parseStructuredMessage(value);
    setForm((p) => ({ ...p, [field]: parsed }));
    setSelectedWord(null);
  };

  const saveForm = async () => {
    if (!form.vendor.trim() || !form.amount) return;
    const { _file, ...payload } = form;

    if (apiEnabled) {
      try {
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
        setInvoices((prev) => form.id ? prev.map((i) => i.id === form.id ? result : i) : [...prev, result]);
        showToast(form.id ? "Invoice updated" : "Invoice added");
        closeModal();
        return;
      } catch (err) {
        showToast(err.message || "Request failed", "danger");
        return;
      }
    }

    if (form.id) {
      setInvoices((prev) => prev.map((i) => i.id === form.id ? { ...payload } : i));
      if (!_file) queueMutation?.({ method: "PUT", endpoint: `/api/invoices/${form.id}`, body: payload, resource: "invoices", tempId: form.id });
    } else {
      const local = { ...payload, id: Date.now() };
      setInvoices((prev) => [...prev, local]);
      if (!_file) queueMutation?.({ method: "POST", endpoint: "/api/invoices", body: local, resource: "invoices", tempId: local.id });
    }
    showToast(form.id ? "Invoice updated" : "Invoice added");
    closeModal();
  };

  const togglePaid = async (id) => {
    const invoice = invoices.find((i) => i.id === id);
    if (!invoice) return;
    const updated = { ...invoice, status: invoice.status === "paid" ? "unpaid" : "paid" };
    if (apiEnabled) {
      try {
        const result = await apiFetch(`/api/invoices/${id}`, {
          method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(updated),
        });
        setInvoices((prev) => prev.map((i) => i.id === id ? result : i));
        showToast("Status updated");
        return;
      } catch (err) {
        showToast(err.message || "Update failed", "danger");
        return;
      }
    }
    setInvoices((prev) => prev.map((i) => i.id === id ? updated : i));
    queueMutation?.({ method: "PUT", endpoint: `/api/invoices/${id}`, body: updated, resource: "invoices", tempId: id });
    showToast("Status updated");
  };

  const confirmDelete = async () => {
    if (apiEnabled) {
      try {
        await apiFetch(`/api/invoices/${deleteId}`, { method: "DELETE" });
      } catch (err) {
        showToast(err.message || "Delete failed", "danger");
        setDeleteId(null);
        return;
      }
    }
    setInvoices((prev) => prev.filter((i) => i.id !== deleteId));
    queueMutation?.({ method: "DELETE", endpoint: `/api/invoices/${deleteId}`, resource: "invoices", tempId: deleteId });
    setDeleteId(null);
    showToast("Invoice deleted", "danger");
  };

  const saveRecurring = async () => {
    if (!recurringForm?.vendor?.trim() || !recurringForm?.amount) return showToast("Vendor and amount required", "danger");
    const payload = { ...recurringForm, amount: Number(recurringForm.amount), dayOfMonth: Number(recurringForm.dayOfMonth || 1) };
    if (apiEnabled) {
      try {
        const method = payload.id ? "PUT" : "POST";
        const endpoint = payload.id ? `/api/recurring-invoices/${payload.id}` : "/api/recurring-invoices";
        const result = await apiFetch(endpoint, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        setRecurringInvoices(prev => payload.id ? prev.map(t => t.id === payload.id ? result : t) : [...prev, result]);
        setRecurringForm(null);
        showToast(payload.id ? "Template updated" : "Template added");
        return;
      } catch (err) {
        showToast(err.message || "Failed to save template", "danger");
        return;
      }
    }
    if (payload.id) {
      setRecurringInvoices(prev => prev.map(t => t.id === payload.id ? payload : t));
      queueMutation?.({ method: "PUT", endpoint: `/api/recurring-invoices/${payload.id}`, body: payload, resource: "recurringInvoices", tempId: payload.id });
    } else {
      const local = { ...payload, id: Date.now() };
      setRecurringInvoices(prev => [...prev, local]);
      queueMutation?.({ method: "POST", endpoint: "/api/recurring-invoices", body: local, resource: "recurringInvoices", tempId: local.id });
    }
    setRecurringForm(null);
    showToast(payload.id ? "Template updated" : "Template added");
  };

  const deleteRecurring = async (id) => {
    if (apiEnabled) {
      try { await apiFetch(`/api/recurring-invoices/${id}`, { method: "DELETE" }); }
      catch (err) { showToast(err.message || "Delete failed", "danger"); return; }
    }
    setRecurringInvoices(prev => prev.filter(t => t.id !== id));
    queueMutation?.({ method: "DELETE", endpoint: `/api/recurring-invoices/${id}`, resource: "recurringInvoices", tempId: id });
    showToast("Template deleted", "danger");
  };

  const generateRecurring = async (template) => {
    if (!apiEnabled) return showToast("Recurring generation requires the backend", "danger");
    try {
      const result = await apiFetch(`/api/recurring-invoices/${template.id}/generate`, { method: "POST" });
      if (result?.invoice) {
        setInvoices(prev => prev.some(i => i.id === result.invoice.id) ? prev : [...prev, result.invoice]);
      }
      if (result?.template) setRecurringInvoices(prev => prev.map(t => t.id === template.id ? result.template : t));
      showToast(result?.skipped ? "Invoice already exists for this period" : "Invoice generated");
    } catch (err) {
      showToast(err.message || "Generation failed", "danger");
    }
  };

  const totalUnpaid = invoices.filter((i) => displayStatus(i) !== "paid").reduce((a, i) => a + parseFloat(i.amount || 0), 0);
  const avgMonthly = invoices.length > 0
    ? invoices.reduce((a, i) => a + parseFloat(i.amount || 0), 0) / Math.max(1, new Set(invoices.map(i => (i.dueDate || "").slice(0, 7))).size)
    : 0;
  const ytdTotal = (() => {
    const year = new Date().getFullYear();
    return invoices.filter(i => (i.dueDate || "").startsWith(String(year))).reduce((a, i) => a + parseFloat(i.amount || 0), 0);
  })();

  const q = search.trim().toLowerCase();
  const filtered = invoices
    .filter((inv) => filter === STATUSES.ALL || displayStatus(inv) === filter)
    .filter((inv) => !q || [inv.vendor, inv.notes, inv.invoiceNo, inv.category].some(f => f?.toLowerCase().includes(q)));
  const isPdf = isPdfFile(form?.file);

  return (
    <div className="page" style={{ display: "flex", flexDirection: "column", gap: 24 }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
        <div>
          <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: "var(--g-sage)", textTransform: "uppercase", letterSpacing: 1 }}>Bills &amp; subscriptions</p>
          <h1 style={{ margin: "4px 0 0", fontSize: 44, fontWeight: 400, color: "var(--g-ink)", fontFamily: "var(--g-serif)", lineHeight: 1.1 }}>Invoice Tracker</h1>
        </div>
        <button onClick={openNew} style={{
          background: "var(--g-sage-bg)", border: "none", color: "var(--g-sage-dark)",
          padding: "12px 22px", borderRadius: 12, fontSize: 14, fontWeight: 600,
          cursor: "pointer", fontFamily: "var(--g-sans)", marginTop: 8,
        }}>
          + New invoice
        </button>
      </div>

      {/* ── Stats row ──────────────────────────────────────────────────────── */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {[["Invoices", "invoices"], ["Recurring", "recurring"]].map(([label, val]) => (
          <button key={val} onClick={() => setView(val)} style={{
            padding: "8px 18px", borderRadius: 999,
            border: view === val ? "1.5px solid var(--g-sage)" : "1.5px solid var(--g-hair)",
            background: view === val ? "var(--g-sage-bg)" : "var(--g-card)",
            color: view === val ? "var(--g-sage-dark)" : "var(--g-muted)",
            fontSize: 13.5, fontWeight: 600, cursor: "pointer", fontFamily: "var(--g-sans)",
          }}>{label}</button>
        ))}
      </div>

      {view === "invoices" && (
        <>
      <div className="stats-grid-3">
        {[
          { label: "Outstanding", value: fmt(totalUnpaid), underline: "var(--g-brick)" },
          { label: "Avg monthly", value: fmt(avgMonthly), underline: "var(--g-honey)" },
          { label: "YTD total", value: fmt(ytdTotal), underline: "var(--g-sage)" },
        ].map((s) => (
          <div key={s.label} style={{ background: "var(--g-card)", borderRadius: 16, padding: "24px", boxShadow: "var(--g-shadow-sm)", position: "relative", overflow: "hidden" }}>
            <p style={{ margin: 0, fontSize: 12, color: "var(--g-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, fontFamily: "var(--g-sans)" }}>{s.label}</p>
            <p style={{ margin: "10px 0 0", fontSize: 30, fontWeight: 400, color: "var(--g-ink)", fontFamily: "var(--g-serif)", lineHeight: 1 }}>{s.value}</p>
            <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 3, background: s.underline }} />
          </div>
        ))}
      </div>

      {/* ── Filters + Search ───────────────────────────────────────────────── */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        {[["All", STATUSES.ALL], ["Unpaid", STATUSES.UNPAID], ["Paid", STATUSES.PAID], ["Overdue", STATUSES.OVERDUE]].map(([label, val]) => (
          <button key={val} onClick={() => { setFilter(val); setSearch(""); }} style={{
            padding: "8px 18px", borderRadius: 999,
            border: filter === val ? "1.5px solid var(--g-sage)" : "1.5px solid var(--g-hair)",
            background: filter === val ? "var(--g-sage-bg)" : "transparent",
            color: filter === val ? "var(--g-sage-dark)" : "var(--g-muted)",
            fontSize: 13.5, fontWeight: 600, cursor: "pointer", fontFamily: "var(--g-sans)",
            transition: "all 0.15s ease",
          }}>{label}</button>
        ))}
        <div style={{ marginLeft: "auto", position: "relative", display: "flex", alignItems: "center" }}>
          <svg style={{ position: "absolute", left: 12, pointerEvents: "none", color: "var(--g-mute2)" }} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input
            type="search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search vendor, notes…"
            style={{
              background: "var(--g-card)",
              border: "1px solid var(--g-hair)",
              borderRadius: 12,
              padding: "9px 14px 9px 34px",
              color: "var(--g-ink)",
              fontSize: 13.5,
              minWidth: 200,
              outline: "none",
              fontFamily: "var(--g-sans)",
            }}
          />
        </div>
      </div>

      {/* ── Invoice list ───────────────────────────────────────────────────── */}
      <div style={{ background: "var(--g-card)", borderRadius: 16, boxShadow: "var(--g-shadow-sm)", overflow: "hidden" }}>
        {filtered.length === 0 && (
          <div style={{ textAlign: "center", color: "var(--g-muted)", padding: "48px 0", fontSize: 15, fontFamily: "var(--g-sans)" }}>No invoices found.</div>
        )}
        {filtered.map((inv, idx) => {
          const status = displayStatus(inv);
          const s = gardenStatusStyle(status);
          const isOverdue = status === "overdue";
          return (
            <div key={inv.id} style={{
              display: "flex", alignItems: "center", gap: 16, padding: "16px 24px", flexWrap: "wrap",
              borderTop: idx === 0 ? "none" : "1px solid var(--g-hair2)",
            }}>
              {/* Status icon square */}
              <div style={{
                width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                background: iconBg(status),
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={iconColor(status)} strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                </svg>
              </div>

              {/* Name + meta */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontWeight: 700, fontSize: 15, color: "var(--g-ink)", fontFamily: "var(--g-sans)" }}>{inv.vendor}</span>
                  <span style={{
                    background: s.bg, color: s.color,
                    fontSize: 11.5, fontWeight: 600, padding: "3px 10px", borderRadius: 999,
                    fontFamily: "var(--g-sans)",
                  }}>{s.label}</span>
                  {inv.category && (
                    <span style={{ fontSize: 12, color: "var(--g-muted)", fontFamily: "var(--g-sans)" }}>{inv.category}</span>
                  )}
                </div>
                <div style={{ display: "flex", gap: 16, marginTop: 4, fontSize: 13, color: "var(--g-muted)", flexWrap: "wrap", fontFamily: "var(--g-sans)" }}>
                  {inv.invoiceNo && <span>#{inv.invoiceNo}</span>}
                  <span>Due {fmtDate(inv.dueDate)}</span>
                  {inv.notes && <span>{inv.notes}</span>}
                </div>
              </div>

              {/* Amount */}
              <div style={{ fontSize: 22, fontWeight: 400, color: "var(--g-ink)", fontFamily: "var(--g-serif)", minWidth: 80, textAlign: "right" }}>
                {fmt(inv.amount)}
              </div>

              {/* Actions */}
              <div style={{ display: "flex", gap: 8, flexShrink: 0, flexWrap: "wrap" }}>
                <button
                  onClick={() => togglePaid(inv.id)}
                  title={inv.status === "paid" ? "Mark unpaid" : "Mark paid"}
                  style={{
                    background: isOverdue ? "var(--g-sage)" : "var(--g-sage-bg)",
                    border: "none",
                    color: isOverdue ? "#fff" : "var(--g-sage-dark)",
                    borderRadius: 10, padding: "7px 14px", cursor: "pointer",
                    fontSize: 13, fontWeight: 600, fontFamily: "var(--g-sans)",
                  }}
                >
                  {inv.status === "paid" ? "Paid ✓" : "Mark paid"}
                </button>
                {inv.file && (
                  <button onClick={() => setViewInvoice(inv)} title="View document" style={iconBtnStyle}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  </button>
                )}
                <button onClick={() => openEdit(inv)} title="Edit" style={iconBtnStyle}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                </button>
                <button onClick={() => setDeleteId(inv.id)} title="Delete" style={{ ...iconBtnStyle, color: "var(--g-brick)" }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Step 1: Upload popup ────────────────────────────────────────────── */}
        </>
      )}

      {view === "recurring" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <h3 style={{ margin: 0, fontSize: 20, fontWeight: 400, fontFamily: "var(--g-serif)", color: "var(--g-ink)" }}>Recurring templates</h3>
            <button onClick={() => setRecurringForm({ ...EMPTY_RECURRING })} style={primaryBtnStyle}>+ New template</button>
          </div>
          <div style={{ background: "var(--g-card)", borderRadius: 16, boxShadow: "var(--g-shadow-sm)", overflow: "hidden" }}>
            {recurringInvoices.length === 0 ? (
              <div style={{ textAlign: "center", color: "var(--g-muted)", padding: "48px 0", fontSize: 15, fontFamily: "var(--g-sans)" }}>No recurring templates yet.</div>
            ) : recurringInvoices.map((t, idx) => {
              const due = t.nextDueDate && t.nextDueDate <= new Date().toISOString().slice(0, 10);
              return (
                <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 16, padding: "16px 24px", flexWrap: "wrap", borderTop: idx === 0 ? "none" : "1px solid var(--g-hair2)" }}>
                  <div style={{ flex: 1, minWidth: 180 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <strong style={{ color: "var(--g-ink)", fontFamily: "var(--g-sans)" }}>{t.vendor}</strong>
                      <span style={{ background: due ? "var(--g-honey-bg)" : "var(--g-sage-bg)", color: due ? "var(--g-honey)" : "var(--g-sage-dark)", fontSize: 11.5, fontWeight: 600, padding: "3px 10px", borderRadius: 999, fontFamily: "var(--g-sans)" }}>{due ? "Due" : "Scheduled"}</span>
                      {t.active === false && <span style={{ color: "var(--g-muted)", fontSize: 12 }}>Inactive</span>}
                    </div>
                    <div style={{ marginTop: 4, color: "var(--g-muted)", fontSize: 13, fontFamily: "var(--g-sans)" }}>
                      {t.frequency} - next due {fmtDate(t.nextDueDate)} - {t.category}
                    </div>
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 400, color: "var(--g-ink)", fontFamily: "var(--g-serif)", minWidth: 80, textAlign: "right" }}>{fmt(t.amount)}</div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button onClick={() => generateRecurring(t)} style={due ? primaryBtnStyle : cancelBtnStyle}>Generate</button>
                    <button onClick={() => setRecurringForm({ ...t })} style={iconBtnStyle}>Edit</button>
                    <button onClick={() => deleteRecurring(t.id)} style={{ ...iconBtnStyle, color: "var(--g-brick)" }}>Delete</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {form && step === "upload" && (
        <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && closeModal()}>
          <div className="modal-box" style={{ maxWidth: 480 }}>
            <h2 style={{ margin: "0 0 24px", fontSize: 22, fontWeight: 400, color: "var(--g-ink)", fontFamily: "var(--g-serif)" }}>Add Invoice</h2>
            <input ref={fileRef} type="file" accept=".pdf,image/jpeg,image/png,image/webp" onChange={onFileInput} style={{ display: "none" }} />
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={onDrop}
              onClick={() => fileRef.current.click()}
              style={{
                border: `2px dashed ${isDragging ? "var(--g-sage)" : "var(--g-hair)"}`,
                background: isDragging ? "var(--g-sage-bg)" : "var(--g-bg)",
                borderRadius: 20, padding: "64px 24px", textAlign: "center", cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              <div style={{ fontSize: 48, marginBottom: 16, lineHeight: 1 }}>📄</div>
              <p style={{ margin: 0, fontSize: 16, fontWeight: 600, color: "var(--g-ink)", fontFamily: "var(--g-sans)" }}>Drop your invoice here</p>
              <p style={{ margin: "8px 0 0", fontSize: 14, color: "var(--g-muted)", fontFamily: "var(--g-sans)" }}>or click to browse</p>
              <p style={{ margin: "14px 0 0", fontSize: 12, color: "var(--g-mute2)", fontFamily: "var(--g-sans)" }}>PDF · JPEG · PNG · WebP</p>
            </div>
            <div style={{ marginTop: 20, display: "flex", justifyContent: "flex-end" }}>
              <button onClick={closeModal} style={cancelBtnStyle}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Step 2: Preview + form popup ───────────────────────────────────── */}
      {form && step === "edit" && (
        <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && closeModal()}>
          <div style={{
            background: "var(--g-bg)",
            borderRadius: 20,
            boxShadow: "0 24px 80px rgba(0,0,0,0.18)",
            width: "min(98vw, 1160px)",
            height: "min(94vh, 860px)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}>
            {/* Header */}
            <div style={{
              padding: "16px 24px", borderBottom: "1px solid var(--g-hair)",
              display: "flex", alignItems: "center", justifyContent: "space-between",
              flexShrink: 0, background: "var(--g-card)",
            }}>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 400, color: "var(--g-ink)", fontFamily: "var(--g-serif)" }}>
                {form.id ? "Edit Invoice" : "Add Invoice"}
              </h2>
              <button onClick={closeModal} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: "var(--g-mute2)", lineHeight: 1, padding: "0 2px" }}>×</button>
            </div>

            {/* Body */}
            <div className="invoice-modal-body">

              {/* ── Left: document preview ── */}
              {form.file?.data ? (
                <div className="invoice-modal-doc">
                  {/* Scrollable preview area */}
                  <div style={{ flex: 1, overflow: "auto", position: "relative", display: "flex", alignItems: "flex-start", justifyContent: "center" }}>
                    <div style={{ position: "relative", display: "inline-block", minWidth: "100%" }}>
                      {isPdf ? (
                        <>
                          {pdfLoading && (
                            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--g-muted)", fontSize: 14, fontFamily: "var(--g-sans)" }}>
                              Rendering…
                            </div>
                          )}
                          <canvas
                            ref={canvasRef}
                            style={{ display: "block", width: "100%", height: "auto" }}
                          />
                        </>
                      ) : (
                        <img
                          src={form.file.data}
                          alt="Invoice"
                          onLoad={(e) => setPreviewDims({ width: e.target.naturalWidth, height: e.target.naturalHeight })}
                          style={{ display: "block", width: "100%", height: "auto" }}
                        />
                      )}

                      {/* Word hit-boxes — percentage-positioned so they scale with the image/canvas */}
                      {previewDims && docWords.map((word, i) => {
                        const isSelected = selectedWord === word;
                        return (
                          <div
                            key={i}
                            onClick={() => setSelectedWord(isSelected ? null : word)}
                            title={word.text}
                            style={{
                              position: "absolute",
                              left: `${(word.left / previewDims.width) * 100}%`,
                              top: `${(word.top / previewDims.height) * 100}%`,
                              width: `${(word.width / previewDims.width) * 100}%`,
                              height: `${(word.height / previewDims.height) * 100}%`,
                              cursor: "pointer",
                              background: isSelected ? "rgba(90,122,94,0.32)" : "rgba(90,122,94,0)",
                              border: isSelected ? "2px solid var(--g-sage)" : "1px solid transparent",
                              borderRadius: 2,
                              boxSizing: "border-box",
                              transition: "background 0.08s ease",
                              zIndex: 1,
                            }}
                            onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = "rgba(90,122,94,0.18)"; }}
                            onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = "rgba(90,122,94,0)"; }}
                          />
                        );
                      })}

                      {/* Hint when words are ready */}
                      {previewDims && docWords.length > 0 && !selectedWord && (
                        <div style={{ position: "absolute", bottom: 12, left: "50%", transform: "translateX(-50%)", background: "rgba(31,42,36,0.72)", color: "#fff", fontSize: 12, padding: "6px 14px", borderRadius: 20, pointerEvents: "none", whiteSpace: "nowrap", fontFamily: "var(--g-sans)" }}>
                          Click any value to assign it to a field
                        </div>
                      )}
                    </div>
                  </div>

                  {/* File bar */}
                  <div style={{ padding: "10px 16px", background: "rgba(31,42,36,0.55)", display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
                    <span style={{ flex: 1, fontSize: 12, color: "var(--g-mute2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontFamily: "var(--g-sans)" }}>📎 {form.file.name}</span>
                    <input ref={fileRef} type="file" accept=".pdf,image/jpeg,image/png,image/webp" onChange={onFileInput} style={{ display: "none" }} />
                    <button onClick={() => fileRef.current.click()} style={{ fontSize: 12, color: "var(--g-sage-bg)", background: "none", border: "none", cursor: "pointer", fontWeight: 600, whiteSpace: "nowrap", fontFamily: "var(--g-sans)" }}>
                      Change file
                    </button>
                  </div>
                </div>
              ) : (
                /* No file yet — show upload prompt in left panel */
                <div className="invoice-modal-doc" style={{ alignItems: "center", justifyContent: "center", gap: 12 }}>
                  <input ref={fileRef} type="file" accept=".pdf,image/jpeg,image/png,image/webp" onChange={onFileInput} style={{ display: "none" }} />
                  <button
                    onClick={() => fileRef.current.click()}
                    style={{
                      border: "2px dashed var(--g-hair)", background: "transparent",
                      borderRadius: 20, padding: "40px 48px", cursor: "pointer", textAlign: "center",
                    }}
                  >
                    <div style={{ fontSize: 44, marginBottom: 12 }}>📄</div>
                    <p style={{ margin: 0, color: "var(--g-bg)", fontWeight: 600, fontSize: 15, fontFamily: "var(--g-sans)" }}>Attach a document</p>
                    <p style={{ margin: "6px 0 0", color: "var(--g-muted)", fontSize: 13, fontFamily: "var(--g-sans)" }}>PDF · JPEG · PNG · WebP</p>
                  </button>
                </div>
              )}

              {/* ── Right: field assignment + form ── */}
              <div className="invoice-modal-form">

                {/* Selected word → field assignment */}
                {selectedWord ? (
                  <div style={{ padding: "14px 16px", background: "var(--g-sage-bg)", border: "1.5px solid var(--g-sage)", borderRadius: 12 }}>
                    <p style={{ margin: "0 0 4px", fontSize: 11, fontWeight: 700, color: "var(--g-sage-dark)", textTransform: "uppercase", letterSpacing: 0.5, fontFamily: "var(--g-sans)" }}>Assign to field</p>
                    <p style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 600, color: "var(--g-ink)", wordBreak: "break-all", fontFamily: "var(--g-sans)" }}>"{selectedWord.text}"</p>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                      {FIELDS.map(([label, field]) => {
                        const filled = form[field] !== "" && form[field] !== null && form[field] !== undefined;
                        return (
                          <button key={field} onClick={() => fillField(field, selectedWord.text)} style={filled ? {
                            padding: "7px 14px", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer",
                            background: "var(--g-card)", border: "1.5px solid var(--g-sage)", color: "var(--g-sage-dark)",
                            fontFamily: "var(--g-sans)",
                          } : {
                            padding: "7px 14px", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer",
                            background: "var(--g-sage)", border: "none", color: "#fff",
                            fontFamily: "var(--g-sans)",
                          }}>
                            {filled ? "✓" : "→"} {label}
                          </button>
                        );
                      })}
                      <button onClick={() => setSelectedWord(null)}
                        style={{ padding: "7px 14px", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", background: "var(--g-card)", border: "1px solid var(--g-hair)", color: "var(--g-muted)", fontFamily: "var(--g-sans)" }}>
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : docWords.length > 0 ? (
                  <p style={{ margin: 0, fontSize: 13, color: "var(--g-muted)", textAlign: "center", padding: "8px 0", fontFamily: "var(--g-sans)" }}>← Click a value in the document</p>
                ) : pdfLoading ? (
                  <p style={{ margin: 0, fontSize: 13, color: "var(--g-muted)", textAlign: "center", padding: "8px 0", fontFamily: "var(--g-sans)" }}>Reading document…</p>
                ) : null}

                {/* Form fields */}
                <div style={{ display: "grid", gap: 12 }}>
                  {[
                    ["Vendor name", "vendor", "text", "e.g. Engie"],
                    ["Amount (€)", "amount", "number", "0.00"],
                    ["Invoice number", "invoiceNo", "text", form.id ? "" : "Auto-generated if left empty"],
                    ["Due date", "dueDate", "date", ""],
                    ["Structured message", "structuredMessage", "text", "+++XXX/XXXX/XXXXX+++"],
                  ].map(([label, key, type, ph]) => (
                    <div key={key}>
                      <label style={labelStyle}>{label}</label>
                      <input type={type} value={form[key] || ""} placeholder={ph}
                        onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))}
                        style={fieldStyle(form[key])} />
                    </div>
                  ))}
                  <div>
                    <label style={labelStyle}>Category</label>
                    <select value={form.category || ""} onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))} style={fieldStyle(form.category)}>
                      <option value="">Select a category</option>
                      {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Notes</label>
                    <textarea value={form.notes || ""} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} rows={3} style={{ ...fieldStyle(form.notes), resize: "none" }} />
                  </div>
                  <div>
                    <label style={labelStyle}>Status</label>
                    <select value={form.status} onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))} style={fieldStyle(form.status)}>
                      <option value="unpaid">Unpaid</option>
                      <option value="paid">Paid</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div style={{ padding: "14px 24px", borderTop: "1px solid var(--g-hair)", display: "flex", gap: 12, flexShrink: 0, background: "var(--g-card)" }}>
              <button onClick={closeModal} style={cancelBtnStyle}>Cancel</button>
              <button onClick={saveForm} style={primaryBtnStyle}>{form.id ? "Save changes" : "Add invoice"}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Document viewer ────────────────────────────────────────────────── */}
      {viewInvoice && (() => {
        const src = viewInvoice.file?.path || viewInvoice.file?.data || null;
        const inv = viewInvoice;
        const s = gardenStatusStyle(displayStatus(inv));
        return (
          <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && setViewInvoice(null)}>
            <div style={{
              background: "var(--g-bg)", borderRadius: 20, boxShadow: "0 24px 80px rgba(0,0,0,0.18)",
              width: "min(98vw, 1000px)", height: "min(96vh, 920px)",
              display: "flex", flexDirection: "column", overflow: "hidden",
            }}>
              {/* Header */}
              <div style={{ padding: "16px 24px", borderBottom: "1px solid var(--g-hair)", display: "flex", alignItems: "center", gap: 16, flexShrink: 0, background: "var(--g-card)" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontWeight: 700, fontSize: 16, color: "var(--g-ink)", fontFamily: "var(--g-sans)" }}>{inv.vendor}</span>
                    <span style={{ background: s.bg, color: s.color, fontSize: 11.5, fontWeight: 600, padding: "3px 10px", borderRadius: 999, fontFamily: "var(--g-sans)" }}>{s.label}</span>
                    {inv.category && <span style={{ fontSize: 12, color: "var(--g-muted)", fontFamily: "var(--g-sans)" }}>{inv.category}</span>}
                  </div>
                  <div style={{ display: "flex", gap: 20, marginTop: 4, fontSize: 13, color: "var(--g-muted)", flexWrap: "wrap", fontFamily: "var(--g-sans)" }}>
                    {inv.invoiceNo && <span>#{inv.invoiceNo}</span>}
                    <span>Due: {fmtDate(inv.dueDate)}</span>
                    <span style={{ fontWeight: 400, fontFamily: "var(--g-serif)", fontSize: 16, color: "var(--g-ink)" }}>{fmt(inv.amount)}</span>
                    {inv.structuredMessage && <span>{inv.structuredMessage}</span>}
                  </div>
                </div>
                <button onClick={() => setViewInvoice(null)} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: "var(--g-mute2)", lineHeight: 1, flexShrink: 0 }}>×</button>
              </div>

              {/* PDF / image */}
              {src ? (
                isPdfFile(inv.file) ? (
                  <iframe
                    src={src}
                    title={inv.file.name}
                    style={{ flex: 1, border: "none", background: "var(--g-ink2)" }}
                  />
                ) : (
                  <div style={{ flex: 1, overflow: "auto", background: "var(--g-ink2)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
                    <img src={src} alt={inv.file.name} style={{ maxWidth: "100%", maxHeight: "100%", borderRadius: 8, objectFit: "contain" }} />
                  </div>
                )
              ) : (
                <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--g-muted)", fontSize: 15, fontFamily: "var(--g-sans)" }}>
                  File not available for preview
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* ── Delete confirmation ─────────────────────────────────────────────── */}
      {recurringForm && (
        <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && setRecurringForm(null)}>
          <div className="modal-box" style={{ maxWidth: 520 }}>
            <h3 style={{ margin: "0 0 20px", fontSize: 24, fontWeight: 400, fontFamily: "var(--g-serif)", color: "var(--g-ink)" }}>{recurringForm.id ? "Edit template" : "New recurring template"}</h3>
            <div style={{ display: "grid", gap: 12 }}>
              {[["Vendor", "vendor", "text"], ["Amount", "amount", "number"], ["Next due date", "nextDueDate", "date"], ["Day of month", "dayOfMonth", "number"]].map(([label, key, type]) => (
                <div key={key}>
                  <label style={labelStyle}>{label}</label>
                  <input type={type} value={recurringForm[key] || ""} onChange={e => setRecurringForm(f => ({ ...f, [key]: e.target.value }))} style={fieldStyle(recurringForm[key])} />
                </div>
              ))}
              <div>
                <label style={labelStyle}>Category</label>
                <select value={recurringForm.category || "Subscriptions"} onChange={e => setRecurringForm(f => ({ ...f, category: e.target.value }))} style={fieldStyle(recurringForm.category)}>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Frequency</label>
                <select value={recurringForm.frequency || "monthly"} onChange={e => setRecurringForm(f => ({ ...f, frequency: e.target.value }))} style={fieldStyle(recurringForm.frequency)}>
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="yearly">Yearly</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>Notes</label>
                <textarea value={recurringForm.notes || ""} onChange={e => setRecurringForm(f => ({ ...f, notes: e.target.value }))} rows={3} style={{ ...fieldStyle(recurringForm.notes), resize: "none" }} />
              </div>
              <label style={{ display: "flex", alignItems: "center", gap: 10, color: "var(--g-ink2)", fontFamily: "var(--g-sans)", fontSize: 14 }}>
                <input type="checkbox" checked={recurringForm.active !== false} onChange={e => setRecurringForm(f => ({ ...f, active: e.target.checked }))} />
                Active
              </label>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <button onClick={saveRecurring} style={primaryBtnStyle}>Save</button>
              <button onClick={() => setRecurringForm(null)} style={cancelBtnStyle}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {deleteId && (
        <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && setDeleteId(null)}>
          <div className="modal-box" style={{ maxWidth: 400, textAlign: "center" }}>
            <p style={{ fontSize: 17, marginBottom: 24, color: "var(--g-ink)", fontFamily: "var(--g-sans)" }}>Delete this invoice? This cannot be undone.</p>
            <div style={{ display: "flex", gap: 12 }}>
              <button onClick={() => setDeleteId(null)} style={cancelBtnStyle}>Cancel</button>
              <button onClick={confirmDelete} style={{ ...cancelBtnStyle, background: "var(--g-brick-bg)", border: "1px solid var(--g-brick)", color: "var(--g-brick)" }}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const labelStyle = {
  fontSize: 12, color: "var(--g-muted)", display: "block", marginBottom: 5,
  fontWeight: 600, fontFamily: "var(--g-sans)", textTransform: "uppercase", letterSpacing: 0.4,
};
const inputStyle = {
  width: "100%", background: "var(--g-card)", border: "1px solid var(--g-hair)",
  borderRadius: 10, padding: "10px 14px", color: "var(--g-ink)", fontSize: 14,
  boxSizing: "border-box", transition: "border-color 0.15s ease", fontFamily: "var(--g-sans)",
  outline: "none",
};
const inputStyleFilled = {
  ...inputStyle,
  background: "var(--g-sage-bg)", border: "1.5px solid var(--g-sage)",
};
const fieldStyle = (value) => (value !== "" && value !== null && value !== undefined) ? inputStyleFilled : inputStyle;
const cancelBtnStyle = {
  flex: 1, padding: "12px", background: "var(--g-card)", border: "1px solid var(--g-hair)",
  borderRadius: 10, color: "var(--g-muted)", cursor: "pointer", fontSize: 14,
  fontWeight: 600, fontFamily: "var(--g-sans)",
};
const primaryBtnStyle = {
  flex: 2, padding: "12px", background: "var(--g-sage)", border: "none",
  borderRadius: 10, color: "#fff", fontWeight: 700, cursor: "pointer",
  fontSize: 14, fontFamily: "var(--g-sans)",
};
const iconBtnStyle = {
  background: "var(--g-hair2)", border: "1px solid var(--g-hair)", color: "var(--g-muted)",
  borderRadius: 8, padding: "8px 10px", cursor: "pointer", display: "flex",
  alignItems: "center", justifyContent: "center",
};
