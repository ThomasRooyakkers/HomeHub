import { useState, useRef } from "react";
import { apiFetch } from "../lib/api";

const CATEGORIES = ["Fruits & Veggies", "Meat & Fish", "Dairy & Eggs", "Bakery", "Frozen", "Drinks", "Snacks", "Pantry", "Cleaning", "Personal Care", "Other"];

const inputStyle = {
  background: "rgba(255,255,255,0.95)", border: "1px solid rgba(0,0,0,0.12)",
  borderRadius: 12, padding: "11px 14px", fontSize: 15, fontFamily: "inherit", color: "#111827",
};
const labelStyle = { fontSize: 14, color: "#4b5563", display: "block", marginBottom: 6, fontWeight: 600 };
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

export default function ShoppingList({ shopping, setShopping, apiEnabled, showToast }) {
  const { stores = [], items = [] } = shopping;
  const [activeStoreId, setActiveStoreId] = useState(stores[0]?.id ?? null);
  const [quickAdd, setQuickAdd] = useState("");
  const [quickCat, setQuickCat] = useState("Other");
  const [storeModal, setStoreModal] = useState(null);
  const [deleteStoreId, setDeleteStoreId] = useState(null);
  const quickRef = useRef();

  const activeStore = stores.find(s => s.id === activeStoreId) || stores[0] || null;
  const storeItems = items.filter(i => i.storeId === activeStore?.id);
  const unchecked = storeItems.filter(i => !i.checked);
  const checked   = storeItems.filter(i => i.checked);

  const grouped = CATEGORIES.reduce((acc, cat) => {
    const its = unchecked.filter(i => i.category === cat);
    if (its.length) acc[cat] = its;
    return acc;
  }, {});
  const uncategorised = unchecked.filter(i => !CATEGORIES.includes(i.category));
  if (uncategorised.length) grouped["Other"] = [...(grouped["Other"] || []), ...uncategorised];

  const persist = async (path, method, body, optimisticFn) => {
    const prev = { ...shopping };
    if (optimisticFn) setShopping(optimisticFn);
    if (!apiEnabled) return;
    try {
      await apiFetch(path, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    } catch {
      setShopping(prev);
      showToast("Failed to save", "danger");
    }
  };

  const toggleItem = async (item) => {
    const updated = { ...item, checked: !item.checked };
    setShopping(s => ({ ...s, items: s.items.map(i => i.id === item.id ? updated : i) }));
    if (!apiEnabled) return;
    try {
      await apiFetch(`/api/shopping/items/${item.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checked: updated.checked }),
      });
    } catch {
      setShopping(s => ({ ...s, items: s.items.map(i => i.id === item.id ? item : i) }));
    }
  };

  const addItem = async () => {
    if (!quickAdd.trim() || !activeStore) return;
    const name = quickAdd.trim();
    const newItem = { id: Date.now(), storeId: activeStore.id, name, category: quickCat, checked: false };
    setShopping(s => ({ ...s, items: [...s.items, newItem] }));
    setQuickAdd("");
    quickRef.current?.focus();
    if (!apiEnabled) return;
    try {
      const d = await apiFetch("/api/shopping/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storeId: activeStore.id, name, category: quickCat }),
      });
      if (d) setShopping(s => ({ ...s, items: s.items.map(i => i.id === newItem.id ? d : i) }));
    } catch {
      setShopping(s => ({ ...s, items: s.items.filter(i => i.id !== newItem.id) }));
    }
  };

  const deleteItem = async (item) => {
    setShopping(s => ({ ...s, items: s.items.filter(i => i.id !== item.id) }));
    if (!apiEnabled) return;
    try { await apiFetch(`/api/shopping/items/${item.id}`, { method: "DELETE" }); } catch {}
  };

  const clearChecked = async () => {
    setShopping(s => ({ ...s, items: s.items.filter(i => !i.checked || i.storeId !== activeStore?.id) }));
    if (!apiEnabled) return;
    try { await apiFetch(`/api/shopping/items/checked?storeId=${activeStore?.id}`, { method: "DELETE" }); } catch {}
  };

  const saveStore = async () => {
    if (!storeModal?.name?.trim()) return showToast("Store name required", "danger");
    if (storeModal.id) {
      // edit
      setShopping(s => ({ ...s, stores: s.stores.map(st => st.id === storeModal.id ? { ...st, ...storeModal } : st) }));
      setStoreModal(null);
      if (!apiEnabled) return;
      try {
        await apiFetch(`/api/shopping/stores/${storeModal.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: storeModal.name, color: storeModal.color }),
        });
      } catch { showToast("Failed to save", "danger"); }
    } else {
      // add
      const tmp = { id: Date.now(), name: storeModal.name, color: storeModal.color || "#16a34a" };
      setShopping(s => ({ ...s, stores: [...s.stores, tmp] }));
      setActiveStoreId(tmp.id);
      setStoreModal(null);
      if (!apiEnabled) return;
      try {
        const d = await apiFetch("/api/shopping/stores", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: storeModal.name, color: storeModal.color || "#16a34a" }),
        });
        if (d) {
          setShopping(s => ({ ...s, stores: s.stores.map(st => st.id === tmp.id ? d : st) }));
          setActiveStoreId(d.id);
        }
      } catch { showToast("Failed to save store", "danger"); }
    }
  };

  const confirmDeleteStore = async () => {
    setShopping(s => ({
      stores: s.stores.filter(st => st.id !== deleteStoreId),
      items: s.items.filter(i => i.storeId !== deleteStoreId),
    }));
    if (activeStoreId === deleteStoreId) setActiveStoreId(stores.find(s => s.id !== deleteStoreId)?.id || null);
    setDeleteStoreId(null);
    if (!apiEnabled) return;
    try { await apiFetch(`/api/shopping/stores/${deleteStoreId}`, { method: "DELETE" }); } catch {}
  };

  void persist; // suppress lint — persist used inline in some paths

  return (
    <div style={{ maxWidth: 680, margin: "0 auto", padding: "28px 20px" }}>
      <h2 style={{ margin: "0 0 20px", fontSize: 26, fontWeight: 800, color: "#111827" }}>🛒 Shopping List</h2>

      {/* Store tabs */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 24, alignItems: "center" }}>
        {stores.map(s => (
          <button
            key={s.id}
            onClick={() => setActiveStoreId(s.id)}
            onDoubleClick={() => setStoreModal({ ...s })}
            title="Double-click to edit"
            style={{
              padding: "8px 18px", borderRadius: 20, border: "none", cursor: "pointer",
              fontFamily: "inherit", fontWeight: 700, fontSize: 14,
              background: activeStoreId === s.id ? (s.color || "var(--accent, #16a34a)") : "#f1f5f9",
              color: activeStoreId === s.id ? "#fff" : "#374151",
              transition: "all 0.15s",
            }}
          >{s.name}</button>
        ))}
        <button
          onClick={() => setStoreModal({ name: "", color: "#16a34a" })}
          style={{ padding: "8px 14px", borderRadius: 20, border: "2px dashed #d1d5db", background: "transparent", color: "#9ca3af", cursor: "pointer", fontWeight: 600, fontSize: 14, fontFamily: "inherit" }}
        >+ Store</button>
      </div>

      {stores.length === 0 && (
        <div style={{ textAlign: "center", padding: "60px 20px", color: "#9ca3af" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🛒</div>
          <p style={{ margin: 0, fontSize: 16 }}>Add a store to get started</p>
        </div>
      )}

      {activeStore && (
        <>
          {/* Quick-add bar */}
          <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
            <input
              ref={quickRef}
              style={{ ...inputStyle, flex: 1 }}
              placeholder={`Add item to ${activeStore.name}…`}
              value={quickAdd}
              onChange={e => setQuickAdd(e.target.value)}
              onKeyDown={e => e.key === "Enter" && addItem()}
            />
            <select
              style={{ ...inputStyle, width: 160 }}
              value={quickCat}
              onChange={e => setQuickCat(e.target.value)}
            >
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <button style={{ ...btnPrimary, padding: "11px 18px" }} onClick={addItem}>Add</button>
          </div>

          {/* Grouped items */}
          {Object.entries(grouped).map(([cat, its]) => (
            <div key={cat} style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>{cat}</div>
              {its.map(item => <ItemRow key={item.id} item={item} onToggle={toggleItem} onDelete={deleteItem} />)}
            </div>
          ))}

          {unchecked.length === 0 && checked.length === 0 && (
            <p style={{ color: "#9ca3af", textAlign: "center", padding: "32px 0", margin: 0 }}>No items yet. Add one above!</p>
          )}

          {/* Checked items */}
          {checked.length > 0 && (
            <div style={{ marginTop: 24, borderTop: "1px dashed #e5e7eb", paddingTop: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <span style={{ fontSize: 13, color: "#9ca3af", fontWeight: 600 }}>In cart ({checked.length})</span>
                <button
                  onClick={clearChecked}
                  style={{ fontSize: 13, color: "#dc2626", background: "none", border: "none", cursor: "pointer", fontWeight: 600, fontFamily: "inherit" }}
                >Clear all</button>
              </div>
              {checked.map(item => <ItemRow key={item.id} item={item} onToggle={toggleItem} onDelete={deleteItem} />)}
            </div>
          )}

          {/* Store actions */}
          <div style={{ display: "flex", gap: 8, marginTop: 32, paddingTop: 16, borderTop: "1px solid #e5e7eb" }}>
            <button style={btnSecondary} onClick={() => setStoreModal({ ...activeStore })}>Edit Store</button>
            <button
              onClick={() => setDeleteStoreId(activeStore.id)}
              style={{ padding: "10px 20px", background: "rgba(252,165,165,0.12)", color: "#dc2626", border: "1px solid rgba(220,38,38,0.2)", borderRadius: 12, fontWeight: 600, fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}
            >Delete Store</button>
          </div>
        </>
      )}

      {/* Store modal */}
      {storeModal && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setStoreModal(null)}>
          <div className="modal-box" style={{ maxWidth: 380 }}>
            <h3 style={{ margin: "0 0 20px", fontSize: 20, fontWeight: 700 }}>{storeModal.id ? "Edit Store" : "Add Store"}</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={labelStyle}>Store Name</label>
                <input style={inputStyle} value={storeModal.name} onChange={e => setStoreModal(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Colruyt" />
              </div>
              <div>
                <label style={labelStyle}>Colour</label>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <input type="color" value={storeModal.color || "#16a34a"} onChange={e => setStoreModal(f => ({ ...f, color: e.target.value }))} style={{ width: 44, height: 38, padding: 2, border: "1px solid #e5e7eb", borderRadius: 8, cursor: "pointer" }} />
                  <span style={{ fontSize: 14, color: "#6b7280" }}>{storeModal.color || "#16a34a"}</span>
                </div>
              </div>
              <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
                <button style={btnPrimary} onClick={saveStore}>Save</button>
                <button style={btnSecondary} onClick={() => setStoreModal(null)}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete store confirm */}
      {deleteStoreId && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setDeleteStoreId(null)}>
          <div className="modal-box" style={{ maxWidth: 360, textAlign: "center" }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>🗑️</div>
            <h3 style={{ margin: "0 0 10px", fontSize: 20, fontWeight: 700 }}>Delete Store?</h3>
            <p style={{ margin: "0 0 24px", color: "#6b7280" }}>All items in this store will also be deleted.</p>
            <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
              <button onClick={confirmDeleteStore} style={{ padding: "10px 20px", background: "rgba(252,165,165,0.12)", color: "#dc2626", border: "1px solid rgba(220,38,38,0.2)", borderRadius: 12, fontWeight: 600, fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>Delete</button>
              <button style={btnSecondary} onClick={() => setDeleteStoreId(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ItemRow({ item, onToggle, onDelete }) {
  const [hover, setHover] = useState(false);
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "flex", alignItems: "center", gap: 12, padding: "12px 14px",
        borderRadius: 14, cursor: "pointer", marginBottom: 4,
        background: item.checked ? "rgba(0,0,0,0.02)" : "rgba(255,255,255,0.85)",
        border: "1px solid rgba(0,0,0,0.06)",
        transition: "background 0.1s",
      }}
      onClick={() => onToggle(item)}
    >
      <div style={{
        width: 22, height: 22, borderRadius: 6, flexShrink: 0,
        background: item.checked ? "var(--accent, #16a34a)" : "transparent",
        border: `2px solid ${item.checked ? "var(--accent, #16a34a)" : "#d1d5db"}`,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        {item.checked && <span style={{ color: "#fff", fontSize: 13, lineHeight: 1 }}>✓</span>}
      </div>
      <span style={{
        flex: 1, fontSize: 15, color: item.checked ? "#9ca3af" : "#111827",
        textDecoration: item.checked ? "line-through" : "none",
        fontWeight: item.checked ? 400 : 500,
      }}>{item.name}</span>
      {item.quantity && (
        <span style={{ fontSize: 13, color: "#9ca3af", marginRight: 4 }}>{item.quantity}</span>
      )}
      {(hover || item.checked) && (
        <button
          onClick={e => { e.stopPropagation(); onDelete(item); }}
          style={{ background: "none", border: "none", cursor: "pointer", color: "#d1d5db", fontSize: 16, padding: "0 2px", lineHeight: 1 }}
        >×</button>
      )}
    </div>
  );
}
