import { useState, useEffect, useMemo, useRef } from "react";
import { apiFetch } from "../lib/api";

const CATEGORIES = [
  { id: "shopping",    feature: "shopping", label: "Shopping item" },
  { id: "invoice",     feature: "invoices", label: "Invoice" },
  { id: "maintenance", feature: "maintenance", label: "Maintenance task" },
  { id: "plant",       feature: "plants", label: "Plant" },
];

const FREQUENCIES = ["daily", "weekly", "biweekly", "monthly", "quarterly", "yearly"];

const overlay = {
  position: "fixed", inset: 0,
  background: "rgba(31,42,36,0.35)",
  backdropFilter: "blur(4px)",
  WebkitBackdropFilter: "blur(4px)",
  zIndex: 1000,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 16,
};

const modal = {
  background: "var(--g-card)",
  borderRadius: 20,
  boxShadow: "0 8px 40px rgba(31,42,36,0.18)",
  width: "100%",
  maxWidth: 440,
  padding: 28,
  fontFamily: "var(--g-sans)",
};

const inputStyle = {
  background: "var(--g-bg)",
  border: "1px solid var(--g-hair)",
  borderRadius: 10,
  padding: "10px 13px",
  fontSize: 14,
  fontFamily: "var(--g-sans)",
  color: "var(--g-ink)",
  outline: "none",
  width: "100%",
  boxSizing: "border-box",
};

const labelStyle = {
  fontSize: 12,
  color: "var(--g-muted)",
  fontWeight: 600,
  display: "block",
  marginBottom: 5,
};

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={labelStyle}>{label}</label>
      {children}
    </div>
  );
}

export default function QuickAddModal({
  onClose,
  shopping, setShopping,
  setInvoices,
  setMaintenance,
  setPlants,
  apiEnabled,
  queueMutation,
  showToast,
  enabledFeatures = {},
}) {
  const availableCategories = useMemo(
    () => CATEGORIES.filter(c => enabledFeatures[c.feature] !== false),
    [enabledFeatures]
  );
  const [category, setCategory] = useState("shopping");
  const [saving, setSaving] = useState(false);

  const [shoppingName, setShoppingName] = useState("");
  const [shoppingStore, setShoppingStore] = useState("");

  const [invoiceVendor, setInvoiceVendor] = useState("");
  const [invoiceAmount, setInvoiceAmount] = useState("");
  const [invoiceDueDate, setInvoiceDueDate] = useState("");
  const [invoiceStatus, setInvoiceStatus] = useState("unpaid");

  const [maintTitle, setMaintTitle] = useState("");
  const [maintFrequency, setMaintFrequency] = useState("monthly");
  const [maintNextDue, setMaintNextDue] = useState(new Date().toISOString().slice(0, 10));

  const [plantName, setPlantName] = useState("");
  const [plantWater, setPlantWater] = useState("weekly");

  const firstRef = useRef();

  useEffect(() => {
    const raf = requestAnimationFrame(() => firstRef.current?.focus());
    return () => cancelAnimationFrame(raf);
  }, [category]);

  useEffect(() => {
    if (availableCategories.length && !availableCategories.some(c => c.id === category)) {
      setCategory(availableCategories[0].id);
    }
  }, [availableCategories, category]);

  useEffect(() => {
    if (shopping.stores?.length) {
      setShoppingStore(shopping.stores[0].id);
    }
  }, [shopping.stores]);

  const handleKeyDown = (e) => {
    if (e.key === "Escape") onClose();
  };

  const canSave = () => {
    if (category === "shopping") return shoppingName.trim() && shoppingStore;
    if (category === "invoice")  return invoiceVendor.trim() && invoiceAmount;
    if (category === "maintenance") return maintTitle.trim();
    if (category === "plant") return plantName.trim();
    return false;
  };

  const handleSave = async () => {
    if (!canSave() || saving) return;
    setSaving(true);
    try {
      if (category === "shopping") {
        const store = shopping.stores.find(s => s.id === shoppingStore) || shopping.stores[0];
        const newItem = { id: Date.now(), storeId: store.id, name: shoppingName.trim(), checked: false };
        setShopping(s => ({ ...s, items: [...s.items, newItem] }));
        if (apiEnabled) {
          try {
            const d = await apiFetch("/api/shopping/items", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ storeId: store.id, name: shoppingName.trim() }),
            });
            if (d) setShopping(s => ({ ...s, items: s.items.map(i => i.id === newItem.id ? d : i) }));
          } catch {
            setShopping(s => ({ ...s, items: s.items.filter(i => i.id !== newItem.id) }));
          }
        } else {
          queueMutation?.({ method: "POST", endpoint: "/api/shopping/items", body: { storeId: store.id, name: shoppingName.trim() }, resource: "shopping", tempId: newItem.id });
        }
        showToast("Item added to shopping list");
      }

      if (category === "invoice") {
        const newInvoice = {
          id: Date.now(),
          vendor: invoiceVendor.trim(),
          amount: parseFloat(invoiceAmount),
          dueDate: invoiceDueDate || null,
          invoiceNo: "",
          notes: "",
          status: invoiceStatus,
          file: null,
        };
        setInvoices(prev => [...prev, newInvoice]);
        if (apiEnabled) {
          try {
            const d = await apiFetch("/api/invoices", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(newInvoice),
            });
            if (d) setInvoices(prev => prev.map(i => i.id === newInvoice.id ? d : i));
          } catch {
            setInvoices(prev => prev.filter(i => i.id !== newInvoice.id));
          }
        } else {
          queueMutation?.({ method: "POST", endpoint: "/api/invoices", body: newInvoice, resource: "invoices", tempId: newInvoice.id });
        }
        showToast("Invoice added");
      }

      if (category === "maintenance") {
        const newTask = {
          id: Date.now(),
          title: maintTitle.trim(),
          frequency: maintFrequency,
          nextDue: maintNextDue,
          instructions: "",
          photo: null,
          completed: false,
        };
        setMaintenance(prev => [...prev, newTask]);
        if (apiEnabled) {
          try {
            const d = await apiFetch("/api/maintenance", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(newTask),
            });
            if (d) setMaintenance(prev => prev.map(t => t.id === newTask.id ? d : t));
          } catch {
            setMaintenance(prev => prev.filter(t => t.id !== newTask.id));
          }
        } else {
          queueMutation?.({ method: "POST", endpoint: "/api/maintenance", body: newTask, resource: "maintenance", tempId: newTask.id });
        }
        showToast("Maintenance task added");
      }

      if (category === "plant") {
        const newPlant = {
          id: Date.now(),
          name: plantName.trim(),
          wateringFrequency: plantWater,
          lastWatered: "",
          feedingFrequency: "monthly",
          lastFed: "",
          notes: "",
        };
        setPlants(prev => [...prev, newPlant]);
        if (apiEnabled) {
          try {
            const d = await apiFetch("/api/plants", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(newPlant),
            });
            if (d) setPlants(prev => prev.map(p => p.id === newPlant.id ? d : p));
          } catch {
            setPlants(prev => prev.filter(p => p.id !== newPlant.id));
          }
        } else {
          queueMutation?.({ method: "POST", endpoint: "/api/plants", body: newPlant, resource: "plants", tempId: newPlant.id });
        }
        showToast("Plant added");
      }

      onClose();
    } finally {
      setSaving(false);
    }
  };

  if (availableCategories.length === 0) return null;

  return (
    <div style={overlay} onClick={e => { if (e.target === e.currentTarget) onClose(); }} onKeyDown={handleKeyDown}>
      <div style={modal} role="dialog" aria-modal="true">
        <h2 style={{ margin: "0 0 20px", fontSize: 18, fontWeight: 700, color: "var(--g-ink)", fontFamily: "var(--g-sans)" }}>
          Quick add
        </h2>

        {/* Category pills */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 22 }}>
          {availableCategories.map(c => (
            <button
              key={c.id}
              onClick={() => setCategory(c.id)}
              style={{
                all: "unset", cursor: "pointer",
                padding: "6px 14px",
                borderRadius: 20,
                fontSize: 13,
                fontWeight: 600,
                fontFamily: "var(--g-sans)",
                background: category === c.id ? "var(--g-sage)" : "var(--g-bg)",
                color: category === c.id ? "#fff" : "var(--g-ink2)",
                border: `1px solid ${category === c.id ? "var(--g-sage)" : "var(--g-hair)"}`,
                transition: "all 0.12s",
              }}
            >
              {c.label}
            </button>
          ))}
        </div>

        {/* Shopping */}
        {category === "shopping" && (
          <>
            <Field label="Item name">
              <input
                ref={firstRef}
                style={inputStyle}
                placeholder="e.g. Milk"
                value={shoppingName}
                onChange={e => setShoppingName(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleSave()}
              />
            </Field>
            <Field label="Store">
              {shopping.stores?.length ? (
                <select
                  style={inputStyle}
                  value={shoppingStore}
                  onChange={e => setShoppingStore(e.target.value)}
                >
                  {shopping.stores.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              ) : (
                <p style={{ margin: 0, fontSize: 13, color: "var(--g-muted)" }}>
                  No stores yet — add a store in the Shopping module first.
                </p>
              )}
            </Field>
          </>
        )}

        {/* Invoice */}
        {category === "invoice" && (
          <>
            <Field label="Vendor">
              <input
                ref={firstRef}
                style={inputStyle}
                placeholder="e.g. Engie"
                value={invoiceVendor}
                onChange={e => setInvoiceVendor(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleSave()}
              />
            </Field>
            <Field label="Amount (€)">
              <input
                style={inputStyle}
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={invoiceAmount}
                onChange={e => setInvoiceAmount(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleSave()}
              />
            </Field>
            <Field label="Due date">
              <input
                style={inputStyle}
                type="date"
                value={invoiceDueDate}
                onChange={e => setInvoiceDueDate(e.target.value)}
              />
            </Field>
            <Field label="Status">
              <select style={inputStyle} value={invoiceStatus} onChange={e => setInvoiceStatus(e.target.value)}>
                <option value="unpaid">Unpaid</option>
                <option value="paid">Paid</option>
              </select>
            </Field>
          </>
        )}

        {/* Maintenance */}
        {category === "maintenance" && (
          <>
            <Field label="Task title">
              <input
                ref={firstRef}
                style={inputStyle}
                placeholder="e.g. Clean gutters"
                value={maintTitle}
                onChange={e => setMaintTitle(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleSave()}
              />
            </Field>
            <Field label="Frequency">
              <select style={inputStyle} value={maintFrequency} onChange={e => setMaintFrequency(e.target.value)}>
                {FREQUENCIES.map(f => (
                  <option key={f} value={f}>{f.charAt(0).toUpperCase() + f.slice(1)}</option>
                ))}
              </select>
            </Field>
            <Field label="Next due">
              <input
                style={inputStyle}
                type="date"
                value={maintNextDue}
                onChange={e => setMaintNextDue(e.target.value)}
              />
            </Field>
          </>
        )}

        {/* Plant */}
        {category === "plant" && (
          <>
            <Field label="Plant name">
              <input
                ref={firstRef}
                style={inputStyle}
                placeholder="e.g. Monstera"
                value={plantName}
                onChange={e => setPlantName(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleSave()}
              />
            </Field>
            <Field label="Watering frequency">
              <select style={inputStyle} value={plantWater} onChange={e => setPlantWater(e.target.value)}>
                {FREQUENCIES.map(f => (
                  <option key={f} value={f}>{f.charAt(0).toUpperCase() + f.slice(1)}</option>
                ))}
              </select>
            </Field>
          </>
        )}

        {/* Actions */}
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
          <button
            onClick={onClose}
            style={{
              all: "unset", cursor: "pointer",
              padding: "10px 20px",
              background: "var(--g-bg)",
              color: "var(--g-ink2)",
              border: "1px solid var(--g-hair)",
              borderRadius: 10,
              fontSize: 14,
              fontWeight: 600,
              fontFamily: "var(--g-sans)",
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!canSave() || saving}
            style={{
              all: "unset", cursor: canSave() && !saving ? "pointer" : "default",
              padding: "10px 20px",
              background: canSave() && !saving ? "var(--g-sage)" : "var(--g-mute2)",
              color: "#fff",
              borderRadius: 10,
              fontSize: 14,
              fontWeight: 600,
              fontFamily: "var(--g-sans)",
              boxShadow: canSave() ? "0 4px 12px rgba(90,122,94,0.25)" : "none",
              transition: "background 0.12s",
            }}
          >
            {saving ? "Saving…" : "Add"}
          </button>
        </div>
      </div>
    </div>
  );
}
