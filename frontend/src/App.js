import { useState, useEffect, useRef, useCallback } from "react";
import { apiFetch, ApiError } from "./lib/api";
import Toast from "./components/Toast";
import Login from "./components/Login";
import Sidebar from "./components/Sidebar";
import Dashboard from "./components/Dashboard";
import InvoiceTracker from "./components/InvoiceTracker";
import MealPlanner from "./components/MealPlanner";
import Maintenance from "./components/Maintenance";
import CalendarView from "./components/CalendarView";
import PlantManager from "./components/PlantManager";
import ShoppingList from "./components/ShoppingList";
import DocumentVault from "./components/DocumentVault";
import HouseholdContacts from "./components/HouseholdContacts";
import HomeInventory from "./components/HomeInventory";
import Admin from "./components/Admin";
import QuickAddModal from "./components/QuickAddModal";
import ErrorBoundary from "./components/ErrorBoundary";
import "./App.css";

const HOME_TOOLS = [
  { id: "dashboard",   name: "Dashboard",          shortName: "Dashboard", icon: "📊", description: "Overview of paid bills, meal plans, home tasks and calendar events.", active: true,  mobileVisible: true },
  { id: "invoices",    name: "Invoice Tracker",     shortName: "Invoices",  icon: "🧾", description: "Track household bills, due dates, and payment status.",             active: true,  mobileVisible: true },
  { id: "shopping",    name: "Shopping List",       shortName: "Shopping",  icon: "🛒", description: "BRING-style shopping lists per store.",                            active: true,  mobileVisible: true },
  { id: "meal",        name: "Meal Planner",        shortName: "Meals",     icon: "🍽️", description: "Plan meals and weekly menus for the family.",                       active: true,  mobileVisible: true },
  { id: "maintenance", name: "Home Maintenance",    shortName: "Maintain",  icon: "🛠️", description: "Store reminders for repairs and periodic chores.",                  active: true,  mobileVisible: false },
  { id: "calendar",    name: "Calendar",            shortName: "Calendar",  icon: "📅", description: "Import calendars from multiple providers and see upcoming events.",  active: true,  mobileVisible: false },
  { id: "plants",      name: "Plant Manager",       shortName: "Plants",    icon: "🌱", description: "Track watering and feeding schedules for your plants.",             active: true,  mobileVisible: false },
  { id: "documents",   name: "Document Vault",      shortName: "Documents", icon: "📁", description: "Store warranty cards, insurance, and important documents.",         active: true,  mobileVisible: false },
  { id: "contacts",    name: "Household Contacts",  shortName: "Contacts",  icon: "📞", description: "Quick access to your home service contacts.",                       active: true,  mobileVisible: false },
  { id: "inventory",   name: "Home Inventory",      shortName: "Inventory", icon: "🏷️", description: "Track appliances, warranties, and serial numbers.",                 active: true,  mobileVisible: false },
  { id: "admin",       name: "Admin",               shortName: "Admin",     icon: "⚙️", description: "User management, settings, and system stats.",                      active: true,  mobileVisible: false },
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

const adjustColor = (hex, amount) => {
  const n = parseInt(hex.replace("#", ""), 16);
  const r = Math.min(255, Math.max(0, (n >> 16) + amount));
  const g = Math.min(255, Math.max(0, ((n >> 8) & 0xff) + amount));
  const b = Math.min(255, Math.max(0, (n & 0xff) + amount));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
};

export default function App() {
  const [activeTool, setActiveTool]         = useState("dashboard");
  const [invoices, setInvoices]             = useState(() => loadLocal("invoices",          SAMPLE_INVOICES));
  const [recipes, setRecipes]               = useState(() => loadLocal("recipes",           SAMPLE_RECIPES));
  const [mealPlan, setMealPlan]             = useState(() => loadLocal("mealPlan",          {}));
  const [maintenanceTasks, setMaintenance]  = useState(() => loadLocal("maintenanceTasks",  SAMPLE_MAINTENANCE));
  const [calendarProviders, setCalProviders]= useState(() => loadLocal("calendarProviders", []));
  const [calendarEvents, setCalEvents]      = useState(() => loadLocal("calendarEvents",    []));
  const [plants, setPlants]                 = useState(() => loadLocal("plants",    SAMPLE_PLANTS));
  const [shopping, setShopping]             = useState(() => loadLocal("shopping",  { stores: [], items: [] }));
  const [documents, setDocuments]           = useState(() => loadLocal("documents", []));
  const [contacts, setContacts]             = useState(() => loadLocal("contacts",  []));
  const [inventory, setInventory]           = useState(() => loadLocal("inventory", []));
  const [settings, setSettings]             = useState({ appName: "HomeHub", householdName: "", currency: "EUR", accentColor: "#5a7a5e" });
  const [apiEnabled, setApiEnabled]         = useState(false);
  const [currentUser, setCurrentUser]       = useState(null);
  const [needsLogin, setNeedsLogin]         = useState(false);
  const [toast, setToast]                   = useState(null);
  const [quickAddOpen, setQuickAddOpen]     = useState(false);

  const applySettings = useCallback((s) => {
    setSettings(s);
    document.documentElement.style.setProperty("--accent", s.accentColor || "#5a7a5e");
    document.documentElement.style.setProperty("--accent-dark", adjustColor(s.accentColor || "#5a7a5e", -20));
    if (s.appName) document.title = s.appName;
  }, []);

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
  useEffect(() => { try { localStorage.setItem("plants",    JSON.stringify(plants));    } catch {} }, [plants]);
  useEffect(() => { try { localStorage.setItem("shopping",  JSON.stringify(shopping));  } catch {} }, [shopping]);
  useEffect(() => { try { localStorage.setItem("documents", JSON.stringify(documents)); } catch {} }, [documents]);
  useEffect(() => { try { localStorage.setItem("contacts",  JSON.stringify(contacts));  } catch {} }, [contacts]);
  useEffect(() => { try { localStorage.setItem("inventory", JSON.stringify(inventory)); } catch {} }, [inventory]);

  const loadBackendData = useCallback(async () => {
    const results = await Promise.allSettled([
      apiFetch("/api/invoices"),
      apiFetch("/api/recipes"),
      apiFetch("/api/meal-plan"),
      apiFetch("/api/maintenance"),
      apiFetch("/api/calendar"),
      apiFetch("/api/plants"),
      apiFetch("/api/shopping"),
      apiFetch("/api/documents"),
      apiFetch("/api/contacts"),
      apiFetch("/api/inventory"),
      apiFetch("/api/settings"),
    ]);

    const [invoiceData, recipeData, mealData, maintenanceData, calendarData, plantData,
           shoppingData, documentsData, contactsData, inventoryData, settingsData] =
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
    if (shoppingData) setShopping(shoppingData);
    if (documentsData) setDocuments(documentsData);
    if (contactsData) setContacts(contactsData);
    if (inventoryData) setInventory(inventoryData);
    if (settingsData) applySettings(settingsData);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applySettings]);

  // Check auth status on mount
  useEffect(() => {
    const init = async () => {
      try {
        const user = await apiFetch("/api/auth/me");
        setCurrentUser(user);
        setApiEnabled(true);
        await loadBackendData();
      } catch (err) {
        // Any failure (401 or network down) → require login
        setNeedsLogin(true);
      }
    };
    init();
  }, [loadBackendData]);

  const handleLogin = useCallback(async (user) => {
    setCurrentUser(user);
    setNeedsLogin(false);
    setApiEnabled(true);
    await loadBackendData();
  }, [loadBackendData]);

  const handleLogout = useCallback(async () => {
    try { await apiFetch("/api/auth/logout", { method: "POST" }); } catch {}
    setCurrentUser(null);
    setApiEnabled(false);
    setNeedsLogin(true);
  }, []);

  const refreshResource = useCallback(async (resource) => {
    try {
      switch (resource) {
        case "invoices": { const d = await apiFetch("/api/invoices"); if (d) setInvoices(d); break; }
        case "recipes":  { const d = await apiFetch("/api/recipes");  if (d) setRecipes(d);  break; }
        case "mealPlan": { const d = await apiFetch("/api/meal-plan"); if (d) setMealPlan(d); break; }
        case "maintenance": { const d = await apiFetch("/api/maintenance"); if (d) setMaintenance(d); break; }
        case "plants":   { const d = await apiFetch("/api/plants");   if (d) setPlants(d);   break; }
        case "calendar": {
          const d = await apiFetch("/api/calendar");
          if (d) { setCalProviders(d.providers || []); setCalEvents(d.events || []); }
          break;
        }
        case "shopping":   { const d = await apiFetch("/api/shopping");   if (d) setShopping(d);   break; }
        case "documents":  { const d = await apiFetch("/api/documents");  if (d) setDocuments(d);  break; }
        case "contacts":   { const d = await apiFetch("/api/contacts");   if (d) setContacts(d);   break; }
        case "inventory":  { const d = await apiFetch("/api/inventory");  if (d) setInventory(d);  break; }
        case "settings":   { const d = await apiFetch("/api/settings");   if (d) applySettings(d); break; }
        default: break;
      }
    } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!apiEnabled) return;
    const es = new EventSource("/api/events");
    es.onmessage = (e) => {
      try { const { resource } = JSON.parse(e.data); refreshResource(resource); } catch {}
    };
    return () => es.close();
  }, [apiEnabled, refreshResource]);

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

  if (needsLogin) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div className="app-root">
      <Toast toast={toast} />
      {quickAddOpen && (
        <QuickAddModal
          onClose={() => setQuickAddOpen(false)}
          shopping={shopping} setShopping={setShopping}
          setInvoices={setInvoices}
          setMaintenance={setMaintenance}
          setPlants={setPlants}
          apiEnabled={apiEnabled}
          showToast={showToast}
        />
      )}
      <div className="app-layout">
        <Sidebar activeTool={activeTool} setActiveTool={setActiveTool} tools={HOME_TOOLS} showToast={showToast} currentUser={currentUser} onLogout={handleLogout} settings={settings} onOpenQuickAdd={() => setQuickAddOpen(true)} />
        <main className="app-main">
          {activeTool === "dashboard" && (
            <ErrorBoundary key="dashboard">
              <Dashboard
                invoices={invoices} mealPlan={mealPlan} recipes={recipes}
                maintenanceTasks={maintenanceTasks} calendarEvents={calendarEvents}
                shopping={shopping} plants={plants} currentUser={currentUser}
                onNavigate={setActiveTool}
                onToggleInvoicePaid={toggleInvoicePaid}
                onToggleMaintenanceDone={toggleMaintenanceDone}
                onWaterPlant={async (id) => {
                  const plant = plants.find(p => p.id === id);
                  if (!plant) return;
                  const updated = { ...plant, lastWatered: new Date().toISOString().slice(0, 10) };
                  if (apiEnabled) {
                    try {
                      const result = await apiFetch(`/api/plants/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(updated) });
                      setPlants(prev => prev.map(p => p.id === id ? result : p));
                      showToast("Watered!");
                      return;
                    } catch {}
                  }
                  setPlants(prev => prev.map(p => p.id === id ? updated : p));
                  showToast("Watered!");
                }}
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
          {activeTool === "plants" && (
            <ErrorBoundary key="plants">
              <PlantManager plants={plants} setPlants={setPlants} apiEnabled={apiEnabled} showToast={showToast} />
            </ErrorBoundary>
          )}
          {activeTool === "shopping" && (
            <ErrorBoundary key="shopping">
              <ShoppingList shopping={shopping} setShopping={setShopping} apiEnabled={apiEnabled} showToast={showToast} />
            </ErrorBoundary>
          )}
          {activeTool === "documents" && (
            <ErrorBoundary key="documents">
              <DocumentVault documents={documents} setDocuments={setDocuments} apiEnabled={apiEnabled} showToast={showToast} />
            </ErrorBoundary>
          )}
          {activeTool === "contacts" && (
            <ErrorBoundary key="contacts">
              <HouseholdContacts contacts={contacts} setContacts={setContacts} apiEnabled={apiEnabled} showToast={showToast} />
            </ErrorBoundary>
          )}
          {activeTool === "inventory" && (
            <ErrorBoundary key="inventory">
              <HomeInventory inventory={inventory} setInventory={setInventory} apiEnabled={apiEnabled} showToast={showToast} />
            </ErrorBoundary>
          )}
          {activeTool === "admin" && currentUser?.role === "admin" && (
            <ErrorBoundary key="admin">
              <Admin currentUser={currentUser} settings={settings} applySettings={applySettings} apiEnabled={apiEnabled} showToast={showToast} />
            </ErrorBoundary>
          )}
        </main>
      </div>
    </div>
  );
}
