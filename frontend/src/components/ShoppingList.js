import { useState, useRef } from "react";
import { apiFetch } from "../lib/api";
import GroceryIcon, { detectGroceryIcon } from "../lib/GroceryIcon";

const G = {
  bg:       "var(--g-bg)",
  card:     "var(--g-card)",
  ink:      "var(--g-ink)",
  ink2:     "var(--g-ink2)",
  muted:    "var(--g-muted)",
  mute2:    "var(--g-mute2)",
  hair:     "var(--g-hair)",
  hair2:    "var(--g-hair2)",
  sage:     "var(--g-sage)",
  sageBg:   "var(--g-sage-bg)",
  sageDark: "var(--g-sage-dark)",
  brick:    "var(--g-brick)",
  brickBg:  "var(--g-brick-bg)",
  serif:    "var(--g-serif)",
  sans:     "var(--g-sans)",
  shadow:   "var(--g-shadow)",
  shadowSm: "var(--g-shadow-sm)",
};

const inputStyle = {
  background: G.card,
  border: `1px solid ${G.hair}`,
  borderRadius: 12,
  padding: "11px 14px",
  fontSize: 14,
  fontFamily: G.sans,
  color: G.ink,
  outline: "none",
  width: "100%",
  boxSizing: "border-box",
};

const labelStyle = {
  fontSize: 12,
  color: G.muted,
  display: "block",
  marginBottom: 6,
  fontWeight: 600,
  fontFamily: G.sans,
};

const btnPrimary = {
  padding: "10px 20px",
  background: G.sage,
  color: "#fff",
  border: "none",
  borderRadius: 12,
  fontWeight: 600,
  fontSize: 14,
  cursor: "pointer",
  fontFamily: G.sans,
  boxShadow: "0 4px 12px rgba(90,122,94,0.25)",
};

const btnSecondary = {
  padding: "10px 20px",
  background: G.bg,
  color: G.ink2,
  border: `1px solid ${G.hair}`,
  borderRadius: 12,
  fontWeight: 600,
  fontSize: 14,
  cursor: "pointer",
  fontFamily: G.sans,
};

export default function ShoppingList({ shopping, setShopping, apiEnabled, showToast }) {
  const { stores = [], items = [] } = shopping;
  const [activeStoreId, setActiveStoreId] = useState("all");
  const [quickAdd, setQuickAdd] = useState("");
  const [storeModal, setStoreModal] = useState(null);
  const [deleteStoreId, setDeleteStoreId] = useState(null);
  const quickRef = useRef();

  const activeStore = activeStoreId === "all" ? null : (stores.find(s => s.id === activeStoreId) || stores[0] || null);
  const effectiveStoreId = activeStoreId === "all" ? null : (activeStore?.id ?? null);
  const storeItems = activeStoreId === "all" ? items : items.filter(i => i.storeId === effectiveStoreId);

  const unchecked = storeItems.filter(i => !i.checked);
  const checked   = storeItems.filter(i => i.checked);

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
    const targetStore = activeStoreId === "all"
      ? stores[0]
      : (stores.find(s => s.id === activeStoreId) || stores[0]);
    if (!quickAdd.trim() || !targetStore) return;
    const name = quickAdd.trim();
    const newItem = { id: Date.now(), storeId: targetStore.id, name, checked: false };
    setShopping(s => ({ ...s, items: [...s.items, newItem] }));
    setQuickAdd("");
    quickRef.current?.focus();
    if (!apiEnabled) return;
    try {
      const d = await apiFetch("/api/shopping/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storeId: targetStore.id, name }),
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
    if (activeStoreId === "all") {
      setShopping(s => ({ ...s, items: s.items.filter(i => !i.checked) }));
      if (!apiEnabled) return;
      for (const store of stores) {
        try { await apiFetch(`/api/shopping/items/checked?storeId=${store.id}`, { method: "DELETE" }); } catch {}
      }
    } else {
      setShopping(s => ({ ...s, items: s.items.filter(i => !i.checked || i.storeId !== activeStore?.id) }));
      if (!apiEnabled) return;
      try { await apiFetch(`/api/shopping/items/checked?storeId=${activeStore?.id}`, { method: "DELETE" }); } catch {}
    }
  };

  const saveStore = async () => {
    if (!storeModal?.name?.trim()) return showToast("Store name required", "danger");
    if (storeModal.id) {
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
      const tmp = { id: Date.now(), name: storeModal.name, color: storeModal.color || "#5a7a5e" };
      setShopping(s => ({ ...s, stores: [...s.stores, tmp] }));
      setActiveStoreId(tmp.id);
      setStoreModal(null);
      if (!apiEnabled) return;
      try {
        const d = await apiFetch("/api/shopping/stores", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: storeModal.name, color: storeModal.color || "#5a7a5e" }),
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
    if (activeStoreId === deleteStoreId) setActiveStoreId("all");
    setDeleteStoreId(null);
    if (!apiEnabled) return;
    try { await apiFetch(`/api/shopping/stores/${deleteStoreId}`, { method: "DELETE" }); } catch {}
  };

  const addPrompt = activeStoreId === "all"
    ? (stores.length > 0 ? `Add to ${stores[0]?.name}…` : "Add a store first")
    : `Add to ${activeStore?.name}…`;

  const iconKey = detectGroceryIcon(quickAdd);

  return (
    <div style={{ padding: "32px 40px 60px", display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <div style={{ fontFamily: G.sans, fontSize: 11.5, color: G.sage, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Boodschappenlijst
          </div>
          <h1 style={{ fontFamily: G.serif, fontSize: 44, color: G.ink, margin: "4px 0 0", fontWeight: 400, letterSpacing: "-0.5px", lineHeight: 1 }}>
            Shopping
          </h1>
        </div>
        <button
          onClick={() => setStoreModal({ name: "", color: "#5a7a5e" })}
          style={{ ...btnPrimary, display: "flex", alignItems: "center", gap: 8, padding: "10px 16px" }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 5v14M5 12h14"/>
          </svg>
          Add store
        </button>
      </div>

      {/* Store filter tabs */}
      {stores.length > 0 && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <StoreTab
            active={activeStoreId === "all"}
            label="All stores"
            count={items.filter(i => !i.checked).length}
            onClick={() => setActiveStoreId("all")}
          />
          {stores.map(s => (
            <StoreTab
              key={s.id}
              active={activeStoreId === s.id}
              label={s.name}
              color={s.color}
              count={items.filter(i => i.storeId === s.id && !i.checked).length}
              onClick={() => setActiveStoreId(s.id)}
              onEdit={() => setStoreModal({ ...s })}
            />
          ))}
        </div>
      )}

      {stores.length === 0 ? (
        <div style={{
          textAlign: "center", padding: "80px 20px",
          background: G.card, borderRadius: 20, boxShadow: G.shadow,
        }}>
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none" stroke="var(--g-mute2)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 16 }}>
            <path d="M13 22h22l-3 15c0 1-1 2-2 2H18c-1 0-2-1-2-2z"/>
            <path d="M11 22h26"/>
            <path d="M18 22c0-7 12-7 12 0"/>
          </svg>
          <p style={{ margin: 0, fontSize: 16, color: G.muted, fontFamily: G.sans }}>
            Add a store to get started
          </p>
        </div>
      ) : (
        <>
          {/* Quick-add bar */}
          <div style={{
            display: "flex", gap: 10, alignItems: "center",
            background: G.card, borderRadius: 16, padding: "8px 8px 8px 14px",
            boxShadow: G.shadowSm, border: `1px solid ${G.hair}`,
          }}>
            {quickAdd.trim() && (
              <span style={{ flexShrink: 0 }}>
                <GroceryIcon name={iconKey} size={28} stroke="var(--g-sage-dark)" strokeWidth={2} />
              </span>
            )}
            <input
              ref={quickRef}
              style={{ ...inputStyle, background: "transparent", border: "none", padding: "8px 0", flex: 1 }}
              placeholder={addPrompt}
              value={quickAdd}
              onChange={e => setQuickAdd(e.target.value)}
              onKeyDown={e => e.key === "Enter" && addItem()}
              disabled={activeStoreId === "all" && stores.length === 0}
            />
            <button style={{ ...btnPrimary, padding: "9px 18px", flexShrink: 0 }} onClick={addItem}>
              Add
            </button>
          </div>

          {/* Items */}
          {unchecked.length === 0 && checked.length === 0 && (
            <p style={{ color: G.muted, textAlign: "center", padding: "40px 0", margin: 0, fontFamily: G.sans }}>
              No items yet — add one above.
            </p>
          )}

          {unchecked.length > 0 && (
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(148px, 1fr))",
              gap: 12,
            }}>
              {unchecked.map(item => (
                <ItemCard
                  key={item.id}
                  item={item}
                  storeName={activeStoreId === "all" ? stores.find(s => s.id === item.storeId)?.name : null}
                  storeColor={stores.find(s => s.id === item.storeId)?.color}
                  onToggle={toggleItem}
                  onDelete={deleteItem}
                />
              ))}
            </div>
          )}

          {/* Checked / In cart */}
          {checked.length > 0 && (
            <div style={{ borderTop: `1px solid ${G.hair}`, paddingTop: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <span style={{ fontSize: 12, color: G.muted, fontWeight: 600, fontFamily: G.sans, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  In cart ({checked.length})
                </span>
                <button
                  onClick={clearChecked}
                  style={{
                    all: "unset", cursor: "pointer",
                    fontSize: 12, color: G.brick, fontWeight: 600, fontFamily: G.sans,
                    padding: "4px 10px", borderRadius: 8,
                    background: "var(--g-brick-bg)",
                  }}
                >
                  Clear list
                </button>
              </div>
              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(148px, 1fr))",
                gap: 12,
              }}>
                {checked.map(item => (
                  <ItemCard
                    key={item.id}
                    item={item}
                    storeName={activeStoreId === "all" ? stores.find(s => s.id === item.storeId)?.name : null}
                    storeColor={stores.find(s => s.id === item.storeId)?.color}
                    onToggle={toggleItem}
                    onDelete={deleteItem}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Store actions */}
          {activeStoreId !== "all" && activeStore && (
            <div style={{ display: "flex", gap: 8, paddingTop: 8 }}>
              <button style={btnSecondary} onClick={() => setStoreModal({ ...activeStore })}>Edit store</button>
              <button
                onClick={() => setDeleteStoreId(activeStore.id)}
                style={{ ...btnSecondary, color: G.brick, borderColor: "var(--g-brick-bg)" }}
              >
                Delete store
              </button>
            </div>
          )}
        </>
      )}

      {/* Store modal */}
      {storeModal && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setStoreModal(null)}>
          <div className="modal-box" style={{ maxWidth: 380 }}>
            <h3 style={{ margin: "0 0 20px", fontSize: 22, fontWeight: 400, fontFamily: G.serif, color: G.ink }}>
              {storeModal.id ? "Edit store" : "Add store"}
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label style={labelStyle}>Store name</label>
                <input
                  style={inputStyle}
                  value={storeModal.name}
                  onChange={e => setStoreModal(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Colruyt"
                  onKeyDown={e => e.key === "Enter" && saveStore()}
                  autoFocus
                />
              </div>
              <div>
                <label style={labelStyle}>Colour</label>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <input
                    type="color"
                    value={storeModal.color || "#5a7a5e"}
                    onChange={e => setStoreModal(f => ({ ...f, color: e.target.value }))}
                    style={{ width: 44, height: 38, padding: 2, border: `1px solid ${G.hair}`, borderRadius: 8, cursor: "pointer", background: "none" }}
                  />
                  <span style={{ fontSize: 13, color: G.muted, fontFamily: G.sans }}>{storeModal.color || "#5a7a5e"}</span>
                </div>
              </div>
              <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                <button style={btnPrimary} onClick={saveStore}>Save</button>
                <button style={btnSecondary} onClick={() => setStoreModal(null)}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteStoreId && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setDeleteStoreId(null)}>
          <div className="modal-box" style={{ maxWidth: 360, textAlign: "center" }}>
            <div style={{ width: 56, height: 56, borderRadius: 18, background: "var(--g-brick-bg)", margin: "0 auto 16px", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--g-brick)" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>
              </svg>
            </div>
            <h3 style={{ margin: "0 0 8px", fontSize: 20, fontWeight: 400, fontFamily: G.serif, color: G.ink }}>Delete store?</h3>
            <p style={{ margin: "0 0 24px", color: G.muted, fontFamily: G.sans, fontSize: 14 }}>
              All items in this store will also be removed.
            </p>
            <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
              <button
                onClick={confirmDeleteStore}
                style={{ ...btnSecondary, color: G.brick, borderColor: "var(--g-brick-bg)", background: "var(--g-brick-bg)" }}
              >
                Delete
              </button>
              <button style={btnSecondary} onClick={() => setDeleteStoreId(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StoreTab({ active, label, color, count, onClick, onEdit }) {
  return (
    <button
      onClick={onClick}
      onDoubleClick={onEdit}
      title={onEdit ? "Double-click to edit" : undefined}
      style={{
        all: "unset",
        cursor: "pointer",
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "7px 14px",
        borderRadius: 999,
        fontFamily: "var(--g-sans)",
        fontWeight: 600,
        fontSize: 13,
        background: active ? (color || "var(--g-sage)") : "var(--g-card)",
        color: active ? "#fff" : "var(--g-ink2)",
        boxShadow: active ? "0 2px 8px rgba(0,0,0,0.12)" : "var(--g-shadow-sm)",
        border: `1px solid ${active ? "transparent" : "var(--g-hair)"}`,
        transition: "all 0.15s",
      }}
    >
      {!active && color && (
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0 }} />
      )}
      {label}
      {count > 0 && (
        <span style={{
          fontWeight: 700, fontSize: 11,
          background: active ? "rgba(255,255,255,0.25)" : "var(--g-sage-bg)",
          color: active ? "#fff" : "var(--g-sage-dark)",
          padding: "1px 6px", borderRadius: 999,
        }}>
          {count}
        </span>
      )}
    </button>
  );
}

function ItemCard({ item, storeName, storeColor, onToggle, onDelete }) {
  const [hover, setHover] = useState(false);
  const iconKey = detectGroceryIcon(item.name);

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={() => onToggle(item)}
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        padding: "16px 12px 14px",
        borderRadius: 18,
        cursor: "pointer",
        background: item.checked ? "var(--g-bg)" : "var(--g-card)",
        border: `1px solid ${item.checked ? "var(--g-hair2)" : "var(--g-hair)"}`,
        boxShadow: item.checked ? "none" : "var(--g-shadow-sm)",
        transition: "all 0.15s",
        opacity: item.checked ? 0.6 : 1,
        minHeight: 110,
        userSelect: "none",
      }}
    >
      {/* Checkmark overlay */}
      {item.checked && (
        <div style={{
          position: "absolute", top: 8, right: 8,
          width: 20, height: 20, borderRadius: 7,
          background: "var(--g-sage)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 13l4 4 10-12"/>
          </svg>
        </div>
      )}

      {/* Delete on hover */}
      {hover && !item.checked && (
        <button
          onClick={e => { e.stopPropagation(); onDelete(item); }}
          style={{
            position: "absolute", top: 7, right: 7,
            all: "unset", cursor: "pointer",
            background: "var(--g-brick-bg)",
            color: "var(--g-brick)",
            fontSize: 14, lineHeight: 1,
            width: 20, height: 20, borderRadius: 6,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          ×
        </button>
      )}

      {/* Icon */}
      <div style={{
        width: 48, height: 48,
        borderRadius: 14,
        background: item.checked ? "var(--g-bg)" : "var(--g-sage-bg)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <GroceryIcon
          name={iconKey}
          size={28}
          stroke={item.checked ? "var(--g-mute2)" : "var(--g-sage-dark)"}
          strokeWidth={2}
        />
      </div>

      <span style={{
        fontSize: 13, fontWeight: 600,
        color: item.checked ? "var(--g-muted)" : "var(--g-ink)",
        textAlign: "center",
        textDecoration: item.checked ? "line-through" : "none",
        lineHeight: 1.3,
        wordBreak: "break-word",
        maxWidth: "100%",
        fontFamily: "var(--g-sans)",
      }}>
        {item.name}
      </span>

      {item.quantity && (
        <span style={{ fontSize: 11, color: "var(--g-mute2)", fontFamily: "var(--g-sans)" }}>
          {item.quantity}
        </span>
      )}

      {storeName && (
        <span style={{
          fontSize: 10, fontWeight: 700,
          color: storeColor || "var(--g-sage)",
          background: (storeColor || "var(--g-sage)") + "20",
          padding: "2px 7px", borderRadius: 6,
          textTransform: "uppercase", letterSpacing: "0.04em",
          fontFamily: "var(--g-sans)",
        }}>
          {storeName}
        </span>
      )}
    </div>
  );
}
