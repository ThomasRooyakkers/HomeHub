import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { apiFetch } from "./lib/api";
import { cacheUserProfile, clearCachedUserProfile, enqueueSync, loadCachedUserProfile, loadSyncQueue, replaySyncQueue } from "./lib/offlineSync";
import Toast from "./components/Toast";
import Login from "./components/Login";
import Sidebar from "./components/Sidebar";
import Dashboard from "./components/Dashboard";
import InvoiceTracker from "./components/InvoiceTracker";
import MealPlanner from "./components/MealPlanner";
import TodoTasks from "./components/TodoTasks";
import Maintenance from "./components/Maintenance";
import CalendarView from "./components/CalendarView";
import PlantManager from "./components/PlantManager";
import ShoppingList from "./components/ShoppingList";
import DocumentVault from "./components/DocumentVault";
import HouseholdContacts from "./components/HouseholdContacts";
import HomeInventory from "./components/HomeInventory";
import Admin from "./components/Admin";
import QuickAddModal from "./components/QuickAddModal";
import GlobalSearch from "./components/GlobalSearch";
import ErrorBoundary from "./components/ErrorBoundary";
import "./App.css";

const HOME_TOOLS = [
  { id: "dashboard",   name: "Dashboard",          shortName: "Dashboard", icon: "📊", description: "Overview of paid bills, meal plans, home tasks and calendar events.", active: true,  mobileVisible: true },
  { id: "invoices",    name: "Invoice Tracker",     shortName: "Invoices",  icon: "🧾", description: "Track household bills, due dates, and payment status.",             active: true,  mobileVisible: true },
  { id: "shopping",    name: "Shopping List",       shortName: "Shopping",  icon: "🛒", description: "BRING-style shopping lists per store.",                            active: true,  mobileVisible: true },
  { id: "meal",        name: "Meal Planner",        shortName: "Meals",     icon: "🍽️", description: "Plan meals and weekly menus for the family.",                       active: true,  mobileVisible: true },
  { id: "tasks",       name: "Tasks",               shortName: "Tasks",     icon: "OK", description: "Plan one-time and recurring household tasks.",                         active: true,  mobileVisible: true },
  { id: "maintenance", name: "Home Maintenance",    shortName: "Maintain",  icon: "🛠️", description: "Store reminders for repairs and periodic chores.",                  active: true,  mobileVisible: false },
  { id: "calendar",    name: "Calendar",            shortName: "Calendar",  icon: "📅", description: "Import calendars from multiple providers and see upcoming events.",  active: true,  mobileVisible: false },
  { id: "plants",      name: "Plant Manager",       shortName: "Plants",    icon: "🌱", description: "Track watering and feeding schedules for your plants.",             active: true,  mobileVisible: false },
  { id: "documents",   name: "Document Vault",      shortName: "Documents", icon: "📁", description: "Store warranty cards, insurance, and important documents.",         active: true,  mobileVisible: false },
  { id: "contacts",    name: "Household Contacts",  shortName: "Contacts",  icon: "📞", description: "Quick access to your home service contacts.",                       active: true,  mobileVisible: false },
  { id: "inventory",   name: "Home Inventory",      shortName: "Inventory", icon: "🏷️", description: "Track appliances, warranties, and serial numbers.",                 active: true,  mobileVisible: false },
  { id: "admin",       name: "Admin",               shortName: "Admin",     icon: "⚙️", description: "User management, settings, and system stats.",                      active: true,  mobileVisible: false },
];

const DEFAULT_ENABLED_FEATURES = HOME_TOOLS
  .filter(tool => !["dashboard", "admin"].includes(tool.id))
  .reduce((features, tool) => ({ ...features, [tool.id]: true }), {});

const DEFAULT_SETTINGS = {
  appName: "HomeHub",
  householdName: "",
  currency: "EUR",
  accentColor: "#5a7a5e",
  location: "New York",
  enabledFeatures: DEFAULT_ENABLED_FEATURES,
};

const SAMPLE_INVOICES = [
  { id: 1, vendor: "Engie",      amount: 187.5, dueDate: "2026-04-15", invoiceNo: "ENG-2026-0041", notes: "Gas & electricity", status: "overdue", file: null },
  { id: 2, vendor: "Proximus",   amount: 49.99, dueDate: "2026-05-20", invoiceNo: "PRX-88210",     notes: "Internet & TV",    status: "unpaid",  file: null },
  { id: 3, vendor: "Water-link", amount: 62.0,  dueDate: "2026-04-30", invoiceNo: "WL-2026-112",   notes: "Water Q1",         status: "paid",    file: null },
];

const SAMPLE_RECIPES = [
  { id: 1, name: "Miso glazed salmon", description: "with jasmine rice & greens", category: "Fish", isFavourite: false, prepTime: 10, cookTime: 15, servings: 4, ingredients: "Salmon fillets\nWhite miso paste\nSoy sauce\nHoney\nGarlic\nJasmine rice\nBok choy", instructions: "Mix miso, soy, honey and garlic for the glaze.\nMarinate salmon for 10 minutes.\nCook rice according to packet instructions.\nBrush salmon with glaze and grill for 12–15 minutes.\nSteam bok choy until tender. Serve together.", image: null },
  { id: 2, name: "Pasta puttanesca", description: "bucatini, olives & capers", category: "Pasta", isFavourite: false, prepTime: 10, cookTime: 20, servings: 4, ingredients: "Bucatini\nTinned tomatoes\nGarlic cloves\nAnchovy fillets\nCapers\nKalamata olives\nChilli flakes\nFlat-leaf parsley", instructions: "Salt the water generously and cook the bucatini until just shy of al dente. Reserve a mug of pasta water.\nMelt the anchovies in olive oil over medium heat. Add garlic and chilli, cook 1 minute.\nAdd tomatoes, olives and capers. Simmer 10 minutes.\nToss pasta in the sauce with a splash of pasta water.\nFinish with chopped parsley.", image: null },
  { id: 3, name: "Roast chicken", description: "lemon, garlic & thyme", category: "Meat", isFavourite: true, prepTime: 15, cookTime: 80, servings: 5, ingredients: "Whole chicken\nLemon\nGarlic bulb\nFresh thyme\nButter\nOlive oil\nSalt & pepper", instructions: "Preheat oven to 200°C.\nStuff cavity with lemon halves, garlic and thyme.\nRub butter under skin and all over outside.\nSeason generously and roast for 1 hour 20 minutes.\nRest for 15 minutes before carving.", image: null },
  { id: 4, name: "Red lentil curry", description: "coconut & spinach dahl", category: "Veg", isFavourite: true, prepTime: 10, cookTime: 30, servings: 4, ingredients: "Red lentils\nCoconut milk\nTinned tomatoes\nSpinach\nOnion\nGarlic\nGinger\nCumin\nCoriander\nTurmeric\nGaram masala", instructions: "Fry onion, garlic and ginger until soft.\nAdd spices and toast for 1 minute.\nStir in lentils, tomatoes and coconut milk.\nSimmer 25 minutes until lentils are tender.\nWilt in spinach and season to taste. Serve with rice or naan.", image: null },
  { id: 5, name: "Weeknight tacos", description: "spiced beef with avocado crema", category: "Meat", isFavourite: false, prepTime: 15, cookTime: 25, servings: 4, ingredients: "Minced beef\nCorn tortillas\nAvocado\nLime\nCumin\nSmoked paprika\nGarlic\nOnion\nCoriander\nSoured cream", instructions: "Brown beef with onion, garlic and spices.\nWarm tortillas in a dry pan.\nBlend avocado, lime juice and soured cream for the crema.\nAssemble tacos with beef, crema and fresh coriander.", image: null },
  { id: 6, name: "Shakshuka", description: "eggs poached in spiced tomato", category: "Veg", isFavourite: false, prepTime: 5, cookTime: 25, servings: 2, ingredients: "Eggs\nTinned tomatoes\nRed pepper\nOnion\nGarlic\nCumin\nPaprika\nChilli\nFeta\nFlat bread", instructions: "Fry onion and pepper until soft.\nAdd garlic and spices, cook 1 minute.\nPour in tomatoes and simmer 10 minutes.\nMake wells and crack in eggs.\nCover and cook until whites are set. Top with crumbled feta.", image: null },
  { id: 7, name: "Banana bread", description: "walnuts & brown butter", category: "Baking", isFavourite: true, prepTime: 15, cookTime: 55, servings: 8, ingredients: "Ripe bananas\nPlain flour\nBrown sugar\nButter\nEggs\nWalnuts\nVanilla\nBaking powder\nSalt", instructions: "Preheat oven to 180°C. Grease a loaf tin.\nBrown the butter in a pan and cool slightly.\nMash bananas and mix with butter, sugar, eggs and vanilla.\nFold in flour, baking powder and salt.\nStir in walnuts. Pour into tin and bake 50–55 minutes.", image: null },
  { id: 8, name: "Grilled sea bass", description: "with caponata", category: "Fish", isFavourite: false, prepTime: 20, cookTime: 30, servings: 2, ingredients: "Sea bass fillets\nAubergine\nTomatoes\nRaisins\nCapers\nCelery\nOlives\nRed wine vinegar\nOlive oil\nBasil", instructions: "Fry aubergine until golden. Set aside.\nSauté celery and tomatoes 5 minutes. Add olives, capers, raisins and vinegar.\nAdd aubergine back and simmer 10 minutes for caponata.\nScore and season sea bass. Grill skin side down 3–4 minutes per side.\nServe fish on caponata topped with basil.", image: null },
  { id: 9, name: "Caesar salad", description: "classic anchovy dressing", category: "Veg", isFavourite: false, prepTime: 20, cookTime: 10, servings: 2, ingredients: "Romaine lettuce\nParmesan\nAnchovies\nGarlic\nLemon\nOlive oil\nEgg yolk\nDijon mustard\nSourdough croutons", instructions: "Blend anchovy, garlic, egg yolk, mustard and lemon for dressing.\nWhisk in olive oil until emulsified.\nToast cubed sourdough in butter for croutons.\nToss lettuce with dressing and parmesan. Top with croutons.", image: null },
  { id: 10, name: "Chocolate fondant", description: "molten centre, vanilla ice cream", category: "Baking", isFavourite: true, prepTime: 20, cookTime: 12, servings: 4, ingredients: "Dark chocolate\nButter\nEggs\nEgg yolks\nCaster sugar\nPlain flour\nVanilla ice cream", instructions: "Melt chocolate and butter together. Cool slightly.\nWhisk eggs, yolks and sugar until pale and doubled.\nFold chocolate into egg mixture, then flour.\nPour into buttered ramekins. Chill 30 minutes.\nBake at 200°C for 12 minutes. Turn out and serve immediately with ice cream.", image: null },
];

const SAMPLE_MAINTENANCE = [
  { id: 1, title: "Check Smoke Detectors", frequency: "monthly", nextDue: new Date().toISOString().slice(0, 10), instructions: "Test each smoke detector in the house and replace batteries if needed.", photo: null, completed: false },
];

const SAMPLE_TASKS = { items: [], completions: {} };

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
  const [tasks, setTasks]                   = useState(() => loadLocal("tasks",             SAMPLE_TASKS));
  const [maintenanceTasks, setMaintenance]  = useState(() => loadLocal("maintenanceTasks",  SAMPLE_MAINTENANCE));
  const [calendarProviders, setCalProviders]= useState(() => loadLocal("calendarProviders", []));
  const [calendarEvents, setCalEvents]      = useState(() => loadLocal("calendarEvents",    []));
  const [plants, setPlants]                 = useState(() => loadLocal("plants",    SAMPLE_PLANTS));
  const [shopping, setShopping]             = useState(() => loadLocal("shopping",  { stores: [], items: [] }));
  const [documents, setDocuments]           = useState(() => loadLocal("documents", []));
  const [contacts, setContacts]             = useState(() => loadLocal("contacts",  []));
  const [inventory, setInventory]           = useState(() => loadLocal("inventory", []));
  const [recurringInvoices, setRecurringInvoices] = useState(() => loadLocal("recurringInvoices", []));
  const [settings, setSettings]             = useState(() => loadLocal("settings", DEFAULT_SETTINGS));
  const [apiEnabled, setApiEnabled]         = useState(false);
  const [currentUser, setCurrentUser]       = useState(null);
  const [users, setUsers]                   = useState([]);
  const [needsLogin, setNeedsLogin]         = useState(false);
  const [authChecked, setAuthChecked]       = useState(false);
  const [toast, setToast]                   = useState(null);
  const [quickAddOpen, setQuickAddOpen]     = useState(false);
  const [searchOpen, setSearchOpen]         = useState(false);
  const [syncStatus, setSyncStatus]         = useState("online");
  const [syncQueueCount, setSyncQueueCount] = useState(() => loadSyncQueue().length);

  const applySettings = useCallback((s) => {
    const normalized = {
      ...DEFAULT_SETTINGS,
      ...s,
      enabledFeatures: { ...DEFAULT_ENABLED_FEATURES, ...(s?.enabledFeatures || {}) },
    };
    setSettings(normalized);
    document.documentElement.style.setProperty("--accent", normalized.accentColor || "#5a7a5e");
    document.documentElement.style.setProperty("--accent-dark", adjustColor(normalized.accentColor || "#5a7a5e", -20));
    if (normalized.appName) document.title = normalized.appName;
  }, []);

  const enabledFeatures = useMemo(
    () => ({ ...DEFAULT_ENABLED_FEATURES, ...(settings.enabledFeatures || {}) }),
    [settings.enabledFeatures]
  );
  const isFeatureEnabled = useCallback((toolId) => (
    ["dashboard", "admin"].includes(toolId) || enabledFeatures[toolId] !== false
  ), [enabledFeatures]);
  const enabledTools = useMemo(() => HOME_TOOLS.filter(tool => isFeatureEnabled(tool.id)), [isFeatureEnabled]);

  const calProvidersRef = useRef(calendarProviders);
  const calEventsRef    = useRef(calendarEvents);
  useEffect(() => { calProvidersRef.current = calendarProviders; }, [calendarProviders]);
  useEffect(() => { calEventsRef.current    = calendarEvents;    }, [calendarEvents]);

  // Persist to localStorage
  useEffect(() => { try { localStorage.setItem("invoices",          JSON.stringify(invoices));         } catch {} }, [invoices]);
  useEffect(() => { try { localStorage.setItem("recipes",           JSON.stringify(recipes));          } catch {} }, [recipes]);
  useEffect(() => { try { localStorage.setItem("mealPlan",          JSON.stringify(mealPlan));         } catch {} }, [mealPlan]);
  useEffect(() => { try { localStorage.setItem("tasks",             JSON.stringify(tasks));            } catch {} }, [tasks]);
  useEffect(() => { try { localStorage.setItem("maintenanceTasks",  JSON.stringify(maintenanceTasks)); } catch {} }, [maintenanceTasks]);
  useEffect(() => { try { localStorage.setItem("calendarProviders", JSON.stringify(calendarProviders));} catch {} }, [calendarProviders]);
  useEffect(() => { try { localStorage.setItem("calendarEvents",    JSON.stringify(calendarEvents));   } catch {} }, [calendarEvents]);
  useEffect(() => { try { localStorage.setItem("plants",    JSON.stringify(plants));    } catch {} }, [plants]);
  useEffect(() => { try { localStorage.setItem("shopping",  JSON.stringify(shopping));  } catch {} }, [shopping]);
  useEffect(() => { try { localStorage.setItem("documents", JSON.stringify(documents)); } catch {} }, [documents]);
  useEffect(() => { try { localStorage.setItem("contacts",  JSON.stringify(contacts));  } catch {} }, [contacts]);
  useEffect(() => { try { localStorage.setItem("inventory", JSON.stringify(inventory)); } catch {} }, [inventory]);
  useEffect(() => { try { localStorage.setItem("recurringInvoices", JSON.stringify(recurringInvoices)); } catch {} }, [recurringInvoices]);
  useEffect(() => { try { localStorage.setItem("settings", JSON.stringify(settings)); } catch {} }, [settings]);

  useEffect(() => {
    if (!isFeatureEnabled(activeTool)) setActiveTool("dashboard");
  }, [activeTool, isFeatureEnabled]);

  const loadBackendData = useCallback(async () => {
    const results = await Promise.allSettled([
      apiFetch("/api/invoices"),
      apiFetch("/api/recipes"),
      apiFetch("/api/meal-plan"),
      apiFetch("/api/tasks"),
      apiFetch("/api/maintenance"),
      apiFetch("/api/calendar"),
      apiFetch("/api/plants"),
      apiFetch("/api/shopping"),
      apiFetch("/api/documents"),
      apiFetch("/api/contacts"),
      apiFetch("/api/inventory"),
      apiFetch("/api/settings"),
      apiFetch("/api/users"),
      apiFetch("/api/recurring-invoices"),
    ]);

    const [invoiceData, recipeData, mealData, tasksData, maintenanceData, calendarData, plantData,
           shoppingData, documentsData, contactsData, inventoryData, settingsData, usersData, recurringData] =
      results.map(r => r.status === "fulfilled" ? r.value : null);

    if (invoiceData) setInvoices(invoiceData);
    if (recipeData) setRecipes(recipeData);
    if (mealData) setMealPlan(mealData);
    if (tasksData) setTasks(tasksData);
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
    if (usersData) setUsers(usersData);
    if (recurringData) setRecurringInvoices(recurringData);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applySettings]);

  const queueMutation = useCallback((mutation) => {
    const next = enqueueSync(mutation);
    setSyncQueueCount(next.length);
    setSyncStatus("offline");
  }, []);

  const flushSyncQueue = useCallback(async () => {
    if (!loadSyncQueue().length) return;
    setSyncStatus("syncing");
    const remaining = await replaySyncQueue();
    setSyncQueueCount(remaining.length);
    if (remaining.length === 0) {
      setSyncStatus("online");
      await loadBackendData();
    } else {
      setSyncStatus("offline");
    }
  }, [loadBackendData]);

  // Check auth status on mount
  useEffect(() => {
    const init = async () => {
      try {
        const user = await apiFetch("/api/auth/me");
        cacheUserProfile(user);
        setCurrentUser(user);
        setApiEnabled(true);
        setSyncStatus("online");
        await loadBackendData();
        await flushSyncQueue();
      } catch (err) {
        // Any failure (401 or network down) → require login, no offline access
        const cachedUser = err?.status ? null : loadCachedUserProfile();
        if (cachedUser) {
          setCurrentUser(cachedUser);
          setApiEnabled(false);
          setNeedsLogin(false);
          setSyncStatus("offline");
          setSyncQueueCount(loadSyncQueue().length);
        } else {
          setNeedsLogin(true);
        }
      } finally {
        setAuthChecked(true);
      }
    };
    init();
  }, [loadBackendData, flushSyncQueue]);

  const handleLogin = useCallback(async (user) => {
    cacheUserProfile(user);
    setCurrentUser(user);
    setNeedsLogin(false);
    setApiEnabled(true);
    setSyncStatus("online");
    await loadBackendData();
    await flushSyncQueue();
  }, [loadBackendData, flushSyncQueue]);

  const handleLogout = useCallback(async () => {
    try { await apiFetch("/api/auth/logout", { method: "POST" }); } catch {}
    clearCachedUserProfile();
    setCurrentUser(null);
    setApiEnabled(false);
    setNeedsLogin(true);
  }, []);

  useEffect(() => {
    const tryReconnect = () => {
      apiFetch("/api/ping")
        .then(async () => {
          setApiEnabled(true);
          setSyncStatus("online");
          await flushSyncQueue();
        })
        .catch(() => setSyncStatus("offline"));
    };
    window.addEventListener("online", tryReconnect);
    return () => window.removeEventListener("online", tryReconnect);
  }, [flushSyncQueue]);

  useEffect(() => {
    if (apiEnabled || needsLogin) return;
    const id = setInterval(() => {
      apiFetch("/api/ping")
        .then(async () => {
          setApiEnabled(true);
          setSyncStatus("online");
          await flushSyncQueue();
        })
        .catch(() => setSyncStatus("offline"));
    }, 15000);
    return () => clearInterval(id);
  }, [apiEnabled, needsLogin, flushSyncQueue]);

  const refreshResource = useCallback(async (resource) => {
    try {
      switch (resource) {
        case "invoices": { const d = await apiFetch("/api/invoices"); if (d) setInvoices(d); break; }
        case "recipes":  { const d = await apiFetch("/api/recipes");  if (d) setRecipes(d);  break; }
        case "mealPlan": { const d = await apiFetch("/api/meal-plan"); if (d) setMealPlan(d); break; }
        case "tasks": { const d = await apiFetch("/api/tasks"); if (d) setTasks(d); break; }
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
        case "users":      { const d = await apiFetch("/api/users");      if (d) setUsers(d);      break; }
        case "recurringInvoices": { const d = await apiFetch("/api/recurring-invoices"); if (d) setRecurringInvoices(d); break; }
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
    let providers = [...calProvidersRef.current];
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
            ...data.events.map(ev => ({ ...ev, calendarId: cal.id, color: cal.color })),
          ];
          providers = providers.map(p => p.id === cal.id ? { ...p, lastRefreshAt: new Date().toISOString(), lastError: "", eventCount: data.events.length } : p);
          changed = true;
        }
      } catch (err) {
        providers = providers.map(p => p.id === cal.id ? { ...p, lastError: err.message || "Refresh failed" } : p);
        changed = true;
        console.warn("Calendar refresh failed for", cal.provider, err.message);
      }
    }
    if (changed) {
      setCalEvents(updated);
      setCalProviders(providers);
      try {
        await apiFetch("/api/calendar", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ providers, events: updated }),
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

  useEffect(() => {
    const onKey = (event) => {
      const tag = event.target?.tagName;
      const isTyping = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || event.target?.isContentEditable;
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen(true);
        return;
      }
      if (!isTyping && event.key === "/") {
        event.preventDefault();
        setSearchOpen(true);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const searchData = useMemo(() => ({
    invoices,
    documents,
    contacts,
    inventory,
    recipes,
    tasks,
    maintenanceTasks,
    calendarEvents,
  }), [invoices, documents, contacts, inventory, recipes, tasks, maintenanceTasks, calendarEvents]);

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
    queueMutation({ method: "PUT", endpoint: `/api/invoices/${id}`, body: updated, resource: "invoices", tempId: id });
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
    queueMutation({ method: "PUT", endpoint: `/api/maintenance/${id}`, body: updated, resource: "maintenance", tempId: id });
    showToast("Task updated");
  };

  // Don't render anything (not even cached localStorage data) until the auth
  // check resolves — prevents a flash of content before login is enforced.
  if (!authChecked) {
    return (
      <div style={{
        minHeight: "100vh",
        background: "var(--g-bg)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "var(--g-muted)",
        fontFamily: "var(--g-sans)",
        fontSize: 14,
      }}>
        Loading…
      </div>
    );
  }

  if (needsLogin) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div className="app-root">
      <Toast toast={toast} />
      <GlobalSearch
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        onNavigate={setActiveTool}
        searchData={searchData}
        enabledFeatures={enabledFeatures}
      />
      {quickAddOpen && (
        <QuickAddModal
          onClose={() => setQuickAddOpen(false)}
          shopping={shopping} setShopping={setShopping}
          setInvoices={setInvoices}
          setMaintenance={setMaintenance}
          setPlants={setPlants}
          apiEnabled={apiEnabled}
          queueMutation={queueMutation}
          showToast={showToast}
          enabledFeatures={enabledFeatures}
        />
      )}
      <div className="app-layout">
        <Sidebar activeTool={activeTool} setActiveTool={setActiveTool} tools={enabledTools} showToast={showToast} currentUser={currentUser} onLogout={handleLogout} settings={settings} syncStatus={syncStatus} syncQueueCount={syncQueueCount} onOpenQuickAdd={() => setQuickAddOpen(true)} onOpenSearch={() => setSearchOpen(true)} />
        <main className="app-main">
          {activeTool === "dashboard" && (
            <ErrorBoundary key="dashboard">
              <Dashboard
                invoices={invoices} mealPlan={mealPlan} recipes={recipes}
                maintenanceTasks={maintenanceTasks} calendarEvents={calendarEvents}
                shopping={shopping} plants={plants} currentUser={currentUser}
                settings={settings}
                enabledFeatures={enabledFeatures}
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
                  queueMutation({ method: "PUT", endpoint: `/api/plants/${id}`, body: updated, resource: "plants", tempId: id });
                  showToast("Watered!");
                }}
              />
            </ErrorBoundary>
          )}
          {activeTool === "invoices" && isFeatureEnabled("invoices") && (
            <ErrorBoundary key="invoices">
              <InvoiceTracker invoices={invoices} setInvoices={setInvoices} recurringInvoices={recurringInvoices} setRecurringInvoices={setRecurringInvoices} apiEnabled={apiEnabled} queueMutation={queueMutation} showToast={showToast} />
            </ErrorBoundary>
          )}
          {activeTool === "meal" && isFeatureEnabled("meal") && (
            <ErrorBoundary key="meal">
              <MealPlanner recipes={recipes} setRecipes={setRecipes} mealPlan={mealPlan} setMealPlan={setMealPlan} shopping={shopping} setShopping={setShopping} apiEnabled={apiEnabled} queueMutation={queueMutation} showToast={showToast} />
            </ErrorBoundary>
          )}
          {activeTool === "tasks" && isFeatureEnabled("tasks") && (
            <ErrorBoundary key="tasks">
              <TodoTasks tasks={tasks} setTasks={setTasks} users={users} currentUser={currentUser} apiEnabled={apiEnabled} showToast={showToast} />
            </ErrorBoundary>
          )}
          {activeTool === "maintenance" && isFeatureEnabled("maintenance") && (
            <ErrorBoundary key="maintenance">
              <Maintenance maintenanceTasks={maintenanceTasks} setMaintenanceTasks={setMaintenance} apiEnabled={apiEnabled} showToast={showToast} />
            </ErrorBoundary>
          )}
          {activeTool === "calendar" && isFeatureEnabled("calendar") && (
            <ErrorBoundary key="calendar">
              <CalendarView
                calendarProviders={calendarProviders} setCalendarProviders={setCalProviders}
                calendarEvents={calendarEvents} setCalendarEvents={setCalEvents}
                apiEnabled={apiEnabled} queueMutation={queueMutation} showToast={showToast}
                onRefresh={refreshCalendars}
              />
            </ErrorBoundary>
          )}
          {activeTool === "plants" && isFeatureEnabled("plants") && (
            <ErrorBoundary key="plants">
              <PlantManager plants={plants} setPlants={setPlants} apiEnabled={apiEnabled} showToast={showToast} />
            </ErrorBoundary>
          )}
          {activeTool === "shopping" && isFeatureEnabled("shopping") && (
            <ErrorBoundary key="shopping">
              <ShoppingList shopping={shopping} setShopping={setShopping} apiEnabled={apiEnabled} queueMutation={queueMutation} showToast={showToast} onRefresh={() => refreshResource("shopping")} />
            </ErrorBoundary>
          )}
          {activeTool === "documents" && isFeatureEnabled("documents") && (
            <ErrorBoundary key="documents">
              <DocumentVault documents={documents} setDocuments={setDocuments} apiEnabled={apiEnabled} showToast={showToast} />
            </ErrorBoundary>
          )}
          {activeTool === "contacts" && isFeatureEnabled("contacts") && (
            <ErrorBoundary key="contacts">
              <HouseholdContacts contacts={contacts} setContacts={setContacts} apiEnabled={apiEnabled} showToast={showToast} />
            </ErrorBoundary>
          )}
          {activeTool === "inventory" && isFeatureEnabled("inventory") && (
            <ErrorBoundary key="inventory">
              <HomeInventory inventory={inventory} setInventory={setInventory} documents={documents} apiEnabled={apiEnabled} showToast={showToast} />
            </ErrorBoundary>
          )}
          {activeTool === "admin" && currentUser?.role === "admin" && (
            <ErrorBoundary key="admin">
              <Admin currentUser={currentUser} settings={settings} applySettings={applySettings} apiEnabled={apiEnabled} showToast={showToast} tools={HOME_TOOLS} />
            </ErrorBoundary>
          )}
        </main>
      </div>
    </div>
  );
}
