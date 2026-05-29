import { useState, useEffect, useRef, useMemo } from "react";
import { apiFetch } from "../lib/api";
import { getWeekDays, useTodayKey } from "../lib/utils";

const EMPTY_RECIPE = { id: null, name: "", ingredients: "", instructions: "", image: null };

export default function MealPlanner({ recipes, setRecipes, mealPlan, setMealPlan, apiEnabled, showToast }) {
  const [mealForm, setMealForm] = useState(null);
  const [recipeForm, setRecipeForm] = useState(null);
  const [recipeView, setRecipeView] = useState(null);
  const [recipeSearchTerm, setRecipeSearchTerm] = useState("");
  const [deleteRecipeId, setDeleteRecipeId] = useState(null);
  const recipeFileRef = useRef();

  const todayKey = useTodayKey();
  const weekDays = useMemo(() => getWeekDays(), [todayKey]);

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

  const filteredRecipes = recipes.filter(r =>
    r.name.toLowerCase().includes(recipeSearchTerm.toLowerCase())
  );

  const handleRecipeFile = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = (ev) => setRecipeForm(p => ({ ...p, image: ev.target.result, _imageFile: f }));
    reader.readAsDataURL(f);
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
    }
  };

  const removeMeal = async (day) => {
    const next = { ...mealPlan };
    delete next[day];
    setMealPlan(next);
    showToast("Meal removed", "danger");
    if (apiEnabled) {
      await apiFetch("/api/meal-plan", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(next) });
    }
  };

  const openMealForm = (day, meal = null) => {
    const recipe = meal?.recipeId ? getRecipeById(meal.recipeId) : null;
    setMealForm({ day, title: meal?.title?.trim() || recipe?.name || "", recipeId: meal?.recipeId || "", notes: meal?.notes || "" });
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
    } else {
      setRecipes(prev => [...prev, { ...payload, id: Date.now() }]);
    }
    showToast(recipeForm.id ? "Recipe updated" : "Recipe added");
    setRecipeForm(null);
  };

  const confirmDeleteRecipe = async () => {
    if (apiEnabled) await apiFetch(`/api/recipes/${deleteRecipeId}`, { method: "DELETE" });
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

  const todayMeal = mealPlan[todayKey];

  return (
    <div style={{ padding: "32px 40px 60px", display: "flex", flexDirection: "column", gap: 24, fontFamily: "var(--g-sans)" }}>
      {/* Page header */}
      <div>
        <p style={{ margin: 0, fontSize: 11.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, color: "var(--g-sage)" }}>Kitchen</p>
        <h1 style={{ margin: "4px 0 0", fontSize: 44, fontWeight: 400, fontFamily: "var(--g-serif)", color: "var(--g-ink)", letterSpacing: "-0.5px", lineHeight: 1 }}>Meal Planner</h1>
      </div>

      {/* Today highlight */}
      <div style={{
        background: "var(--g-sage-bg)",
        borderRadius: 20,
        padding: "28px 32px",
        boxShadow: "var(--g-shadow-sm)",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: 24,
        flexWrap: "wrap",
      }}>
        <div style={{ flex: 1 }}>
          <p style={{ margin: 0, fontSize: 11.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, color: "var(--g-sage-dark)" }}>Today's meal</p>
          <h2 style={{ margin: "8px 0 0", fontSize: 28, fontWeight: 400, fontFamily: "var(--g-serif)", color: "var(--g-ink)", letterSpacing: "-0.5px" }}>{weekDays[0].label}</h2>
          {todayMeal ? (
            <div style={{ marginTop: 12 }}>
              <p style={{ margin: 0, fontSize: 22, fontWeight: 400, fontFamily: "var(--g-serif)", color: "var(--g-ink)" }}>{todayMeal.title}</p>
              {todayMeal.notes && <p style={{ margin: "10px 0 0", color: "var(--g-ink2)", fontSize: 14, lineHeight: 1.6 }}>{todayMeal.notes}</p>}
              {todayMeal.recipeId && getRecipeById(todayMeal.recipeId) && (
                <div style={{ marginTop: 12, background: "rgba(255,255,255,0.6)", borderRadius: 12, padding: "10px 14px", display: "inline-block" }}>
                  <p style={{ margin: 0, fontSize: 11.5, color: "var(--g-sage-dark)", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.8 }}>From recipe</p>
                  <p style={{ margin: "4px 0 0", fontSize: 14, fontWeight: 600, color: "var(--g-ink)" }}>{getRecipeById(todayMeal.recipeId).name}</p>
                </div>
              )}
            </div>
          ) : (
            <p style={{ margin: "12px 0 0", color: "var(--g-ink2)", fontSize: 14, lineHeight: 1.7 }}>No meal planned for today. Add one below.</p>
          )}
        </div>
        <button
          onClick={() => openMealForm(todayKey, todayMeal)}
          style={{ background: "var(--g-sage)", border: "none", color: "#fff", padding: "10px 20px", borderRadius: 12, cursor: "pointer", fontSize: 13, fontWeight: 600, whiteSpace: "nowrap", fontFamily: "var(--g-sans)" }}
        >
          {todayMeal ? "Edit" : "Add meal"}
        </button>
      </div>

      {/* Weekly grid + Recipe library */}
      <div className="meal-grid">
        {/* 7-day grid */}
        <div>
          <p style={{ margin: "0 0 16px", fontSize: 11.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, color: "var(--g-sage)" }}>Weekly plan</p>
          <div style={{ display: "grid", gap: 10 }}>
            {weekDays.map(day => {
              const meal = mealPlan[day.key];
              return (
                <div
                  key={day.key}
                  style={{
                    background: day.isToday ? "var(--g-sage-bg)" : "var(--g-card)",
                    borderRadius: 16,
                    padding: "16px 20px",
                    boxShadow: "var(--g-shadow-sm)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: 0, fontSize: 11.5, textTransform: "uppercase", letterSpacing: 0.8, color: day.isToday ? "var(--g-sage-dark)" : "var(--g-muted)", fontWeight: 600 }}>{day.label}</p>
                    <p style={{ margin: "5px 0 0", fontSize: 16, fontWeight: 400, fontFamily: "var(--g-serif)", color: meal ? "var(--g-ink)" : "var(--g-mute2)" }}>
                      {meal?.title || "Not planned"}
                    </p>
                    {meal?.notes && <p style={{ margin: "3px 0 0", fontSize: 12, color: "var(--g-ink2)" }}>{meal.notes.substring(0, 50)}{meal.notes.length > 50 ? "…" : ""}</p>}
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => openMealForm(day.key, meal)} style={smallBtnStyle}>{meal ? "Edit" : "Plan"}</button>
                    {meal && <button onClick={() => removeMeal(day.key)} style={smallDangerBtnStyle}>Remove</button>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Recipe library */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <p style={{ margin: 0, fontSize: 11.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, color: "var(--g-sage)" }}>Recipes</p>
            <button onClick={() => setRecipeForm({ ...EMPTY_RECIPE })} style={{ background: "var(--g-sage)", border: "none", color: "#fff", padding: "7px 14px", borderRadius: 12, cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "var(--g-sans)" }}>New</button>
          </div>
          <input
            type="text"
            placeholder="Search recipes…"
            value={recipeSearchTerm}
            onChange={e => setRecipeSearchTerm(e.target.value)}
            style={{ width: "100%", background: "#fff", border: "1px solid var(--g-hair)", borderRadius: 12, padding: "10px 14px", color: "var(--g-ink)", fontSize: 14, boxSizing: "border-box", fontFamily: "var(--g-sans)" }}
          />
          {/* 3-column recipe grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, maxHeight: "min(560px, 50vh)", overflowY: "auto", paddingRight: 4 }}>
            {filteredRecipes.length === 0 && (
              <div style={{ color: "var(--g-muted)", fontSize: 13, padding: 20, textAlign: "center", gridColumn: "1 / -1" }}>
                {recipes.length === 0 ? "No recipes yet" : "No matches found"}
              </div>
            )}
            {filteredRecipes.map(recipe => (
              <div
                key={recipe.id}
                onClick={() => setRecipeView(recipe)}
                style={{ background: "var(--g-card)", borderRadius: 16, padding: 14, cursor: "pointer", boxShadow: "var(--g-shadow-sm)", transition: "box-shadow 0.15s" }}
                onMouseEnter={e => e.currentTarget.style.boxShadow = "var(--g-shadow)"}
                onMouseLeave={e => e.currentTarget.style.boxShadow = "var(--g-shadow-sm)"}
              >
                {recipe.image && (
                  <div style={{ marginBottom: 10, borderRadius: 10, overflow: "hidden", height: 80 }}>
                    <img src={recipe.image} alt={recipe.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  </div>
                )}
                <h4 style={{ margin: "0 0 4px", fontSize: 14, fontWeight: 400, fontFamily: "var(--g-serif)", color: "var(--g-ink)" }}>{recipe.name}</h4>
                <p style={{ margin: 0, color: "var(--g-muted)", fontSize: 11.5, lineHeight: 1.4 }}>
                  {recipe.ingredients.split(",").slice(0, 2).join(", ")}{recipe.ingredients.split(",").length > 2 ? "…" : ""}
                </p>
                <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
                  <button onClick={e => { e.stopPropagation(); setRecipeForm({ ...recipe }); }} style={smallBtnStyle}>Edit</button>
                  <button onClick={e => { e.stopPropagation(); setDeleteRecipeId(recipe.id); }} style={smallDangerBtnStyle}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Meal form modal */}
      {mealForm && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setMealForm(null)}>
          <div className="modal-box">
            <h2 style={{ margin: "0 0 20px", fontSize: 22, fontWeight: 400, fontFamily: "var(--g-serif)", color: "var(--g-ink)" }}>
              Plan meal — {weekDays.find(d => d.key === mealForm.day)?.label || mealForm.day}
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
              <button onClick={() => setMealForm(null)} style={cancelBtnStyle}>Cancel</button>
              <button onClick={saveMeal} style={primaryBtnStyle}>Save meal</button>
            </div>
          </div>
        </div>
      )}

      {/* Recipe form modal */}
      {recipeForm && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setRecipeForm(null)}>
          <div className="modal-box">
            <h2 style={{ margin: "0 0 20px", fontSize: 22, fontWeight: 400, fontFamily: "var(--g-serif)", color: "var(--g-ink)" }}>
              {recipeForm.id ? "Edit Recipe" : "New Recipe"}
            </h2>
            <div style={{ display: "grid", gap: 16 }}>
              <div>
                <label style={labelStyle}>Recipe name</label>
                <input value={recipeForm.name} onChange={e => setRecipeForm(p => ({ ...p, name: e.target.value }))} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Ingredients</label>
                <textarea value={recipeForm.ingredients} onChange={e => setRecipeForm(p => ({ ...p, ingredients: e.target.value }))} rows={4} style={{ ...inputStyle, resize: "vertical" }} />
              </div>
              <div>
                <label style={labelStyle}>Instructions</label>
                <textarea value={recipeForm.instructions} onChange={e => setRecipeForm(p => ({ ...p, instructions: e.target.value }))} rows={5} style={{ ...inputStyle, resize: "vertical" }} />
              </div>
              <div>
                <label style={labelStyle}>Recipe image</label>
                <input ref={recipeFileRef} type="file" accept="image/*" onChange={handleRecipeFile} style={{ display: "none" }} />
                <button onClick={() => recipeFileRef.current.click()} style={uploadBtnStyle}>
                  {recipeForm.image ? "Image uploaded" : "Click to upload image"}
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

      {/* Recipe view modal */}
      {recipeView && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setRecipeView(null)}>
          <div className="modal-box" style={{ maxWidth: 600 }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24, gap: 16 }}>
              <h2 style={{ margin: 0, fontSize: 28, fontWeight: 400, fontFamily: "var(--g-serif)", color: "var(--g-ink)", letterSpacing: "-0.5px" }}>{recipeView.name}</h2>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => { setRecipeForm({ ...recipeView }); setRecipeView(null); }} style={smallBtnStyle}>Edit</button>
                <button onClick={() => setRecipeView(null)} style={cancelBtnStyle}>Close</button>
              </div>
            </div>
            {recipeView.image && (
              <div style={{ marginBottom: 24, borderRadius: 16, overflow: "hidden" }}>
                <img src={recipeView.image} alt={recipeView.name} style={{ maxWidth: "100%", maxHeight: 280, objectFit: "cover", display: "block", borderRadius: 16 }} />
              </div>
            )}
            <div style={{ marginBottom: 20 }}>
              <p style={{ margin: "0 0 8px", fontSize: 11.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.8, color: "var(--g-sage)" }}>Ingredients</p>
              <p style={{ margin: 0, color: "var(--g-ink2)", lineHeight: 1.7, whiteSpace: "pre-line", fontSize: 14 }}>{recipeView.ingredients}</p>
            </div>
            <div>
              <p style={{ margin: "0 0 8px", fontSize: 11.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.8, color: "var(--g-sage)" }}>Instructions</p>
              <p style={{ margin: 0, color: "var(--g-ink2)", lineHeight: 1.7, whiteSpace: "pre-line", fontSize: 14 }}>{recipeView.instructions}</p>
            </div>
          </div>
        </div>
      )}

      {/* Delete recipe confirmation */}
      {deleteRecipeId && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setDeleteRecipeId(null)}>
          <div className="modal-box" style={{ maxWidth: 400, textAlign: "center" }}>
            <p style={{ fontSize: 16, marginBottom: 24, color: "var(--g-ink)", fontFamily: "var(--g-sans)" }}>Delete this recipe? This cannot be undone.</p>
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
const smallBtnStyle = { background: "var(--g-bg)", border: "1px solid var(--g-hair)", color: "var(--g-ink2)", borderRadius: 10, padding: "6px 12px", cursor: "pointer", fontSize: 12, fontWeight: 600, fontFamily: "var(--g-sans)" };
const smallDangerBtnStyle = { background: "var(--g-brick-bg)", border: "none", color: "var(--g-brick)", borderRadius: 10, padding: "6px 12px", cursor: "pointer", fontSize: 12, fontWeight: 600, fontFamily: "var(--g-sans)" };
