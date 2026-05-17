import { useState, useEffect, useRef, useCallback } from "react";
import { apiFetch } from "./lib/api";
import Toast from "./components/Toast";
import Sidebar from "./components/Sidebar";
import Dashboard from "./components/Dashboard";
import InvoiceTracker from "./components/InvoiceTracker";
import MealPlanner from "./components/MealPlanner";
import Maintenance from "./components/Maintenance";
import CalendarView from "./components/CalendarView";
import PlantManager from "./components/PlantManager";
import Weather from "./components/Weather";
import LightsManager from "./components/LightsManager";
import ErrorBoundary from "./components/ErrorBoundary";
import "./App.css";

const HOME_TOOLS = [
  { id: "dashboard",   name: "Dashboard",        shortName: "Dashboard", icon: "📊", description: "Overview of paid bills, meal plans, home tasks and calendar events.", active: true },
  { id: "invoices",    name: "Invoice Tracker",   shortName: "Invoices",  icon: "🧾", description: "Track household bills, due dates, and payment status.",             active: true },
  { id: "meal",        name: "Meal Planner",      shortName: "Meals",     icon: "🍽️", description: "Plan meals and weekly menus for the family.",                       active: true },
  { id: "maintenance", name: "Home Maintenance",  shortName: "Maintain",  icon: "🛠️", description: "Store reminders for repairs and periodic chores.",                  active: true },
  { id: "calendar",    name: "Calendar",          shortName: "Calendar",  icon: "📅", description: "Import calendars from multiple providers and see upcoming events.",  active: true },
  { id: "weather",     name: "Weather",           shortName: "Weather",   icon: "☁️", description: "Current conditions and hourly forecast for Houthalen-Helchteren.", active: true },
  { id: "plants",      name: "Plant Manager",     shortName: "Plants",    icon: "🌱", description: "Track watering and feeding schedules for your plants.",             active: true },
  { id: "lights",      name: "Lights",            shortName: "Lights",    icon: "💡", description: "Control Philips Hue lights and rooms.",                              active: true },
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
  const [weatherData, setWeatherData]       = useState(null);
  const [weatherHourly, setWeatherHourly]   = useState([]);
  const [weatherError, setWeatherError]     = useState(null);
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

  const loadWeather = useCallback(async () => {
    setWeatherError(null);
    try {
      const data = await apiFetch("/api/weather");
      setWeatherData(data.current || null);
      setWeatherHourly(data.hourly || []);
    } catch {
      setWeatherError("Unable to load weather data.");
    }
  }, []);

  const refreshWeather = async () => {
    await loadWeather();
    showToast("Weather refreshed");
  };

  useEffect(() => {
    loadWeather();
    const intervalId = setInterval(loadWeather, 60 * 60 * 1000);
    return () => clearInterval(intervalId);
  }, [loadWeather]);

  // Load from backend once on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        const ping = await apiFetch("/api/ping");
        if (!ping?.ok) return;
      } catch {
        return;
      }
      setApiEnabled(true);

      const results = await Promise.allSettled([
        apiFetch("/api/invoices"),
        apiFetch("/api/recipes"),
        apiFetch("/api/meal-plan"),
        apiFetch("/api/maintenance"),
        apiFetch("/api/calendar"),
        apiFetch("/api/plants"),
      ]);

      const [invoiceData, recipeData, mealData, maintenanceData, calendarData, plantData] =
        results.map(r => r.status === "fulfilled" ? r.value : null);

      if (invoiceData) setInvoices(invoiceData);
      if (recipeData) setRecipes(recipeData);
      if (mealData) setMealPlan(mealData);
      if (maintenanceData) setMaintenance(maintenanceData);
      if (calendarData) {
        setCalProviders(calendarData.providers || []);
        setCalEvents(calendarData.events || []);
      }
      if (plantData) setPlants(plantData);
    };

    loadData();
  }, []);

  const refreshCalendars = async () => {
    const urlProviders = calProvidersRef.current.filter(
      p => p.source && !["file upload", "unknown"].includes(p.source)
    );
    if (!urlProviders.length) return;
    let updated = [...calEventsRef.current];
    let changed = false;
    for (const cal of urlProviders) {
      try {
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
      } catch (err) {
        console.warn("Calendar refresh failed for", cal.provider, err.message);
      }
    }
    if (changed) {
      setCalEvents(updated);
      try {
        await apiFetch("/api/calendar", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ providers: calProvidersRef.current, events: updated }),
        });
      } catch (err) {
        console.warn("Failed to persist refreshed calendar events:", err.message);
      }
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
      try {
        const result = await apiFetch(`/api/invoices/${id}`, {
          method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(updated),
        });
        setInvoices(prev => prev.map(i => i.id === id ? result : i));
        showToast("Status updated");
        return;
      } catch (err) {
        showToast(err.message || "Update failed", "danger");
        return;
      }
    }
    setInvoices(prev => prev.map(i => i.id === id ? updated : i));
    showToast("Status updated");
  };

  const toggleMaintenanceDone = async (id) => {
    const task = maintenanceTasks.find(t => t.id === id);
    if (!task) return;
    const updated = { ...task, completed: !task.completed };
    if (apiEnabled) {
      try {
        const result = await apiFetch(`/api/maintenance/${id}`, {
          method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(updated),
        });
        setMaintenance(prev => prev.map(t => t.id === id ? result : t));
        showToast("Task updated");
        return;
      } catch (err) {
        showToast(err.message || "Update failed", "danger");
        return;
      }
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
            <ErrorBoundary key="dashboard">
              <Dashboard
                invoices={invoices} mealPlan={mealPlan} recipes={recipes}
                maintenanceTasks={maintenanceTasks} calendarEvents={calendarEvents}
                weatherData={weatherData} weatherHourly={weatherHourly}
                onNavigate={setActiveTool}
                onToggleInvoicePaid={toggleInvoicePaid}
                onToggleMaintenanceDone={toggleMaintenanceDone}
              />
            </ErrorBoundary>
          )}
          {activeTool === "invoices" && (
            <ErrorBoundary key="invoices">
              <InvoiceTracker invoices={invoices} setInvoices={setInvoices} apiEnabled={apiEnabled} showToast={showToast} />
            </ErrorBoundary>
          )}
          {activeTool === "meal" && (
            <ErrorBoundary key="meal">
              <MealPlanner recipes={recipes} setRecipes={setRecipes} mealPlan={mealPlan} setMealPlan={setMealPlan} apiEnabled={apiEnabled} showToast={showToast} />
            </ErrorBoundary>
          )}
          {activeTool === "maintenance" && (
            <ErrorBoundary key="maintenance">
              <Maintenance maintenanceTasks={maintenanceTasks} setMaintenanceTasks={setMaintenance} apiEnabled={apiEnabled} showToast={showToast} />
            </ErrorBoundary>
          )}
          {activeTool === "calendar" && (
            <ErrorBoundary key="calendar">
              <CalendarView
                calendarProviders={calendarProviders} setCalendarProviders={setCalProviders}
                calendarEvents={calendarEvents} setCalendarEvents={setCalEvents}
                apiEnabled={apiEnabled} showToast={showToast}
                onRefresh={refreshCalendars}
              />
            </ErrorBoundary>
          )}
          {activeTool === "weather" && (
            <ErrorBoundary key="weather">
              <Weather weatherData={weatherData} hourly={weatherHourly} onRefresh={refreshWeather} error={weatherError} />
            </ErrorBoundary>
          )}
          {activeTool === "plants" && (
            <ErrorBoundary key="plants">
              <PlantManager plants={plants} setPlants={setPlants} apiEnabled={apiEnabled} showToast={showToast} />
            </ErrorBoundary>
          )}
          {activeTool === "lights" && (
            <ErrorBoundary key="lights">
              <LightsManager apiEnabled={apiEnabled} showToast={showToast} />
            </ErrorBoundary>
          )}
        </main>
      </div>
    </div>
  );
}
