import { useState, useEffect, useRef, useMemo } from "react";
import { apiFetch } from "../lib/api";
import { getWeekDays, useTodayKey } from "../lib/utils";

const CATEGORIES = ["Fish", "Pasta", "Meat", "Veg", "Baking"];
const FILTER_TABS = ["All", "Favourites", ...CATEGORIES];

const EMPTY_RECIPE = {
  id: null, name: "", description: "", category: "", isFavourite: false,
  prepTime: "", cookTime: "", servings: 4, ingredients: "", instructions: "", image: null,
};

function getWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

function parseIngredients(str) {
  if (!str) return [];
  const lines = str.split("\n").map(s => s.trim()).filter(Boolean);
  if (lines.length > 1) return lines;
  return str.split(",").map(s => s.trim()).filter(Boolean);
}

function parseSteps(str) {
  if (!str) return [];
  return str.split("\n").map(s => s.trim()).filter(Boolean);
}

const CAT_STYLES = {
  Fish:   { bg: "var(--g-sky-bg)",   color: "var(--g-sky)"   },
  Pasta:  { bg: "var(--g-honey-bg)", color: "var(--g-honey)" },
  Meat:   { bg: "var(--g-brick-bg)", color: "var(--g-brick)" },
  Veg:    { bg: "var(--g-sage-bg)",  color: "var(--g-sage)"  },
  Baking: { bg: "var(--g-bg2)",      color: "var(--g-ink2)"  },
};
const getCatStyle = (cat) => CAT_STYLES[cat] || { bg: "var(--g-bg2)", color: "var(--g-ink2)" };

export default function MealPlanner({ recipes, setRecipes, mealPlan, setMealPlan, shopping = { stores: [], items: [] }, setShopping, apiEnabled, queueMutation, showToast }) {
  const [mealForm, setMealForm] = useState(null);
  const [recipeForm, setRecipeForm] = useState(null);
  const [recipeView, setRecipeView] = useState(null);
  const [checkedIngredients, setCheckedIngredients] = useState({});
  const [sidebarServings, setSidebarServings] = useState(4);
  const [recipeSearchTerm, setRecipeSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [deleteRecipeId, setDeleteRecipeId] = useState(null);
  const [shoppingDraft, setShoppingDraft] = useState(null);
  const recipeFileRef = useRef();

  const todayKey = useTodayKey();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const weekDays = useMemo(() => getWeekDays(), [todayKey]);
  const weekNum = useMemo(() => getWeekNumber(new Date()), []);

  const recipeViewId = recipeView?.id;
  const recipeViewServings = recipeView?.servings;
  useEffect(() => {
    setCheckedIngredients({});
    setSidebarServings(recipeViewServings || 4);
  }, [recipeViewId, recipeViewServings]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      if (recipeView) { setRecipeView(null); return; }
      if (recipeForm) { setRecipeForm(null); return; }
      if (mealForm) { setMealForm(null); return; }
      if (deleteRecipeId) setDeleteRecipeId(null);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [mealForm, recipeForm, recipeView, deleteRecipeId]);

  const getRecipeById = (id) => recipes.find(r => String(r.id) === String(id)) || null;
  const defaultStoreId = shopping.stores?.[0]?.id || "";

  const filteredRecipes = recipes.filter(r => {
    if (categoryFilter === "Favourites" && !r.isFavourite) return false;
    if (categoryFilter !== "All" && categoryFilter !== "Favourites" && r.category !== categoryFilter) return false;
    if (recipeSearchTerm && !r.name.toLowerCase().includes(recipeSearchTerm.toLowerCase())) return false;
    return true;
  });

  const handleRecipeFile = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = (ev) => setRecipeForm(p => ({ ...p, image: ev.target.result, _imageFile: f }));
    reader.readAsDataURL(f);
  };

  const toggleFavourite = async (recipe) => {
    const updated = { ...recipe, isFavourite: !recipe.isFavourite };
    setRecipes(prev => prev.map(r => r.id === recipe.id ? updated : r));
    if (recipeView?.id === recipe.id) setRecipeView(updated);
    if (apiEnabled) {
      const { _imageFile, ...payload } = updated;
      await apiFetch(`/api/recipes/${recipe.id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      });
    }
  };

  const saveMeal = async () => {
    if (!mealForm.title.trim() && !mealForm.recipeId) return;
    const selectedRecipe = getRecipeById(mealForm.recipeId);
    const title = mealForm.title.trim() || selectedRecipe?.name || "Meal";
    const nextPlan = {
      ...mealPlan,
      [mealForm.day]: { title, recipeId: mealForm.recipeId || null, notes: mealForm.notes.trim() },
    };
    setMealPlan(nextPlan);
    setMealForm(null);
    showToast("Meal saved");
    if (apiEnabled) {
      await apiFetch("/api/meal-plan", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(nextPlan) });
    } else {
      queueMutation?.({ method: "PUT", endpoint: "/api/meal-plan", body: nextPlan, resource: "mealPlan" });
    }
  };

  const removeMeal = async (day) => {
    const next = { ...mealPlan };
    delete next[day];
    setMealPlan(next);
    showToast("Meal removed", "danger");
    if (apiEnabled) {
      await apiFetch("/api/meal-plan", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(next) });
    } else {
      queueMutation?.({ method: "PUT", endpoint: "/api/meal-plan", body: next, resource: "mealPlan" });
    }
  };

  const openMealForm = (day, meal = null) => {
    const recipe = meal?.recipeId ? getRecipeById(meal.recipeId) : null;
    setMealForm({ day, title: meal?.title?.trim() || recipe?.name || "", recipeId: meal?.recipeId || "", notes: meal?.notes || "" });
  };

  const handleDayClick = (day, meal) => {
    if (meal?.recipeId) {
      const recipe = getRecipeById(meal.recipeId);
      if (recipe) { setRecipeView(recipe); return; }
    }
    openMealForm(day.key, meal);
  };

  const saveRecipe = async () => {
    if (!recipeForm.name.trim()) return;
    const { _imageFile, ...payload } = recipeForm;

    if (apiEnabled) {
      const method = recipeForm.id ? "PUT" : "POST";
      const endpoint = recipeForm.id ? `/api/recipes/${recipeForm.id}` : "/api/recipes";
      let body, headers;
      if (_imageFile) {
        body = new FormData();
        body.append("data", JSON.stringify({ ...payload, image: null }));
        body.append("image", _imageFile);
      } else {
        body = JSON.stringify(payload);
        headers = { "Content-Type": "application/json" };
      }
      const result = await apiFetch(endpoint, { method, body, headers });
      if (result) {
        setRecipes(prev => recipeForm.id ? prev.map(r => r.id === recipeForm.id ? result : r) : [...prev, result]);
        showToast(recipeForm.id ? "Recipe updated" : "Recipe added");
        setRecipeForm(null);
        return;
      }
    }

    if (recipeForm.id) {
      setRecipes(prev => prev.map(r => r.id === recipeForm.id ? { ...payload } : r));
      if (!_imageFile) queueMutation?.({ method: "PUT", endpoint: `/api/recipes/${recipeForm.id}`, body: payload, resource: "recipes", tempId: recipeForm.id });
    } else {
      const local = { ...payload, id: Date.now() };
      setRecipes(prev => [...prev, local]);
      if (!_imageFile) queueMutation?.({ method: "POST", endpoint: "/api/recipes", body: local, resource: "recipes", tempId: local.id });
    }
    showToast(recipeForm.id ? "Recipe updated" : "Recipe added");
    setRecipeForm(null);
  };

  const confirmDeleteRecipe = async () => {
    if (apiEnabled) await apiFetch(`/api/recipes/${deleteRecipeId}`, { method: "DELETE" });
    else queueMutation?.({ method: "DELETE", endpoint: `/api/recipes/${deleteRecipeId}`, resource: "recipes", tempId: deleteRecipeId });
    setRecipes(prev => prev.filter(r => r.id !== deleteRecipeId));
    setMealPlan(prev =>
      Object.fromEntries(
        Object.entries(prev).map(([day, meal]) =>
          [day, meal.recipeId === deleteRecipeId ? { ...meal, recipeId: null } : meal]
        )
      )
    );
    setDeleteRecipeId(null);
    showToast("Recipe deleted", "danger");
  };

  const openShoppingDraft = (source, recipe = null) => {
    const selectedRecipes = source === "week"
      ? weekDays.map(day => mealPlan[day.key]?.recipeId).filter(Boolean).map(getRecipeById).filter(Boolean)
      : [recipe].filter(Boolean);
    const seen = new Set();
    const items = selectedRecipes.flatMap(r =>
      parseIngredients(r.ingredients).map(name => ({ name, recipeId: r.id, recipeName: r.name }))
    ).filter(item => {
      const key = item.name.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    if (!items.length) return showToast("No ingredients to add", "danger");
    setShoppingDraft({ source, storeId: defaultStoreId, items, checked: Object.fromEntries(items.map((_, i) => [i, true])) });
  };

  const addShoppingDraft = async () => {
    if (!shoppingDraft?.storeId) return showToast("Choose a target store first", "danger");
    const selected = shoppingDraft.items.filter((_, i) => shoppingDraft.checked[i]);
    const existing = new Set((shopping.items || [])
      .filter(item => String(item.storeId) === String(shoppingDraft.storeId) && !item.checked)
      .map(item => item.name?.trim().toLowerCase()));
    const toAdd = selected.filter(item => !existing.has(item.name.trim().toLowerCase()));
    if (!toAdd.length) { setShoppingDraft(null); return showToast("All selected ingredients are already on that list"); }

    if (apiEnabled) {
      const created = [];
      for (const item of toAdd) {
        const result = await apiFetch("/api/shopping/items", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: item.name, storeId: shoppingDraft.storeId, source: shoppingDraft.source, recipeId: item.recipeId }),
        });
        if (result) created.push(result);
      }
      setShopping?.(prev => ({ ...prev, items: [...(prev.items || []), ...created] }));
    } else {
      const maxId = (shopping.items || []).reduce((m, item) => Math.max(m, item.id || 0), 0);
      const created = toAdd.map((item, i) => ({ id: maxId + i + 1, name: item.name, storeId: shoppingDraft.storeId, checked: false, source: shoppingDraft.source, recipeId: item.recipeId }));
      created.forEach(item => queueMutation?.({ method: "POST", endpoint: "/api/shopping/items", body: { name: item.name, storeId: item.storeId, source: item.source, recipeId: item.recipeId }, resource: "shopping", tempId: item.id }));
      setShopping?.(prev => ({ ...prev, items: [...(prev.items || []), ...created] }));
    }
    setShoppingDraft(null);
    showToast(`${toAdd.length} ingredient${toAdd.length === 1 ? "" : "s"} added`);
  };

  return (
    <div className="page" style={{ display: "flex", flexDirection: "column", gap: 32, fontFamily: "var(--g-sans)" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
        <div>
          <p style={{ margin: 0, fontSize: 11.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, color: "var(--g-sage)" }}>
            Week {weekNum} · Cookbook &amp; Plan
          </p>
          <h1 style={{ margin: "4px 0 0", fontSize: 52, fontWeight: 400, fontFamily: "var(--g-serif)", color: "var(--g-ink)", letterSpacing: "-0.5px", lineHeight: 1 }}>
            Meals
          </h1>
        </div>
        <button
          onClick={() => setRecipeForm({ ...EMPTY_RECIPE })}
          style={{ display: "flex", alignItems: "center", gap: 7, background: "var(--g-ink)", border: "none", color: "#fff", padding: "11px 22px", borderRadius: 14, cursor: "pointer", fontSize: 13.5, fontWeight: 600, fontFamily: "var(--g-sans)" }}
        >
          <span style={{ fontSize: 20, lineHeight: 1, marginTop: -1 }}>+</span> New recipe
        </button>
      </div>

      {/* This week */}
      <div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 14 }}>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 600, color: "var(--g-ink)" }}>This week</h2>
          <span style={{ fontSize: 12, color: "var(--g-muted)" }}>tap a day to plan or cook</span>
          <button onClick={() => openShoppingDraft("week")} style={{ marginLeft: "auto", background: "var(--g-sage-bg)", border: "1px solid var(--g-sage)", color: "var(--g-sage-dark)", borderRadius: 12, padding: "7px 12px", cursor: "pointer", fontSize: 12.5, fontWeight: 600, fontFamily: "var(--g-sans)" }}>
            Add week ingredients
          </button>
        </div>
        <div className="week-strip-grid">
          {weekDays.map(day => {
            const meal = mealPlan[day.key];
            const recipe = meal?.recipeId ? getRecipeById(meal.recipeId) : null;
            const isToday = day.isToday;
            const catStyle = recipe?.category ? getCatStyle(recipe.category) : null;
            const dateNum = new Date(day.key + "T12:00:00").getDate();
            return (
              <div
                key={day.key}
                onClick={() => handleDayClick(day, meal)}
                style={{
                  background: isToday ? "var(--g-sage-bg)" : "var(--g-card)",
                  borderRadius: 18,
                  overflow: "hidden",
                  boxShadow: "var(--g-shadow-sm)",
                  cursor: "pointer",
                  border: `1.5px solid ${isToday ? "var(--g-sage)" : "transparent"}`,
                  display: "flex",
                  flexDirection: "column",
                  minHeight: 190,
                  transition: "box-shadow 0.15s",
                }}
                onMouseEnter={e => e.currentTarget.style.boxShadow = "var(--g-shadow)"}
                onMouseLeave={e => e.currentTarget.style.boxShadow = "var(--g-shadow-sm)"}
              >
                {/* Day header strip */}
                <div style={{
                  padding: "12px 14px 10px",
                  background: isToday ? "var(--g-sage)" : "transparent",
                  borderBottom: `1px solid ${isToday ? "transparent" : "var(--g-hair)"}`,
                }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 5 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: isToday ? "rgba(255,255,255,0.75)" : "var(--g-muted)" }}>
                      {day.short.toUpperCase()}
                    </span>
                    <span style={{ fontSize: 22, fontWeight: 400, fontFamily: "var(--g-serif)", color: isToday ? "#fff" : "var(--g-ink)", lineHeight: 1 }}>
                      {dateNum}
                    </span>
                  </div>
                  {isToday && (
                    <p style={{ margin: "2px 0 0", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.2, color: "rgba(255,255,255,0.65)" }}>
                      Tonight
                    </p>
                  )}
                </div>

                {/* Day body */}
                <div style={{ padding: "11px 14px 14px", flex: 1, display: "flex", flexDirection: "column" }}>
                  {meal ? (
                    <>
                      <p style={{
                        margin: "0 0 auto",
                        fontSize: 13.5,
                        fontFamily: "var(--g-serif)",
                        color: "var(--g-ink)",
                        lineHeight: 1.35,
                        fontStyle: !recipe ? "italic" : "normal",
                      }}>
                        {meal.title}
                      </p>
                      {recipe && (
                        <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 5 }}>
                          {catStyle && recipe.category && (
                            <span style={{ display: "inline-block", fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 20, background: catStyle.bg, color: catStyle.color, width: "fit-content" }}>
                              {recipe.category}
                            </span>
                          )}
                          {(recipe.cookTime || recipe.prepTime) && (
                            <p style={{ margin: 0, fontSize: 11, color: "var(--g-muted)" }}>
                              ⏱ {recipe.cookTime || recipe.prepTime} min
                            </p>
                          )}
                        </div>
                      )}
                      {isToday && recipe && (
                        <button
                          onClick={e => { e.stopPropagation(); setRecipeView(recipe); }}
                          style={{ marginTop: 10, background: "var(--g-sage)", border: "none", color: "#fff", padding: "7px 10px", borderRadius: 10, cursor: "pointer", fontSize: 11.5, fontWeight: 600, fontFamily: "var(--g-sans)", display: "flex", alignItems: "center", gap: 4 }}
                        >
                          ▷ Start cooking
                        </button>
                      )}
                    </>
                  ) : (
                    <button
                      onClick={e => { e.stopPropagation(); openMealForm(day.key); }}
                      style={{ background: "none", border: "none", color: "var(--g-muted)", cursor: "pointer", fontSize: 12.5, padding: 0, fontFamily: "var(--g-sans)", display: "flex", alignItems: "center", gap: 4, marginTop: "auto" }}
                    >
                      <span style={{ fontSize: 17 }}>+</span> Plan
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Cookbook */}
      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, gap: 12, flexWrap: "wrap" }}>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 600, color: "var(--g-ink)" }}>
            Cookbook <span style={{ color: "var(--g-muted)", fontWeight: 400 }}>· {recipes.length}</span>
          </h2>
          <div style={{ position: "relative", flex: "1 1 200px", maxWidth: 320, minWidth: 0 }}>
            <span style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "var(--g-muted)", fontSize: 13, pointerEvents: "none" }}>⌕</span>
            <input
              type="text"
              placeholder="Search recipes or ingredients…"
              value={recipeSearchTerm}
              onChange={e => setRecipeSearchTerm(e.target.value)}
              style={{ background: "var(--g-card)", border: "1px solid var(--g-hair)", borderRadius: 14, padding: "9px 14px 9px 30px", color: "var(--g-ink)", fontSize: 13, width: "100%", boxSizing: "border-box", fontFamily: "var(--g-sans)", outline: "none" }}
            />
          </div>
        </div>

        {/* Filter tabs */}
        <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
          {FILTER_TABS.map(tab => (
            <button
              key={tab}
              onClick={() => setCategoryFilter(tab)}
              style={{
                background: categoryFilter === tab ? "var(--g-ink)" : "var(--g-card)",
                border: "1px solid",
                borderColor: categoryFilter === tab ? "var(--g-ink)" : "var(--g-hair)",
                color: categoryFilter === tab ? "#fff" : "var(--g-ink2)",
                borderRadius: 20,
                padding: "6px 16px",
                cursor: "pointer",
                fontSize: 13,
                fontWeight: 500,
                fontFamily: "var(--g-sans)",
                display: "flex",
                alignItems: "center",
                gap: 5,
                transition: "all 0.12s",
              }}
            >
              {tab === "Favourites" && <span style={{ fontSize: 12 }}>♡</span>}
              {tab}
            </button>
          ))}
        </div>

        {/* Recipe grid */}
        <div className="cookbook-grid">
          {filteredRecipes.length === 0 && (
            <div style={{ color: "var(--g-muted)", fontSize: 13, padding: "40px 20px", textAlign: "center", gridColumn: "1 / -1" }}>
              {recipes.length === 0 ? "No recipes yet — add your first one!" : "No matches found"}
            </div>
          )}
          {filteredRecipes.map(recipe => {
            const catStyle = recipe.category ? getCatStyle(recipe.category) : null;
            return (
              <div
                key={recipe.id}
                onClick={() => setRecipeView(recipe)}
                style={{ background: "var(--g-card)", borderRadius: 20, overflow: "hidden", boxShadow: "var(--g-shadow-sm)", cursor: "pointer", transition: "box-shadow 0.15s", display: "flex", flexDirection: "column" }}
                onMouseEnter={e => e.currentTarget.style.boxShadow = "var(--g-shadow)"}
                onMouseLeave={e => e.currentTarget.style.boxShadow = "var(--g-shadow-sm)"}
              >
                {/* Image / placeholder */}
                <div style={{ position: "relative", height: 160, background: "var(--g-sage-bg)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  {recipe.image
                    ? <img src={recipe.image} alt={recipe.name} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                    : <span style={{ fontSize: 44, opacity: 0.18, fontFamily: "Georgia, serif", lineHeight: 1 }}>❧</span>
                  }
                  {catStyle && recipe.category && (
                    <span style={{ position: "absolute", top: 11, left: 11, fontSize: 10, fontWeight: 600, padding: "3px 9px", borderRadius: 20, background: catStyle.bg, color: catStyle.color }}>
                      {recipe.category}
                    </span>
                  )}
                  <button
                    onClick={e => { e.stopPropagation(); toggleFavourite(recipe); }}
                    style={{ position: "absolute", top: 9, right: 9, background: "rgba(255,255,255,0.9)", border: "none", borderRadius: "50%", width: 30, height: 30, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, color: recipe.isFavourite ? "#e05a5a" : "var(--g-muted)", padding: 0 }}
                  >
                    {recipe.isFavourite ? "♥" : "♡"}
                  </button>
                </div>

                {/* Card body */}
                <div style={{ padding: "14px 16px 16px", flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
                  <h4 style={{ margin: 0, fontSize: 15, fontWeight: 400, fontFamily: "var(--g-serif)", color: "var(--g-ink)", lineHeight: 1.3 }}>{recipe.name}</h4>
                  {recipe.description && (
                    <p style={{ margin: 0, fontSize: 12, color: "var(--g-muted)", fontStyle: "italic" }}>{recipe.description}</p>
                  )}
                  {(recipe.cookTime || recipe.prepTime || recipe.servings) && (
                    <div style={{ display: "flex", alignItems: "center", gap: 10, color: "var(--g-muted)", fontSize: 12, marginTop: 4 }}>
                      {(recipe.cookTime || recipe.prepTime) && <span>⏱ {recipe.cookTime || recipe.prepTime} min</span>}
                      {recipe.servings && <span>👥 {recipe.servings}</span>}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Recipe detail sidebar */}
      {recipeView && (
        <div style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex" }}>
          <div
            style={{ flex: 1, backdropFilter: "blur(6px)", background: "rgba(31,42,36,0.22)", cursor: "pointer" }}
            onClick={() => setRecipeView(null)}
          />
          <div className="recipe-sidebar" style={{
            background: "var(--g-card)",
            height: "100%",
            overflowY: "auto",
            overscrollBehavior: "contain",
            boxShadow: "-4px 0 40px rgba(31,42,36,0.14)",
            display: "flex",
            flexDirection: "column",
            animation: "slideInRight 0.22s ease-out",
          }}>
            {/* Sticky header */}
            <div style={{ padding: "15px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid var(--g-hair)", position: "sticky", top: 0, background: "var(--g-card)", zIndex: 1 }}>
              {recipeView.category
                ? <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 20, ...getCatStyle(recipeView.category) }}>{recipeView.category}</span>
                : <div />
              }
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => toggleFavourite(recipeView)} style={iconBtn} title={recipeView.isFavourite ? "Unfavourite" : "Favourite"}>
                  <span style={{ fontSize: 16, color: recipeView.isFavourite ? "#e05a5a" : "var(--g-ink2)" }}>{recipeView.isFavourite ? "♥" : "♡"}</span>
                </button>
                <button onClick={() => { setRecipeForm({ ...recipeView }); setRecipeView(null); }} style={iconBtn} title="Edit">
                  <span style={{ fontSize: 14 }}>✎</span>
                </button>
                <button onClick={() => setRecipeView(null)} style={iconBtn} title="Close">
                  <span style={{ fontSize: 19, lineHeight: 1 }}>×</span>
                </button>
              </div>
            </div>

            {/* Recipe image */}
            <div style={{ height: 210, background: "var(--g-sage-bg)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              {recipeView.image
                ? <img src={recipeView.image} alt={recipeView.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                : <span style={{ fontSize: 70, opacity: 0.13, fontFamily: "Georgia, serif", lineHeight: 1 }}>❧</span>
              }
            </div>

            {/* Content */}
            <div style={{ padding: "24px 28px 40px", flex: 1, display: "flex", flexDirection: "column", gap: 24 }}>

              {/* Title */}
              <div>
                <h2 style={{ margin: "0 0 4px", fontSize: 30, fontWeight: 400, fontFamily: "var(--g-serif)", color: "var(--g-ink)", letterSpacing: "-0.3px", lineHeight: 1.1 }}>
                  {recipeView.name}
                </h2>
                {recipeView.description && (
                  <p style={{ margin: "5px 0 0", fontSize: 14, fontStyle: "italic", color: "var(--g-muted)", fontFamily: "var(--g-serif)" }}>
                    {recipeView.description}
                  </p>
                )}
              </div>

              {/* Times + servings */}
              {(recipeView.cookTime || recipeView.prepTime || sidebarServings) && (
                <div style={{ display: "flex", gap: 20, alignItems: "center", flexWrap: "wrap" }}>
                  {recipeView.cookTime && (
                    <div style={{ textAlign: "center" }}>
                      <p style={{ margin: 0, fontSize: 19, fontWeight: 600, color: "var(--g-ink)", fontFamily: "var(--g-serif)" }}>{recipeView.cookTime}</p>
                      <p style={{ margin: "2px 0 0", fontSize: 10, color: "var(--g-muted)", textTransform: "uppercase", letterSpacing: 0.6 }}>min cook</p>
                    </div>
                  )}
                  {recipeView.prepTime && (
                    <div style={{ textAlign: "center" }}>
                      <p style={{ margin: 0, fontSize: 19, fontWeight: 600, color: "var(--g-ink)", fontFamily: "var(--g-serif)" }}>{recipeView.prepTime}</p>
                      <p style={{ margin: "2px 0 0", fontSize: 10, color: "var(--g-muted)", textTransform: "uppercase", letterSpacing: 0.6 }}>min prep</p>
                    </div>
                  )}
                  {(recipeView.cookTime || recipeView.prepTime) && (
                    <div style={{ width: 1, height: 28, background: "var(--g-hair)" }} />
                  )}
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <button onClick={() => setSidebarServings(s => Math.max(1, s - 1))} style={servingBtn}>−</button>
                    <span style={{ fontSize: 14, fontWeight: 600, color: "var(--g-ink)", minWidth: 70, textAlign: "center" }}>
                      {sidebarServings} servings
                    </span>
                    <button onClick={() => setSidebarServings(s => s + 1)} style={servingBtn}>+</button>
                  </div>
                </div>
              )}

              {/* Ingredients */}
              {recipeView.ingredients && (
                <div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 10 }}>
                  <p style={{ margin: 0, fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.9, color: "var(--g-sage)" }}>
                    Ingredients <span style={{ color: "var(--g-muted)", fontSize: 10.5, textTransform: "none", letterSpacing: 0, fontWeight: 400 }}>· tap to check off</span>
                  </p>
                    <button onClick={() => openShoppingDraft("recipe", recipeView)} style={{ background: "var(--g-sage-bg)", border: "1px solid var(--g-sage)", color: "var(--g-sage-dark)", borderRadius: 10, padding: "6px 10px", cursor: "pointer", fontSize: 12, fontWeight: 600, fontFamily: "var(--g-sans)", whiteSpace: "nowrap" }}>
                      Add to list
                    </button>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                    {parseIngredients(recipeView.ingredients).map((item, i) => {
                      const key = `${recipeView.id}-${i}`;
                      const checked = !!checkedIngredients[key];
                      return (
                        <div
                          key={key}
                          onClick={() => setCheckedIngredients(p => ({ ...p, [key]: !p[key] }))}
                          style={{ display: "flex", alignItems: "center", gap: 11, padding: "9px 10px", borderRadius: 10, cursor: "pointer", background: checked ? "var(--g-sage-bg)" : "transparent", transition: "background 0.1s" }}
                        >
                          <div style={{ width: 17, height: 17, borderRadius: 4, border: `1.5px solid ${checked ? "var(--g-sage)" : "var(--g-hair)"}`, background: checked ? "var(--g-sage)" : "transparent", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.1s" }}>
                            {checked && <span style={{ color: "#fff", fontSize: 10, fontWeight: 700, lineHeight: 1 }}>✓</span>}
                          </div>
                          <span style={{ fontSize: 14, color: checked ? "var(--g-muted)" : "var(--g-ink)", textDecoration: checked ? "line-through" : "none", transition: "all 0.1s" }}>
                            {item}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Method */}
              {recipeView.instructions && (
                <div>
                  <p style={{ margin: "0 0 14px", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.9, color: "var(--g-sage)" }}>
                    Method <span style={{ color: "var(--g-muted)", fontSize: 10.5, textTransform: "none", letterSpacing: 0, fontWeight: 400 }}>· {parseSteps(recipeView.instructions).length} steps</span>
                  </p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    {parseSteps(recipeView.instructions).map((step, i) => (
                      <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                        <span style={{ width: 24, height: 24, borderRadius: "50%", background: "var(--g-sage-bg)", color: "var(--g-sage-dark)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11.5, fontWeight: 700, flexShrink: 0 }}>
                          {i + 1}
                        </span>
                        <p style={{ margin: "3px 0 0", fontSize: 14, color: "var(--g-ink2)", lineHeight: 1.65 }}>{step}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {shoppingDraft && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setShoppingDraft(null)}>
          <div className="modal-box" style={{ maxWidth: 520 }}>
            <h2 style={{ margin: "0 0 18px", fontSize: 22, fontWeight: 400, fontFamily: "var(--g-serif)", color: "var(--g-ink)" }}>
              Add ingredients
            </h2>
            <div style={{ display: "grid", gap: 14 }}>
              <div>
                <label style={labelStyle}>Target store</label>
                <select value={shoppingDraft.storeId} onChange={e => setShoppingDraft(p => ({ ...p, storeId: e.target.value }))} style={inputStyle}>
                  <option value="">Choose a store</option>
                  {(shopping.stores || []).map(store => <option key={store.id} value={store.id}>{store.name}</option>)}
                </select>
              </div>
              <div style={{ maxHeight: 300, overflow: "auto", border: "1px solid var(--g-hair)", borderRadius: 14, padding: 8 }}>
                {shoppingDraft.items.map((item, i) => (
                  <label key={`${item.recipeId}-${i}`} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 10, cursor: "pointer", color: "var(--g-ink)", fontSize: 14 }}>
                    <input type="checkbox" checked={!!shoppingDraft.checked[i]} onChange={e => setShoppingDraft(p => ({ ...p, checked: { ...p.checked, [i]: e.target.checked } }))} />
                    <span style={{ flex: 1 }}>{item.name}</span>
                    {shoppingDraft.source === "week" && <span style={{ color: "var(--g-muted)", fontSize: 12 }}>{item.recipeName}</span>}
                  </label>
                ))}
              </div>
            </div>
            <div style={modalFooterStyle}>
              <button onClick={() => setShoppingDraft(null)} style={cancelBtnStyle}>Cancel</button>
              <button onClick={addShoppingDraft} style={primaryBtnStyle}>Add selected</button>
            </div>
          </div>
        </div>
      )}

      {/* Meal form modal */}
      {mealForm && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setMealForm(null)}>
          <div className="modal-box">
            <h2 style={{ margin: "0 0 20px", fontSize: 22, fontWeight: 400, fontFamily: "var(--g-serif)", color: "var(--g-ink)" }}>
              Plan meal — {weekDays.find(d => d.key === mealForm.day)?.short} {new Date(mealForm.day + "T12:00:00").getDate()}
            </h2>
            <div style={{ display: "grid", gap: 16 }}>
              <div>
                <label style={labelStyle}>Recipe</label>
                <select
                  value={mealForm.recipeId}
                  onChange={e => {
                    const recipe = recipes.find(r => String(r.id) === e.target.value);
                    setMealForm(p => ({ ...p, recipeId: e.target.value, title: p.title.trim() || recipe?.name || "" }));
                  }}
                  style={inputStyle}
                >
                  <option value="">— Free fill or choose a recipe —</option>
                  {recipes.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Meal title</label>
                <input value={mealForm.title} onChange={e => setMealForm(p => ({ ...p, title: e.target.value }))} placeholder="e.g. Pasta night" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Notes</label>
                <textarea value={mealForm.notes} onChange={e => setMealForm(p => ({ ...p, notes: e.target.value }))} rows={3} style={{ ...inputStyle, resize: "vertical" }} />
              </div>
            </div>
            <div style={modalFooterStyle}>
              {mealPlan[mealForm.day] && (
                <button onClick={() => { removeMeal(mealForm.day); setMealForm(null); }} style={{ ...cancelBtnStyle, color: "var(--g-brick)", borderColor: "var(--g-brick-bg)" }}>Remove</button>
              )}
              <button onClick={() => setMealForm(null)} style={cancelBtnStyle}>Cancel</button>
              <button onClick={saveMeal} style={primaryBtnStyle}>Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Recipe form modal */}
      {recipeForm && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setRecipeForm(null)}>
          <div className="modal-box" style={{ maxWidth: 600 }}>
            <h2 style={{ margin: "0 0 20px", fontSize: 22, fontWeight: 400, fontFamily: "var(--g-serif)", color: "var(--g-ink)" }}>
              {recipeForm.id ? "Edit Recipe" : "New Recipe"}
            </h2>
            <div style={{ display: "grid", gap: 14 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={labelStyle}>Recipe name</label>
                  <input value={recipeForm.name} onChange={e => setRecipeForm(p => ({ ...p, name: e.target.value }))} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Category</label>
                  <select value={recipeForm.category || ""} onChange={e => setRecipeForm(p => ({ ...p, category: e.target.value }))} style={inputStyle}>
                    <option value="">— No category —</option>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label style={labelStyle}>Description</label>
                <input value={recipeForm.description || ""} onChange={e => setRecipeForm(p => ({ ...p, description: e.target.value }))} placeholder="e.g. with jasmine rice &amp; greens" style={inputStyle} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                <div>
                  <label style={labelStyle}>Cook time (min)</label>
                  <input type="number" min="0" value={recipeForm.cookTime || ""} onChange={e => setRecipeForm(p => ({ ...p, cookTime: e.target.value ? +e.target.value : "" }))} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Prep time (min)</label>
                  <input type="number" min="0" value={recipeForm.prepTime || ""} onChange={e => setRecipeForm(p => ({ ...p, prepTime: e.target.value ? +e.target.value : "" }))} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Servings</label>
                  <input type="number" min="1" value={recipeForm.servings || ""} onChange={e => setRecipeForm(p => ({ ...p, servings: e.target.value ? +e.target.value : "" }))} style={inputStyle} />
                </div>
              </div>
              <div>
                <label style={labelStyle}>Ingredients <span style={{ fontWeight: 400, color: "var(--g-muted)" }}>(one per line)</span></label>
                <textarea value={recipeForm.ingredients} onChange={e => setRecipeForm(p => ({ ...p, ingredients: e.target.value }))} rows={5} placeholder={"Bucatini\nTinned tomatoes\nGarlic cloves"} style={{ ...inputStyle, resize: "vertical" }} />
              </div>
              <div>
                <label style={labelStyle}>Instructions <span style={{ fontWeight: 400, color: "var(--g-muted)" }}>(one step per line)</span></label>
                <textarea value={recipeForm.instructions} onChange={e => setRecipeForm(p => ({ ...p, instructions: e.target.value }))} rows={5} placeholder={"Salt the water generously and cook the bucatini.\nFry garlic in olive oil until fragrant."} style={{ ...inputStyle, resize: "vertical" }} />
              </div>
              <div>
                <label style={labelStyle}>Recipe image</label>
                <input ref={recipeFileRef} type="file" accept="image/*" onChange={handleRecipeFile} style={{ display: "none" }} />
                <button onClick={() => recipeFileRef.current.click()} style={uploadBtnStyle}>
                  {recipeForm.image ? "✓ Image ready" : "Click to upload image"}
                </button>
              </div>
            </div>
            <div style={modalFooterStyle}>
              <button onClick={() => setRecipeForm(null)} style={cancelBtnStyle}>Cancel</button>
              <button onClick={saveRecipe} style={primaryBtnStyle}>Save recipe</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {deleteRecipeId && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setDeleteRecipeId(null)}>
          <div className="modal-box" style={{ maxWidth: 400, textAlign: "center" }}>
            <p style={{ fontSize: 16, marginBottom: 24, color: "var(--g-ink)" }}>Delete this recipe? This cannot be undone.</p>
            <div style={{ display: "flex", gap: 12 }}>
              <button onClick={() => setDeleteRecipeId(null)} style={cancelBtnStyle}>Cancel</button>
              <button onClick={confirmDeleteRecipe} style={{ ...cancelBtnStyle, background: "var(--g-brick-bg)", border: "none", color: "var(--g-brick)" }}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const labelStyle = { fontSize: 12, color: "var(--g-muted)", display: "block", marginBottom: 6, fontWeight: 600, fontFamily: "var(--g-sans)" };
const inputStyle = { width: "100%", background: "#fff", border: "1px solid var(--g-hair)", borderRadius: 12, padding: "11px 14px", color: "var(--g-ink)", fontSize: 14, boxSizing: "border-box", fontFamily: "var(--g-sans)" };
const uploadBtnStyle = { background: "#fff", border: "2px dashed var(--g-hair)", borderRadius: 12, padding: "16px", color: "var(--g-sage)", cursor: "pointer", fontSize: 14, width: "100%", fontWeight: 600, fontFamily: "var(--g-sans)" };
const modalFooterStyle = { display: "flex", gap: 12, marginTop: 24 };
const cancelBtnStyle = { flex: 1, padding: "12px", background: "var(--g-bg)", border: "1px solid var(--g-hair)", borderRadius: 12, color: "var(--g-ink2)", cursor: "pointer", fontSize: 14, fontWeight: 600, fontFamily: "var(--g-sans)" };
const primaryBtnStyle = { flex: 2, padding: "12px", background: "var(--g-sage)", border: "none", borderRadius: 12, color: "#fff", fontWeight: 600, cursor: "pointer", fontSize: 14, fontFamily: "var(--g-sans)" };
const iconBtn = { background: "var(--g-bg)", border: "1px solid var(--g-hair)", borderRadius: 10, width: 35, height: 35, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "var(--g-ink2)", fontFamily: "var(--g-sans)", padding: 0 };
const servingBtn = { background: "var(--g-bg)", border: "1px solid var(--g-hair)", borderRadius: 8, width: 28, height: 28, cursor: "pointer", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--g-ink2)", fontFamily: "var(--g-sans)", padding: 0 };
