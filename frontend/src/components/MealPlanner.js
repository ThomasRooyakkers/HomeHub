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
    <div style={{ display: "grid", gap: 32 }}>
      {/* Today highlight */}
      <div style={{ background: "linear-gradient(135deg, #dcfce7, #bbf7d0)", border: "2px solid rgba(34,197,94,0.3)", borderRadius: 24, padding: 32, boxShadow: "0 8px 24px rgba(22,163,74,0.15)" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 32, flexWrap: "wrap" }}>
          <div style={{ flex: 1 }}>
            <p style={{ margin: 0, textTransform: "uppercase", letterSpacing: 0.5, fontSize: 13, color: "#64748b", fontWeight: 700 }}>📅 Today's meal</p>
            <h2 style={{ margin: "12px 0 0", fontSize: 28, fontWeight: 800, color: "#166534" }}>{weekDays[0].label}</h2>
            {todayMeal ? (
              <div style={{ marginTop: 16 }}>
                <p style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#166534" }}>{todayMeal.title}</p>
                {todayMeal.notes && <p style={{ margin: "12px 0 0", color: "#4b5563", fontSize: 15, lineHeight: 1.6 }}>{todayMeal.notes}</p>}
                {todayMeal.recipeId && getRecipeById(todayMeal.recipeId) && (
                  <div style={{ marginTop: 16, background: "rgba(255,255,255,0.7)", borderRadius: 14, padding: 14 }}>
                    <p style={{ margin: 0, fontSize: 12, color: "#64748b", fontWeight: 600 }}>FROM RECIPE</p>
                    <p style={{ margin: "6px 0 0", fontSize: 15, fontWeight: 700, color: "#166534" }}>{getRecipeById(todayMeal.recipeId).name}</p>
                  </div>
                )}
              </div>
            ) : (
              <p style={{ margin: "16px 0 0", color: "#4b5563", lineHeight: 1.8, fontSize: 15 }}>No meal planned for today. Add one below.</p>
            )}
          </div>
          <button onClick={() => openMealForm(todayKey, todayMeal)} style={{ background: "#16a34a", border: "none", color: "#fff", padding: "14px 24px", borderRadius: 16, cursor: "pointer", fontSize: 14, fontWeight: 700, boxShadow: "0 4px 12px rgba(22,163,74,0.3)", whiteSpace: "nowrap" }}>
            {todayMeal ? "✏️ Edit" : "➕ Add meal"}
          </button>
        </div>
      </div>

      <div className="meal-grid">
        {/* Weekly plan */}
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 20 }}>
            <h3 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#166534" }}>📆 Weekly plan</h3>
          </div>
          <div style={{ display: "grid", gap: 12 }}>
            {weekDays.map(day => {
              const meal = mealPlan[day.key];
              return (
                <div key={day.key} style={{ background: day.isToday ? "rgba(34,197,94,0.08)" : "linear-gradient(135deg, #f8fafc, #f1f5f9)", border: day.isToday ? "2px solid rgba(34,197,94,0.2)" : "1px solid rgba(34,197,94,0.1)", borderRadius: 16, padding: 18, boxShadow: "0 2px 6px rgba(0,0,0,0.04)" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                    <div style={{ flex: 1 }}>
                      <p style={{ margin: 0, fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5, color: "#94a3b8", fontWeight: 600 }}>{day.label}</p>
                      <p style={{ margin: "6px 0 0", fontSize: 15, fontWeight: 700, color: "#166534" }}>{meal?.title || "Not planned"}</p>
                      {meal?.notes && <p style={{ margin: "4px 0 0", fontSize: 13, color: "#64748b" }}>{meal.notes.substring(0, 50)}{meal.notes.length > 50 ? "…" : ""}</p>}
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={() => openMealForm(day.key, meal)} style={smallBtnStyle}>{meal ? "Edit" : "Plan"}</button>
                      {meal && <button onClick={() => removeMeal(day.key)} style={smallDangerBtnStyle}>Remove</button>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Recipe library */}
        <div style={{ display: "grid", gap: 16, alignContent: "start" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#166534" }}>🍳 Recipes</h3>
            <button onClick={() => setRecipeForm({ ...EMPTY_RECIPE })} style={{ background: "linear-gradient(135deg, #16a34a, #22c55e)", border: "none", color: "#fff", padding: "8px 14px", borderRadius: 12, cursor: "pointer", fontSize: 12, fontWeight: 700, boxShadow: "0 2px 6px rgba(22,163,74,0.2)" }}>New</button>
          </div>
          <input type="text" placeholder="🔍 Search recipes..." value={recipeSearchTerm} onChange={e => setRecipeSearchTerm(e.target.value)}
            style={{ width: "100%", background: "rgba(255,255,255,0.9)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: 12, padding: "10px 14px", color: "#166534", fontSize: 13, boxSizing: "border-box" }} />
          <div style={{ display: "grid", gap: 12, maxHeight: 560, overflowY: "auto", paddingRight: 4 }}>
            {filteredRecipes.length === 0 && (
              <div style={{ color: "#94a3b8", fontSize: 13, padding: 20, textAlign: "center" }}>
                {recipes.length === 0 ? "No recipes yet" : "No matches found"}
              </div>
            )}
            {filteredRecipes.map(recipe => (
              <div key={recipe.id} onClick={() => setRecipeView(recipe)}
                style={{ background: "linear-gradient(135deg, #f8fafc, #f1f5f9)", border: "1px solid rgba(34,197,94,0.1)", borderRadius: 16, padding: 14, cursor: "pointer", transition: "all 0.2s ease" }}
                onMouseEnter={e => { e.currentTarget.style.background = "linear-gradient(135deg, #dcfce7, #bbf7d0)"; e.currentTarget.style.transform = "translateY(-2px)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "linear-gradient(135deg, #f8fafc, #f1f5f9)"; e.currentTarget.style.transform = "translateY(0)"; }}
              >
                {recipe.image && (
                  <div style={{ marginBottom: 10, borderRadius: 12, overflow: "hidden", height: 100 }}>
                    <img src={recipe.image} alt={recipe.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  </div>
                )}
                <h4 style={{ margin: "0 0 6px", fontSize: 14, fontWeight: 700, color: "#166534" }}>{recipe.name}</h4>
                <p style={{ margin: 0, color: "#64748b", fontSize: 12, lineHeight: 1.4 }}>
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
            <h2 style={{ margin: "0 0 20px", fontSize: 20, fontWeight: 800, color: "#166534" }}>
              Plan meal for {weekDays.find(d => d.key === mealForm.day)?.label || mealForm.day}
            </h2>
            <div style={{ display: "grid", gap: 16 }}>
              <div>
                <label style={labelStyle}>Recipe</label>
                <select value={mealForm.recipeId}
                  onChange={e => {
                    const recipe = recipes.find(r => String(r.id) === e.target.value);
                    setMealForm(p => ({ ...p, recipeId: e.target.value, title: p.title.trim() || recipe?.name || "" }));
                  }}
                  style={inputStyle}>
                  <option value="">-- Free fill or choose a recipe --</option>
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
            <h2 style={{ margin: "0 0 20px", fontSize: 20, fontWeight: 800, color: "#166534" }}>{recipeForm.id ? "Edit Recipe" : "New Recipe"}</h2>
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
                  {recipeForm.image ? "📷 Image uploaded" : "Click to upload image"}
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
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
              <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: "#166534" }}>{recipeView.name}</h2>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => { setRecipeForm({ ...recipeView }); setRecipeView(null); }} style={smallBtnStyle}>Edit</button>
                <button onClick={() => setRecipeView(null)} style={cancelBtnStyle}>Close</button>
              </div>
            </div>
            {recipeView.image && (
              <div style={{ marginBottom: 24, textAlign: "center" }}>
                <img src={recipeView.image} alt={recipeView.name} style={{ maxWidth: "100%", maxHeight: 280, borderRadius: 16, boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }} />
              </div>
            )}
            <div style={{ marginBottom: 20 }}>
              <h3 style={{ margin: "0 0 10px", fontSize: 17, fontWeight: 700, color: "#166534" }}>Ingredients</h3>
              <p style={{ margin: 0, color: "#4b5563", lineHeight: 1.6, whiteSpace: "pre-line" }}>{recipeView.ingredients}</p>
            </div>
            <div>
              <h3 style={{ margin: "0 0 10px", fontSize: 17, fontWeight: 700, color: "#166534" }}>Instructions</h3>
              <p style={{ margin: 0, color: "#4b5563", lineHeight: 1.6, whiteSpace: "pre-line" }}>{recipeView.instructions}</p>
            </div>
          </div>
        </div>
      )}

      {/* Delete recipe confirmation */}
      {deleteRecipeId && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setDeleteRecipeId(null)}>
          <div className="modal-box" style={{ maxWidth: 400, textAlign: "center" }}>
            <p style={{ fontSize: 18, marginBottom: 24, color: "#166534" }}>Delete this recipe? This cannot be undone.</p>
            <div style={{ display: "flex", gap: 12 }}>
              <button onClick={() => setDeleteRecipeId(null)} style={cancelBtnStyle}>Cancel</button>
              <button onClick={confirmDeleteRecipe} style={{ ...cancelBtnStyle, background: "rgba(252,165,165,0.1)", border: "1px solid rgba(252,165,165,0.3)", color: "#dc2626" }}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const labelStyle = { fontSize: 14, color: "#4b5563", display: "block", marginBottom: 6, fontWeight: 600 };
const inputStyle = { width: "100%", background: "rgba(255,255,255,0.9)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: 12, padding: "12px 16px", color: "#166634", fontSize: 15, boxSizing: "border-box" };
const uploadBtnStyle = { background: "rgba(255,255,255,0.9)", border: "2px dashed rgba(34,197,94,0.3)", borderRadius: 12, padding: "16px", color: "#16a34a", cursor: "pointer", fontSize: 14, width: "100%", fontWeight: 600 };
const modalFooterStyle = { display: "flex", gap: 12, marginTop: 24 };
const cancelBtnStyle = { flex: 1, padding: "14px", background: "rgba(255,255,255,0.9)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: 12, color: "#64748b", cursor: "pointer", fontSize: 15, fontWeight: 600 };
const primaryBtnStyle = { flex: 2, padding: "14px", background: "linear-gradient(135deg, #16a34a, #22c55e)", border: "none", borderRadius: 12, color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 15 };
const smallBtnStyle = { background: "rgba(255,255,255,0.9)", border: "1px solid rgba(34,197,94,0.2)", color: "#16a34a", borderRadius: 10, padding: "6px 12px", cursor: "pointer", fontSize: 12, fontWeight: 600 };
const smallDangerBtnStyle = { background: "rgba(252,165,165,0.08)", border: "1px solid rgba(252,165,165,0.3)", color: "#dc2626", borderRadius: 10, padding: "6px 12px", cursor: "pointer", fontSize: 12, fontWeight: 600 };
