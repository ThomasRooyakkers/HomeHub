import { useState, useEffect, useRef } from "react";
import { apiFetch } from "./lib/api";
import Toast from "./components/Toast";
import Sidebar from "./components/Sidebar";
import Dashboard from "./components/Dashboard";
import InvoiceTracker from "./components/InvoiceTracker";
import MealPlanner from "./components/MealPlanner";
import Maintenance from "./components/Maintenance";
import CalendarView from "./components/CalendarView";
import PlantManager from "./components/PlantManager";
import "./App.css";

const HOME_TOOLS = [
  { id: "dashboard",   name: "Dashboard",        shortName: "Dashboard", icon: "📊", description: "Overview of paid bills, meal plans, home tasks and calendar events.", active: true },
  { id: "invoices",    name: "Invoice Tracker",   shortName: "Invoices",  icon: "🧾", description: "Track household bills, due dates, and payment status.",             active: true },
  { id: "meal",        name: "Meal Planner",      shortName: "Meals",     icon: "🍽️", description: "Plan meals and weekly menus for the family.",                       active: true },
  { id: "maintenance", name: "Home Maintenance",  shortName: "Maintain",  icon: "🛠️", description: "Store reminders for repairs and periodic chores.",                  active: true },
  { id: "calendar",    name: "Calendar",          shortName: "Calendar",  icon: "📅", description: "Import calendars from multiple providers and see upcoming events.",  active: true },
  { id: "plants",      name: "Plant Manager",     shortName: "Plants",    icon: "🌱", description: "Track watering and feeding schedules for your plants.",             active: true },
];

const SAMPLE_INVOICES = [
  { id: 1, vendor: "Engie",      amount: 187.5, dueDate: "2026-04-15", invoiceNo: "ENG-2026-0041", notes: "Gas & electricity", status: "overdue", file: null },
  { id: 2, vendor: "Proximus",   amount: 49.99, dueDate: "2026-05-20", invoiceNo: "PRX-88210",     notes: "Internet & TV",    status: "unpaid",  file: null },
  { id: 3, vendor: "Water-link", amount: 62.0,  dueDate: "2026-04-30", invoiceNo: "WL-2026-112",   notes: "Water Q1",         status: "paid",    file: null },
];

const SAMPLE_RECIPES = [
  { id: 1, name: "Spaghetti Bolognese",     ingredients: "Pasta, minced beef, tomato sauce, onion, garlic, herbs",                   instructions: "Cook pasta; brown beef with onion and garlic; add tomato sauce and simmer; serve over pasta.", image: null },
  { id: 2, name: "Sheet Pan Chicken Veggies", ingredients: "Chicken thighs, carrots, potatoes, broccoli, olive oil, salt, pepper", instructions: "Toss ingredients with oil and seasoning; bake at 200°C for 35 minutes.",                        image: null },
];

const SAMPLE_MAINTENANCE = [
  { id: 1, title: "Check Smoke Detectors", frequency: "monthly", nextDue: new Date().toISOString().slice(0, 10), instructions: "Test each smoke detector in the house and replace batteries if needed.", photo: null, completed: false },
];

const SAMPLE_PLANTS = [
  { id: 1, name: "Basil", wateringFrequency: "weekly", lastWatered: "", feedingFrequency: "monthly", lastFed: "", notes: "Keep in sunny window, pinch leaves regularly." },
];

const loadLocal = (key, fallback) => {
  try { return JSON.parse(localStorage.getItem(key) || "null") || fallback; } catch { return fallback; }
};

export default function App() {
  const [activeTool, setActiveTool]         = useState("dashboard");
  const [invoices, setInvoices]             = useState(() => loadLocal("invoices",          SAMPLE_INVOICES));
  const [recipes, setRecipes]               = useState(() => loadLocal("recipes",           SAMPLE_RECIPES));
  const [mealPlan, setMealPlan]             = useState(() => loadLocal("mealPlan",          {}));
  const [maintenanceTasks, setMaintenance]  = useState(() => loadLocal("maintenanceTasks",  SAMPLE_MAINTENANCE));
  const [calendarProviders, setCalProviders]= useState(() => loadLocal("calendarProviders", []));
  const [calendarEvents, setCalEvents]      = useState(() => loadLocal("calendarEvents",    []));
  const [plants, setPlants]                 = useState(() => loadLocal("plants",             SAMPLE_PLANTS));
  const [apiEnabled, setApiEnabled]         = useState(false);
  const [toast, setToast]                   = useState(null);

  const calProvidersRef = useRef(calendarProviders);
  const calEventsRef    = useRef(calendarEvents);
  useEffect(() => { calProvidersRef.current = calendarProviders; }, [calendarProviders]);
  useEffect(() => { calEventsRef.current    = calendarEvents;    }, [calendarEvents]);

  // Persist to localStorage
  useEffect(() => { try { localStorage.setItem("invoices",          JSON.stringify(invoices));         } catch {} }, [invoices]);
  useEffect(() => { try { localStorage.setItem("recipes",           JSON.stringify(recipes));          } catch {} }, [recipes]);
  useEffect(() => { try { localStorage.setItem("mealPlan",          JSON.stringify(mealPlan));         } catch {} }, [mealPlan]);
  useEffect(() => { try { localStorage.setItem("maintenanceTasks",  JSON.stringify(maintenanceTasks)); } catch {} }, [maintenanceTasks]);
  useEffect(() => { try { localStorage.setItem("calendarProviders", JSON.stringify(calendarProviders));} catch {} }, [calendarProviders]);
  useEffect(() => { try { localStorage.setItem("calendarEvents",    JSON.stringify(calendarEvents));   } catch {} }, [calendarEvents]);
  useEffect(() => { try { localStorage.setItem("plants",            JSON.stringify(plants));           } catch {} }, [plants]);

  // Load from backend once on mount
  useEffect(() => {
    (async () => {
      const ping = await apiFetch("/api/ping");
      if (!ping?.ok) return;
      setApiEnabled(true);

      const [invoiceData, recipeData, mealData, maintenanceData, calendarData, plantData] = await Promise.all([
        apiFetch("/api/invoices"),
        apiFetch("/api/recipes"),
        apiFetch("/api/meal-plan"),
        apiFetch("/api/maintenance"),
        apiFetch("/api/calendar"),
        apiFetch("/api/plants"),
      ]);

      if (invoiceData)   setInvoices(invoiceData);
      if (recipeData)    setRecipes(recipeData);
      if (mealData)      setMealPlan(mealData);
      if (maintenanceData) setMaintenance(maintenanceData);
      if (calendarData) {
        setCalProviders(calendarData.providers || []);
        setCalEvents(calendarData.events || []);
      }
      if (plantData)     setPlants(plantData);
    })();
  }, []);

  const refreshCalendars = async () => {
    const urlProviders = calProvidersRef.current.filter(
      p => p.source && !["file upload", "unknown"].includes(p.source)
    );
    if (!urlProviders.length) return;
    let updated = [...calEventsRef.current];
    let changed = false;
    for (const cal of urlProviders) {
      const data = await apiFetch("/api/calendar-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: cal.source, provider: cal.provider }),
      });
      if (data?.events?.length) {
        updated = [
          ...updated.filter(e => e.calendarId !== cal.id),
          ...data.events.map(ev => ({ ...ev, calendarId: cal.id })),
        ];
        changed = true;
      }
    }
    if (changed) {
      setCalEvents(updated);
      apiFetch("/api/calendar", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ providers: calProvidersRef.current, events: updated }),
      });
    }
  };

  useEffect(() => {
    if (!apiEnabled) return;
    const id = setInterval(refreshCalendars, 60 * 60 * 1000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiEnabled]);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2800);
  };

  const toggleInvoicePaid = async (id) => {
    const invoice = invoices.find(i => i.id === id);
    if (!invoice) return;
    const updated = { ...invoice, status: invoice.status === "paid" ? "unpaid" : "paid" };
    if (apiEnabled) {
      const result = await apiFetch(`/api/invoices/${id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(updated),
      });
      if (result) { setInvoices(prev => prev.map(i => i.id === id ? result : i)); showToast("Status updated"); return; }
    }
    setInvoices(prev => prev.map(i => i.id === id ? updated : i));
    showToast("Status updated");
  };

  const toggleMaintenanceDone = async (id) => {
    const task = maintenanceTasks.find(t => t.id === id);
    if (!task) return;
    const updated = { ...task, completed: !task.completed };
    if (apiEnabled) {
      const result = await apiFetch(`/api/maintenance/${id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(updated),
      });
      if (result) { setMaintenance(prev => prev.map(t => t.id === id ? result : t)); showToast("Task updated"); return; }
    }
    setMaintenance(prev => prev.map(t => t.id === id ? updated : t));
    showToast("Task updated");
  };

  return (
    <div className="app-root">
      <Toast toast={toast} />
      <div className="app-layout">
        <Sidebar activeTool={activeTool} setActiveTool={setActiveTool} tools={HOME_TOOLS} showToast={showToast} />
        <main className="app-main">
          {activeTool === "dashboard" && (
            <Dashboard
              invoices={invoices} mealPlan={mealPlan} recipes={recipes}
              maintenanceTasks={maintenanceTasks} calendarEvents={calendarEvents}
              onNavigate={setActiveTool}
              onToggleInvoicePaid={toggleInvoicePaid}
              onToggleMaintenanceDone={toggleMaintenanceDone}
            />
          )}
          {activeTool === "invoices" && (
            <InvoiceTracker invoices={invoices} setInvoices={setInvoices} apiEnabled={apiEnabled} showToast={showToast} />
          )}
          {activeTool === "meal" && (
            <MealPlanner recipes={recipes} setRecipes={setRecipes} mealPlan={mealPlan} setMealPlan={setMealPlan} apiEnabled={apiEnabled} showToast={showToast} />
          )}
          {activeTool === "maintenance" && (
            <Maintenance maintenanceTasks={maintenanceTasks} setMaintenanceTasks={setMaintenance} apiEnabled={apiEnabled} showToast={showToast} />
          )}
          {activeTool === "calendar" && (
            <CalendarView
              calendarProviders={calendarProviders} setCalendarProviders={setCalProviders}
              calendarEvents={calendarEvents} setCalendarEvents={setCalEvents}
              apiEnabled={apiEnabled} showToast={showToast}
              onRefresh={refreshCalendars}
            />
          )}
          {activeTool === "plants" && (
            <PlantManager plants={plants} setPlants={setPlants} apiEnabled={apiEnabled} showToast={showToast} />
          )}
        </main>
      </div>
    </div>
  );
}
