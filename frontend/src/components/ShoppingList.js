import { useState, useRef } from "react";
import { apiFetch } from "../lib/api";

const ITEM_ICONS = [
  [/apple|pear|peach|plum|mango|kiwi|cherry|berry|strawberr|blueberr|raspberr|blackberr|grape|melon|watermelon|pineapple|orange|lemon|lime|grapefruit|banana|fig|apricot|nectarin|pomegranate|avocado|fruit/i, "🍎"],
  [/tomato|lettuce|spinach|broccoli|carrot|celery|cucumber|onion|garlic|potato|mushroom|pepper|capsicum|zucchini|courgette|eggplant|aubergine|corn|pea|bean|cabbage|cauliflower|leek|radish|artichoke|asparagus|beetroot|beet|kale|veggie|vegetable|salad|arugula|rocket|fennel|parsnip|turnip|sprout/i, "🥦"],
  [/herb|basil|parsley|coriander|cilantro|thyme|rosemary|mint|sage|oregano|dill|chive|tarragon|bay leaf/i, "🌿"],
  [/chicken|beef|pork|lamb|duck|turkey|meat|steak|mince|sausage|bacon|ham|salami|prosciutto|chorizo|kebab|fillet|ribs|brisket|veal|venison/i, "🥩"],
  [/fish|salmon|tuna|cod|shrimp|prawn|lobster|crab|clam|mussel|oyster|squid|octopus|anchov|sardine|tilapia|sea bass|trout|mackerel|halibut|seafood/i, "🐟"],
  [/milk|yogurt|yoghurt|cream|butter|cheese|cheddar|mozzarella|brie|camembert|gouda|parmesan|egg|dairy/i, "🧀"],
  [/bread|baguette|roll|bun|croissant|bagel|pita|naan|toast|sourdough|rye|wheat|loaf/i, "🍞"],
  [/pasta|spaghetti|penne|fettuccine|linguine|tagliatelle|rigatoni|fusilli|lasagna|noodle|rice|quinoa|couscous|bulgur|grain/i, "🍝"],
  [/cereal|oats|oatmeal|granola|muesli|corn flakes|bran/i, "🥣"],
  [/oil|olive oil|sunflower oil|coconut oil|vegetable oil|vinegar|sauce|ketchup|mustard|mayo|mayonnaise|aioli|salsa|pesto|hummus|tahini|soy sauce|hot sauce|sriracha|worcestershire|dressing|condiment/i, "🫙"],
  [/sugar|salt|pepper|flour|baking|spice|cumin|turmeric|paprika|cinnamon|nutmeg|ginger|vanilla|yeast|baking powder|baking soda|cocoa|chocolate chips/i, "🧂"],
  [/chocolate|candy|sweet|candy|cookie|biscuit|cake|pie|waffle|brownie|muffin|donut|ice cream|gelato|sorbet|pudding|jelly|jam|honey|syrup|snack/i, "🍫"],
  [/chips|crisp|pretzel|popcorn|cracker|nut|almond|cashew|walnut|peanut|pistachio|macadamia|hazelnut|pecan|sunflower seed|pumpkin seed|trail mix/i, "🥜"],
  [/coffee|tea|espresso|cappuccino|latte|cocoa|hot chocolate/i, "☕"],
  [/juice|smoothie|squash|lemonade|soda|water|sparkling|tonic|energy drink|sports drink|kombucha|drink|beverage/i, "🥤"],
  [/beer|wine|champagne|cider|whiskey|vodka|gin|rum|tequila|alcohol|spirit/i, "🍺"],
  [/soap|shampoo|conditioner|body wash|shower gel|deodorant|toothpaste|toothbrush|razor|lotion|moisturis|sunscreen|makeup|mascara|lipstick|perfume|cologne|hygiene|personal care/i, "🧴"],
  [/detergent|washing|laundry|bleach|fabric softener|dishwasher|cleaning|cleaner|disinfect|wipes|mop|sponge|brush|broom|vacuum|toilet|bathroom|kitchen cleaner/i, "🧹"],
  [/toilet paper|tissue|paper towel|kitchen roll|bin bag|trash bag|wrap|foil|cling film|zip bag|parchment/i, "🧻"],
  [/diaper|nappy|baby|formula|wipe|lotion baby/i, "🍼"],
  [/dog|cat|pet food|pet|kibble|treat|litter/i, "🐾"],
  [/medicine|vitamin|supplement|tablet|pill|bandage|plaster|pharmacy/i, "💊"],
  [/battery|light bulb|candle|match|lighter|tape|glue|screw|nail|tool|hardware/i, "🔧"],
  [/flower|plant|soil|fertilizer|seed|bulb/i, "🌸"],
];

const getItemIcon = (name) => {
  for (const [pattern, icon] of ITEM_ICONS) {
    if (pattern.test(name)) return icon;
  }
  return "🛒";
};

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
  // "all" is a synthetic tab showing every store's items
  const [activeStoreId, setActiveStoreId] = useState("all");
  const [quickAdd, setQuickAdd] = useState("");
  const [storeModal, setStoreModal] = useState(null);
  const [deleteStoreId, setDeleteStoreId] = useState(null);
  const quickRef = useRef();

  const activeStore = activeStoreId === "all" ? null : (stores.find(s => s.id === activeStoreId) || stores[0] || null);
  const effectiveStoreId = activeStoreId === "all" ? null : (activeStore?.id ?? null);

  const storeItems = activeStoreId === "all"
    ? items
    : items.filter(i => i.storeId === effectiveStoreId);

  const unchecked = storeItems.filter(i => !i.checked);
  const checked   = storeItems.filter(i => i.checked);

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
    if (activeStoreId === deleteStoreId) setActiveStoreId("all");
    setDeleteStoreId(null);
    if (!apiEnabled) return;
    try { await apiFetch(`/api/shopping/stores/${deleteStoreId}`, { method: "DELETE" }); } catch {}
  };

  void persist;

  const addPrompt = activeStoreId === "all"
    ? (stores.length > 0 ? `Add item to ${stores[0]?.name}…` : "Add a store first")
    : `Add item to ${activeStore?.name}…`;

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "28px 20px" }}>
      <h2 style={{ margin: "0 0 20px", fontSize: 26, fontWeight: 800, color: "#111827" }}>🛒 Shopping List</h2>

      {/* Store tabs + All */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 24, alignItems: "center" }}>
        <button
          onClick={() => setActiveStoreId("all")}
          style={{
            padding: "8px 18px", borderRadius: 20, border: "none", cursor: "pointer",
            fontFamily: "inherit", fontWeight: 700, fontSize: 14,
            background: activeStoreId === "all" ? "var(--accent, #16a34a)" : "#f1f5f9",
            color: activeStoreId === "all" ? "#fff" : "#374151",
            transition: "all 0.15s",
          }}
        >All stores</button>
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

      {stores.length > 0 && (
        <>
          {/* Quick-add bar */}
          <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
            <input
              ref={quickRef}
              style={{ ...inputStyle, flex: 1 }}
              placeholder={addPrompt}
              value={quickAdd}
              onChange={e => setQuickAdd(e.target.value)}
              onKeyDown={e => e.key === "Enter" && addItem()}
              disabled={activeStoreId === "all" && stores.length === 0}
            />
            <button style={{ ...btnPrimary, padding: "11px 18px" }} onClick={addItem}>Add</button>
          </div>

          {/* Items grid */}
          {unchecked.length === 0 && checked.length === 0 && (
            <p style={{ color: "#9ca3af", textAlign: "center", padding: "32px 0", margin: 0 }}>No items yet. Add one above!</p>
          )}

          {unchecked.length > 0 && (
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
              gap: 10,
              marginBottom: 24,
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

          {/* Checked items */}
          {checked.length > 0 && (
            <div style={{ marginTop: 8, borderTop: "1px dashed #e5e7eb", paddingTop: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <span style={{ fontSize: 13, color: "#9ca3af", fontWeight: 600 }}>In cart ({checked.length})</span>
                <button
                  onClick={clearChecked}
                  style={{ fontSize: 13, color: "#dc2626", background: "none", border: "none", cursor: "pointer", fontWeight: 600, fontFamily: "inherit" }}
                >Clear all</button>
              </div>
              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
                gap: 10,
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

          {/* Store actions — only shown when viewing a specific store */}
          {activeStoreId !== "all" && activeStore && (
            <div style={{ display: "flex", gap: 8, marginTop: 32, paddingTop: 16, borderTop: "1px solid #e5e7eb" }}>
              <button style={btnSecondary} onClick={() => setStoreModal({ ...activeStore })}>Edit Store</button>
              <button
                onClick={() => setDeleteStoreId(activeStore.id)}
                style={{ padding: "10px 20px", background: "rgba(252,165,165,0.12)", color: "#dc2626", border: "1px solid rgba(220,38,38,0.2)", borderRadius: 12, fontWeight: 600, fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}
              >Delete Store</button>
            </div>
          )}
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

function ItemCard({ item, storeName, storeColor, onToggle, onDelete }) {
  const [hover, setHover] = useState(false);
  const icon = getItemIcon(item.name);

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
        gap: 6,
        padding: "14px 10px 12px",
        borderRadius: 16,
        cursor: "pointer",
        background: item.checked ? "rgba(0,0,0,0.02)" : "rgba(255,255,255,0.9)",
        border: item.checked ? "1px solid rgba(0,0,0,0.04)" : "1px solid rgba(0,0,0,0.07)",
        boxShadow: item.checked ? "none" : "0 2px 8px rgba(15,23,42,0.05)",
        transition: "all 0.15s",
        opacity: item.checked ? 0.55 : 1,
        minHeight: 96,
        userSelect: "none",
      }}
    >
      {/* Checkmark overlay */}
      {item.checked && (
        <div style={{
          position: "absolute", top: 8, right: 8,
          width: 18, height: 18, borderRadius: 5,
          background: "var(--accent, #16a34a)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <span style={{ color: "#fff", fontSize: 11, lineHeight: 1 }}>✓</span>
        </div>
      )}

      {/* Delete on hover */}
      {(hover && !item.checked) && (
        <button
          onClick={e => { e.stopPropagation(); onDelete(item); }}
          style={{
            position: "absolute", top: 6, right: 6,
            background: "rgba(220,38,38,0.08)", border: "none", cursor: "pointer",
            color: "#dc2626", fontSize: 14, padding: "1px 5px", lineHeight: 1,
            borderRadius: 6,
          }}
        >×</button>
      )}

      <span style={{ fontSize: 32, lineHeight: 1 }}>{icon}</span>
      <span style={{
        fontSize: 13, fontWeight: 600,
        color: item.checked ? "#9ca3af" : "#111827",
        textAlign: "center",
        textDecoration: item.checked ? "line-through" : "none",
        lineHeight: 1.3,
        wordBreak: "break-word",
        maxWidth: "100%",
      }}>{item.name}</span>

      {storeName && (
        <span style={{
          fontSize: 10, fontWeight: 700, color: storeColor || "#9ca3af",
          background: (storeColor || "#9ca3af") + "18",
          padding: "2px 7px", borderRadius: 6,
          textTransform: "uppercase", letterSpacing: 0.5,
        }}>{storeName}</span>
      )}

      {item.quantity && (
        <span style={{ fontSize: 11, color: "#9ca3af" }}>{item.quantity}</span>
      )}
    </div>
  );
}
