import { useState, useEffect, useRef } from "react";
import { apiFetch } from "../lib/api";
import { fmt, fmtDate, displayStatus, statusStyle } from "../lib/utils";

const STATUSES = { ALL: "all", UNPAID: "unpaid", PAID: "paid", OVERDUE: "overdue" };
const CATEGORIES = ["Utilities", "Rent", "Internet", "Insurance", "Subscriptions", "Other"];
const EMPTY_FORM = { id: null, vendor: "", amount: "", dueDate: "", invoiceNo: "", structuredMessage: "", notes: "", category: "", status: "unpaid", file: null };
const FIELDS = [["Vendor", "vendor"], ["Amount", "amount"], ["Due date", "dueDate"], ["Invoice #", "invoiceNo"], ["Structured msg", "structuredMessage"]];

const isPdfFile = (file) => {
  if (!file) return false;
  return file.type?.toLowerCase().includes("pdf") || file.name?.toLowerCase().endsWith(".pdf");
};

export default function InvoiceTracker({ invoices, setInvoices, apiEnabled, showToast }) {
  const [filter, setFilter] = useState(STATUSES.ALL);
  const [form, setForm] = useState(null);
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
    let s = text.replace(/[€$£ ]/g, "").trim();
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
    const numeric = text.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
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
        setInvoices((prev) => form.id ? prev.map((i) => i.id === form.id ? result : i) : [...prev, result]);
        showToast(form.id ? "Invoice updated" : "Invoice added");
        closeModal();
        return;
      }
    }

    if (form.id) {
      setInvoices((prev) => prev.map((i) => i.id === form.id ? { ...payload } : i));
    } else {
      setInvoices((prev) => [...prev, { ...payload, id: Date.now() }]);
    }
    showToast(form.id ? "Invoice updated" : "Invoice added");
    closeModal();
  };

  const togglePaid = async (id) => {
    const invoice = invoices.find((i) => i.id === id);
    if (!invoice) return;
    const updated = { ...invoice, status: invoice.status === "paid" ? "unpaid" : "paid" };
    if (apiEnabled) {
      const result = await apiFetch(`/api/invoices/${id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(updated),
      });
      if (result) { setInvoices((prev) => prev.map((i) => i.id === id ? result : i)); showToast("Status updated"); return; }
    }
    setInvoices((prev) => prev.map((i) => i.id === id ? updated : i));
    showToast("Status updated");
  };

  const confirmDelete = async () => {
    if (apiEnabled) await apiFetch(`/api/invoices/${deleteId}`, { method: "DELETE" });
    setInvoices((prev) => prev.filter((i) => i.id !== deleteId));
    setDeleteId(null);
    showToast("Invoice deleted", "danger");
  };

  const totalUnpaid = invoices.filter((i) => displayStatus(i) !== "paid").reduce((a, i) => a + parseFloat(i.amount || 0), 0);
  const totalPaid = invoices.filter((i) => i.status === "paid").reduce((a, i) => a + parseFloat(i.amount || 0), 0);
  const overdueCount = invoices.filter((i) => displayStatus(i) === "overdue").length;
  const filtered = invoices.filter((inv) => filter === STATUSES.ALL || displayStatus(inv) === filter);
  const isPdf = isPdfFile(form?.file);

  return (
    <>
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16, marginBottom: 32 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 28, fontWeight: 800, color: "#166534" }}>Invoice Tracker</h2>
          <p style={{ margin: "8px 0 0", color: "#64748b", fontSize: 16 }}>Track household bills, due dates, and payment status.</p>
        </div>
        <button onClick={openNew} style={{ background: "linear-gradient(135deg, #16a34a, #22c55e)", border: "none", color: "#fff", padding: "14px 24px", borderRadius: 16, fontSize: 15, fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 12px rgba(22,163,74,0.3)" }}>
          + Add Invoice
        </button>
      </div>

      {/* ── Stats ──────────────────────────────────────────────────────────── */}
      <div className="stats-grid-3" style={{ marginBottom: 32 }}>
        {[
          { label: "Total unpaid", value: fmt(totalUnpaid), color: "#16a34a" },
          { label: "Total paid", value: fmt(totalPaid), color: "#22c55e" },
          { label: "Overdue", value: overdueCount, color: "#dc2626" },
        ].map((s) => (
          <div key={s.label} style={{ background: "linear-gradient(135deg, #f0fdf4, #dcfce7)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: 20, padding: "24px", boxShadow: "0 4px 12px rgba(0,0,0,0.05)" }}>
            <p style={{ margin: 0, fontSize: 13, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 600 }}>{s.label}</p>
            <p style={{ margin: "8px 0 0", fontSize: 28, fontWeight: 800, color: s.color }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* ── Filters ────────────────────────────────────────────────────────── */}
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

      {/* ── Invoice list ───────────────────────────────────────────────────── */}
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {filtered.length === 0 && (
          <div style={{ textAlign: "center", color: "#64748b", padding: "48px 0", fontSize: 16 }}>No invoices found.</div>
        )}
        {filtered.map((inv) => {
          const s = statusStyle(displayStatus(inv));
          return (
            <div key={inv.id} style={{ background: "linear-gradient(135deg, #f8fafc, #f1f5f9)", border: "1px solid rgba(34,197,94,0.1)", borderRadius: 16, padding: "20px 24px", display: "flex", alignItems: "center", gap: 20, boxShadow: "0 2px 8px rgba(0,0,0,0.05)", flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                  <span style={{ fontWeight: 700, fontSize: 18, color: "#166534" }}>{inv.vendor}</span>
                  <span style={{ background: s.bg, color: s.color, fontSize: 12, fontWeight: 700, padding: "4px 12px", borderRadius: 20, textTransform: "uppercase", letterSpacing: 0.5 }}>{s.label}</span>
                  {inv.category && <span style={{ fontSize: 12, color: "#64748b", background: "rgba(100,116,139,0.1)", padding: "4px 10px", borderRadius: 20 }}>{inv.category}</span>}
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
                {inv.file && (
                  <button onClick={() => setViewInvoice(inv)} title="View document" style={{ background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.2)", color: "#3b82f6", borderRadius: 10, padding: "8px 12px", cursor: "pointer", fontSize: 14 }}>👁</button>
                )}
                <button onClick={() => openEdit(inv)} style={{ background: "rgba(255,255,255,0.8)", border: "1px solid rgba(34,197,94,0.1)", color: "#64748b", borderRadius: 10, padding: "8px 12px", cursor: "pointer", fontSize: 14 }}>✏️</button>
                <button onClick={() => setDeleteId(inv.id)} style={{ background: "rgba(252,165,165,0.1)", border: "1px solid rgba(252,165,165,0.2)", color: "#dc2626", borderRadius: 10, padding: "8px 12px", cursor: "pointer", fontSize: 14 }}>🗑</button>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Step 1: Upload popup ────────────────────────────────────────────── */}
      {form && step === "upload" && (
        <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && closeModal()}>
          <div className="modal-box" style={{ maxWidth: 480 }}>
            <h2 style={{ margin: "0 0 24px", fontSize: 20, fontWeight: 800, color: "#166534" }}>Add Invoice</h2>
            <input ref={fileRef} type="file" accept=".pdf,image/jpeg,image/png,image/webp" onChange={onFileInput} style={{ display: "none" }} />
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={onDrop}
              onClick={() => fileRef.current.click()}
              style={{
                border: `2px dashed ${isDragging ? "#16a34a" : "rgba(34,197,94,0.35)"}`,
                background: isDragging ? "rgba(220,252,231,0.6)" : "rgba(255,255,255,0.8)",
                borderRadius: 16, padding: "64px 24px", textAlign: "center", cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              <div style={{ fontSize: 56, marginBottom: 16, lineHeight: 1 }}>📄</div>
              <p style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "#166534" }}>Drop your invoice here</p>
              <p style={{ margin: "8px 0 0", fontSize: 14, color: "#64748b" }}>or click to browse</p>
              <p style={{ margin: "16px 0 0", fontSize: 12, color: "#94a3b8" }}>PDF · JPEG · PNG · WebP</p>
            </div>
            <div style={{ marginTop: 20, display: "flex", justifyContent: "flex-end" }}>
              <button onClick={closeModal} style={{ ...cancelBtnStyle, flex: "none", padding: "12px 28px" }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Step 2: Preview + form popup ───────────────────────────────────── */}
      {form && step === "edit" && (
        <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && closeModal()}>
          <div style={{
            background: "#f8fafc",
            borderRadius: 24,
            boxShadow: "0 24px 80px rgba(0,0,0,0.2)",
            width: "min(98vw, 1160px)",
            height: "min(94vh, 860px)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}>
            {/* Header */}
            <div style={{ padding: "18px 28px", borderBottom: "1px solid rgba(34,197,94,0.15)", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0, background: "rgba(255,255,255,0.8)" }}>
              <h2 style={{ margin: 0, fontSize: 19, fontWeight: 800, color: "#166534" }}>{form.id ? "Edit Invoice" : "Add Invoice"}</h2>
              <button onClick={closeModal} style={{ background: "none", border: "none", fontSize: 24, cursor: "pointer", color: "#94a3b8", lineHeight: 1, padding: "0 2px" }}>×</button>
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
                            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8", fontSize: 14 }}>
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
                              background: isSelected ? "rgba(22,163,74,0.35)" : "rgba(34,197,94,0)",
                              border: isSelected ? "2px solid #16a34a" : "1px solid transparent",
                              borderRadius: 2,
                              boxSizing: "border-box",
                              transition: "background 0.08s ease",
                              zIndex: 1,
                            }}
                            onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = "rgba(34,197,94,0.2)"; }}
                            onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = "rgba(34,197,94,0)"; }}
                          />
                        );
                      })}

                      {/* Hint when words are ready */}
                      {previewDims && docWords.length > 0 && !selectedWord && (
                        <div style={{ position: "absolute", bottom: 12, left: "50%", transform: "translateX(-50%)", background: "rgba(0,0,0,0.6)", color: "#fff", fontSize: 12, padding: "6px 14px", borderRadius: 20, pointerEvents: "none", whiteSpace: "nowrap" }}>
                          Click any value to assign it to a field
                        </div>
                      )}
                    </div>
                  </div>

                  {/* File bar */}
                  <div style={{ padding: "10px 16px", background: "rgba(0,0,0,0.3)", display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
                    <span style={{ flex: 1, fontSize: 12, color: "#94a3b8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>📎 {form.file.name}</span>
                    <input ref={fileRef} type="file" accept=".pdf,image/jpeg,image/png,image/webp" onChange={onFileInput} style={{ display: "none" }} />
                    <button onClick={() => fileRef.current.click()} style={{ fontSize: 12, color: "#22c55e", background: "none", border: "none", cursor: "pointer", fontWeight: 600, whiteSpace: "nowrap" }}>
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
                    style={{ border: "2px dashed rgba(34,197,94,0.4)", background: "transparent", borderRadius: 16, padding: "40px 48px", cursor: "pointer", textAlign: "center" }}
                  >
                    <div style={{ fontSize: 44, marginBottom: 12 }}>📄</div>
                    <p style={{ margin: 0, color: "#e2e8f0", fontWeight: 700, fontSize: 15 }}>Attach a document</p>
                    <p style={{ margin: "6px 0 0", color: "#64748b", fontSize: 13 }}>PDF · JPEG · PNG · WebP</p>
                  </button>
                </div>
              )}

              {/* ── Right: field assignment + form ── */}
              <div className="invoice-modal-form">

                {/* Selected word → field assignment */}
                {selectedWord ? (
                  <div style={{ padding: "16px", background: "linear-gradient(135deg, #dcfce7, #bbf7d0)", border: "1.5px solid #16a34a", borderRadius: 14 }}>
                    <p style={{ margin: "0 0 4px", fontSize: 11, fontWeight: 700, color: "#166534", textTransform: "uppercase", letterSpacing: 0.5 }}>Assign to field</p>
                    <p style={{ margin: "0 0 12px", fontSize: 15, fontWeight: 600, color: "#14532d", wordBreak: "break-all" }}>"{selectedWord.text}"</p>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                      {FIELDS.map(([label, field]) => {
                        const filled = form[field] !== "" && form[field] !== null && form[field] !== undefined;
                        return (
                          <button key={field} onClick={() => fillField(field, selectedWord.text)} style={filled ? {
                            padding: "8px 16px", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer",
                            background: "rgba(220,252,231,0.9)", border: "1.5px solid #16a34a", color: "#166534",
                            boxShadow: "none",
                          } : {
                            padding: "8px 16px", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer",
                            background: "linear-gradient(135deg, #16a34a, #22c55e)", border: "none", color: "#fff",
                            boxShadow: "0 2px 8px rgba(22,163,74,0.3)",
                          }}>
                            {filled ? "✓" : "→"} {label}
                          </button>
                        );
                      })}
                      <button onClick={() => setSelectedWord(null)}
                        style={{ padding: "8px 14px", borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: "pointer", background: "rgba(255,255,255,0.8)", border: "1px solid rgba(34,197,94,0.3)", color: "#64748b" }}>
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : docWords.length > 0 ? (
                  <p style={{ margin: 0, fontSize: 13, color: "#94a3b8", textAlign: "center", padding: "8px 0" }}>← Click a value in the document</p>
                ) : pdfLoading ? (
                  <p style={{ margin: 0, fontSize: 13, color: "#94a3b8", textAlign: "center", padding: "8px 0" }}>Reading document…</p>
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
            <div style={{ padding: "14px 28px", borderTop: "1px solid rgba(34,197,94,0.15)", display: "flex", gap: 12, flexShrink: 0, background: "rgba(255,255,255,0.8)" }}>
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
        const s = statusStyle(displayStatus(inv));
        return (
          <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && setViewInvoice(null)}>
            <div style={{
              background: "#f8fafc", borderRadius: 24, boxShadow: "0 24px 80px rgba(0,0,0,0.2)",
              width: "min(98vw, 1000px)", height: "min(96vh, 920px)",
              display: "flex", flexDirection: "column", overflow: "hidden",
            }}>
              {/* Header */}
              <div style={{ padding: "16px 24px", borderBottom: "1px solid rgba(34,197,94,0.15)", display: "flex", alignItems: "center", gap: 16, flexShrink: 0, background: "rgba(255,255,255,0.9)" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <span style={{ fontWeight: 800, fontSize: 17, color: "#166534" }}>{inv.vendor}</span>
                    <span style={{ background: s.bg, color: s.color, fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20, textTransform: "uppercase", letterSpacing: 0.5 }}>{s.label}</span>
                    {inv.category && <span style={{ fontSize: 11, color: "#64748b", background: "rgba(100,116,139,0.1)", padding: "3px 8px", borderRadius: 20 }}>{inv.category}</span>}
                  </div>
                  <div style={{ display: "flex", gap: 20, marginTop: 4, fontSize: 13, color: "#64748b", flexWrap: "wrap" }}>
                    <span>#{inv.invoiceNo || "—"}</span>
                    <span>Due: {fmtDate(inv.dueDate)}</span>
                    <span style={{ fontWeight: 700, color: "#166534" }}>{fmt(inv.amount)}</span>
                    {inv.structuredMessage && <span>📋 {inv.structuredMessage}</span>}
                  </div>
                </div>
                <button onClick={() => setViewInvoice(null)} style={{ background: "none", border: "none", fontSize: 24, cursor: "pointer", color: "#94a3b8", lineHeight: 1, flexShrink: 0 }}>×</button>
              </div>

              {/* PDF / image */}
              {src ? (
                isPdfFile(inv.file) ? (
                  <iframe
                    src={src}
                    title={inv.file.name}
                    style={{ flex: 1, border: "none", background: "#1e293b" }}
                  />
                ) : (
                  <div style={{ flex: 1, overflow: "auto", background: "#1e293b", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
                    <img src={src} alt={inv.file.name} style={{ maxWidth: "100%", maxHeight: "100%", borderRadius: 8, objectFit: "contain" }} />
                  </div>
                )
              ) : (
                <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8", fontSize: 15 }}>
                  File not available for preview
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* ── Delete confirmation ─────────────────────────────────────────────── */}
      {deleteId && (
        <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && setDeleteId(null)}>
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

const labelStyle = { fontSize: 13, color: "#4b5563", display: "block", marginBottom: 5, fontWeight: 600 };
const inputStyle = { width: "100%", background: "rgba(255,255,255,0.9)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: 10, padding: "10px 14px", color: "#166534", fontSize: 14, boxSizing: "border-box", transition: "all 0.2s ease" };
const inputStyleFilled = { ...inputStyle, background: "rgba(220,252,231,0.7)", border: "1.5px solid #16a34a" };
const fieldStyle = (value) => (value !== "" && value !== null && value !== undefined) ? inputStyleFilled : inputStyle;
const cancelBtnStyle = { flex: 1, padding: "13px", background: "rgba(255,255,255,0.9)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: 12, color: "#64748b", cursor: "pointer", fontSize: 15, fontWeight: 600 };
const primaryBtnStyle = { flex: 2, padding: "13px", background: "linear-gradient(135deg, #16a34a, #22c55e)", border: "none", borderRadius: 12, color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 15, boxShadow: "0 4px 12px rgba(22,163,74,0.3)" };
