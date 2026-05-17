const express = require("express");
const cors = require("cors");
const https = require("https");
const fs = require("fs");
const path = require("path");
const config = require("./config");
const { diskUpload, memUpload, sanitizeFilename } = require("./middleware/upload");
const errorHandler = require("./middleware/error");
const { validateInvoice, validatePlant, validateRecipe, validateMaintenanceTask } = require("./middleware/validate");
const { extract } = require("./services/ocr");

const {
  PORT,
  UPLOADS_DIR,
  INVOICES_FILE,
  RECIPES_FILE,
  MEALPLAN_FILE,
  MAINTENANCE_FILE,
  CALENDAR_FILE,
  PLANTS_FILE,
  CORS_ORIGIN,
  WEATHER_LAT,
  WEATHER_LON,
  WEATHER_LOCATION,
  HUE_BRIDGE_IP,
  HUE_API_KEY,
} = config;

const app = express();

if (CORS_ORIGIN) {
  app.use(cors({ origin: CORS_ORIGIN, credentials: true }));
}

app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ extended: true, limit: "20mb" }));

fs.mkdirSync(UPLOADS_DIR, { recursive: true });
app.use("/uploads", express.static(UPLOADS_DIR));

// ── Sample data ───────────────────────────────────────────────────────────────

const SAMPLE_INVOICES = [
  { id: 1, vendor: "Engie", amount: 187.5, dueDate: "2026-04-15", invoiceNo: "ENG-2026-0041", notes: "Gas & electricity", category: "Utilities", status: "overdue", file: null },
  { id: 2, vendor: "Proximus", amount: 49.99, dueDate: "2026-05-20", invoiceNo: "PRX-88210", notes: "Internet & TV", category: "Internet", status: "unpaid", file: null },
  { id: 3, vendor: "Water-link", amount: 62.0, dueDate: "2026-04-30", invoiceNo: "WL-2026-112", notes: "Water Q1", category: "Utilities", status: "paid", file: null },
];

const SAMPLE_RECIPES = [
  { id: 1, name: "Spaghetti Bolognese", ingredients: "Pasta, minced beef, tomato sauce, onion, garlic, herbs", instructions: "Cook pasta; brown beef with onion and garlic; add tomato sauce and simmer; serve over pasta.", image: null },
  { id: 2, name: "Sheet Pan Chicken Veggies", ingredients: "Chicken thighs, carrots, potatoes, broccoli, olive oil, salt, pepper", instructions: "Toss ingredients with oil and seasoning; bake at 200°C for 35 minutes.", image: null },
];

const SAMPLE_MAINTENANCE = [
  { id: 1, title: "Check Smoke Detectors", frequency: "monthly", nextDue: new Date().toISOString().slice(0, 10), instructions: "Test each smoke detector in the house and replace batteries if needed.", photo: null, completed: false },
];

const SAMPLE_MEAL_PLAN = {};
const SAMPLE_CALENDAR = { providers: [], events: [] };

const SAMPLE_PLANTS = [
  { id: 1, name: "Basil", wateringFrequency: "weekly", lastWatered: "", feedingFrequency: "monthly", lastFed: "", notes: "Keep in sunny window, pinch leaves regularly.", imageId: "snake-plant" },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

const safeLoad = (filePath, fallback) => {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    try { fs.writeFileSync(filePath, JSON.stringify(fallback, null, 2)); } catch {}
    return fallback;
  }
};

const saveFile = (filePath, data) => {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
};

const parsePayload = (req) => {
  if (req.body && typeof req.body === "object") {
    if (req.body.data) {
      try { return JSON.parse(req.body.data); } catch { return req.body; }
    }
    return req.body;
  }
  return {};
};

const nextId = (items) => items.reduce((max, item) => Math.max(max, item.id || 0), 0) + 1;

const generateInvoiceNo = (invoices) => {
  const year = new Date().getFullYear();
  const nums = invoices
    .map(i => i.invoiceNo)
    .filter(n => typeof n === "string" && n.startsWith(`INV-${year}-`))
    .map(n => parseInt(n.slice(-4), 10))
    .filter(n => !isNaN(n));
  const next = nums.length ? Math.max(...nums) + 1 : 1;
  return `INV-${year}-${String(next).padStart(4, "0")}`;
};

// ── ICS / calendar helpers ────────────────────────────────────────────────────

const unfoldICS = (content) => content.replace(/\r?\n[ \t]/g, "");

const parseICSTime = (value) => {
  if (!value) return null;
  const normalized = value.replace(/Z$/, "");
  if (/^\d{8}$/.test(normalized)) {
    return new Date(`${normalized.slice(0, 4)}-${normalized.slice(4, 6)}-${normalized.slice(6, 8)}T00:00:00`);
  }
  if (/^\d{8}T\d{6}$/.test(normalized)) {
    return new Date(`${normalized.slice(0, 4)}-${normalized.slice(4, 6)}-${normalized.slice(6, 8)}T${normalized.slice(9, 11)}:${normalized.slice(11, 13)}:${normalized.slice(13, 15)}`);
  }
  return new Date(normalized);
};

const parseICS = (content, provider) => {
  const lines = unfoldICS(content).split(/\r?\n/).map(l => l.trim());
  const events = [];
  let current = null;

  for (const line of lines) {
    if (line === "BEGIN:VEVENT") { current = {}; continue; }
    if (line === "END:VEVENT") {
      if (current?.dtstart) {
        events.push({
          uid: current.uid || `${provider}-${Date.now()}-${Math.random()}`,
          title: current.summary || "Untitled event",
          description: current.description || "",
          location: current.location || "",
          start: parseICSTime(current.dtstart) || new Date().toISOString(),
          end: parseICSTime(current.dtend) || parseICSTime(current.dtstart) || new Date().toISOString(),
          provider,
        });
      }
      current = null;
      continue;
    }
    if (!current) continue;
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).split(";")[0].toLowerCase();
    current[key] = line.slice(colonIdx + 1);
  }

  return events;
};

const fetchJson = (url) => new Promise((resolve, reject) => {
  https.get(url, (res) => {
    let data = "";
    res.setEncoding("utf8");
    res.on("data", (chunk) => { data += chunk; });
    res.on("end", () => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        try { resolve(JSON.parse(data)); } catch (error) { reject(error); }
      } else {
        reject(new Error(`HTTP ${res.statusCode}`));
      }
    });
  }).on("error", reject);
});

// ── Health & utility ──────────────────────────────────────────────────────────

app.get("/api/health", (_, res) => {
  let db = true;
  let uploads = true;
  try { fs.accessSync(path.dirname(INVOICES_FILE), fs.constants.W_OK); } catch { db = false; }
  try { fs.accessSync(UPLOADS_DIR, fs.constants.W_OK); } catch { uploads = false; }
  const status = db && uploads ? "ok" : "degraded";
  res.status(status === "ok" ? 200 : 503).json({ status, db, uploads });
});

app.get("/api/ping", (_, res) => res.json({ ok: true }));

// ── Weather ───────────────────────────────────────────────────────────────────

app.get("/api/weather", async (_, res, next) => {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${WEATHER_LAT}&longitude=${WEATHER_LON}&current_weather=true&hourly=temperature_2m,precipitation_probability,weathercode,windspeed_10m&timezone=auto`;
  try {
    const payload = await fetchJson(url);
    const now = new Date();
    const hourly = (payload.hourly?.time || []).map((time, index) => ({
      time,
      temperature: payload.hourly.temperature_2m?.[index],
      precipitationProbability: payload.hourly.precipitation_probability?.[index],
      weathercode: payload.hourly.weathercode?.[index],
      windspeed: payload.hourly.windspeed_10m?.[index],
    })).filter(item => new Date(item.time) >= now).slice(0, 24);

    res.json({
      location: WEATHER_LOCATION,
      current: {
        temperature: payload.current_weather?.temperature,
        windspeed: payload.current_weather?.windspeed,
        weathercode: payload.current_weather?.weathercode,
        time: payload.current_weather?.time,
      },
      hourly,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    next(Object.assign(error, { status: 502 }));
  }
});

// ── OCR (4.3) ─────────────────────────────────────────────────────────────────

app.post("/api/ocr", memUpload.single("file"), async (req, res, next) => {
  if (!req.file) {
    return res.status(400).json({ error: { code: 400, message: "No file provided" } });
  }
  try {
    const { tokens } = await extract(req.file.buffer, req.file.mimetype);
    res.json({ tokens });
  } catch (err) {
    next(err);
  }
});

// ── Invoices ──────────────────────────────────────────────────────────────────

app.get("/api/invoices", (_, res) => res.json(safeLoad(INVOICES_FILE, SAMPLE_INVOICES)));

app.post("/api/invoices", diskUpload.single("file"), (req, res, next) => {
  try {
    const invoices = safeLoad(INVOICES_FILE, SAMPLE_INVOICES);
    const { id: _id, ...payload } = parsePayload(req);
    validateInvoice(payload);
    const invoice = {
      ...payload,
      id: nextId(invoices),
      invoiceNo: payload.invoiceNo || generateInvoiceNo(invoices),
      file: req.file
        ? { name: sanitizeFilename(req.file.originalname), path: `/uploads/${req.file.filename}` }
        : payload.file || null,
    };
    invoices.push(invoice);
    saveFile(INVOICES_FILE, invoices);
    res.json(invoice);
  } catch (err) {
    next(err);
  }
});

app.put("/api/invoices/:id", diskUpload.single("file"), (req, res, next) => {
  try {
    const invoices = safeLoad(INVOICES_FILE, SAMPLE_INVOICES);
    const id = parseInt(req.params.id, 10);
    const idx = invoices.findIndex(item => item.id === id);
    if (idx === -1) return res.status(404).json({ error: { code: 404, message: "Invoice not found" } });
    const { id: _id, ...payload } = parsePayload(req);
    validateInvoice(payload);
    invoices[idx] = {
      ...invoices[idx],
      ...payload,
      id,
      file: req.file
        ? { name: sanitizeFilename(req.file.originalname), path: `/uploads/${req.file.filename}` }
        : payload.file ?? invoices[idx].file ?? null,
    };
    saveFile(INVOICES_FILE, invoices);
    res.json(invoices[idx]);
  } catch (err) {
    next(err);
  }
});

app.delete("/api/invoices/:id", (req, res, next) => {
  try {
    const invoices = safeLoad(INVOICES_FILE, SAMPLE_INVOICES);
    saveFile(INVOICES_FILE, invoices.filter(item => item.id !== parseInt(req.params.id, 10)));
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// ── Recipes ───────────────────────────────────────────────────────────────────

app.get("/api/recipes", (_, res) => res.json(safeLoad(RECIPES_FILE, SAMPLE_RECIPES)));

app.post("/api/recipes", diskUpload.single("image"), (req, res, next) => {
  try {
    const recipes = safeLoad(RECIPES_FILE, SAMPLE_RECIPES);
    const { id: _id, ...payload } = parsePayload(req);
    validateRecipe(payload);
    const recipe = {
      ...payload,
      id: nextId(recipes),
      image: req.file ? `/uploads/${req.file.filename}` : payload.image || null,
    };
    recipes.push(recipe);
    saveFile(RECIPES_FILE, recipes);
    res.json(recipe);
  } catch (err) {
    next(err);
  }
});

app.put("/api/recipes/:id", diskUpload.single("image"), (req, res, next) => {
  try {
    const recipes = safeLoad(RECIPES_FILE, SAMPLE_RECIPES);
    const id = parseInt(req.params.id, 10);
    const idx = recipes.findIndex(item => item.id === id);
    if (idx === -1) return res.status(404).json({ error: { code: 404, message: "Recipe not found" } });
    const { id: _id, ...payload } = parsePayload(req);
    validateRecipe(payload);
    recipes[idx] = {
      ...recipes[idx],
      ...payload,
      id,
      image: req.file ? `/uploads/${req.file.filename}` : payload.image ?? recipes[idx].image ?? null,
    };
    saveFile(RECIPES_FILE, recipes);
    res.json(recipes[idx]);
  } catch (err) {
    next(err);
  }
});

app.delete("/api/recipes/:id", (req, res, next) => {
  try {
    const recipes = safeLoad(RECIPES_FILE, SAMPLE_RECIPES);
    saveFile(RECIPES_FILE, recipes.filter(item => item.id !== parseInt(req.params.id, 10)));
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// ── Meal plan ─────────────────────────────────────────────────────────────────

app.get("/api/meal-plan", (_, res) => res.json(safeLoad(MEALPLAN_FILE, SAMPLE_MEAL_PLAN)));

app.put("/api/meal-plan", (req, res, next) => {
  try {
    const payload = parsePayload(req);
    saveFile(MEALPLAN_FILE, payload || {});
    res.json(payload || {});
  } catch (err) {
    next(err);
  }
});

// ── Maintenance ───────────────────────────────────────────────────────────────

app.get("/api/maintenance", (_, res) => res.json(safeLoad(MAINTENANCE_FILE, SAMPLE_MAINTENANCE)));

app.post("/api/maintenance", diskUpload.single("photo"), (req, res, next) => {
  try {
    const maintenance = safeLoad(MAINTENANCE_FILE, SAMPLE_MAINTENANCE);
    const { id: _id, ...payload } = parsePayload(req);
    validateMaintenanceTask(payload);
    const task = {
      ...payload,
      id: nextId(maintenance),
      photo: req.file ? `/uploads/${req.file.filename}` : payload.photo || null,
    };
    maintenance.push(task);
    saveFile(MAINTENANCE_FILE, maintenance);
    res.json(task);
  } catch (err) {
    next(err);
  }
});

app.put("/api/maintenance/:id", diskUpload.single("photo"), (req, res, next) => {
  try {
    const maintenance = safeLoad(MAINTENANCE_FILE, SAMPLE_MAINTENANCE);
    const id = parseInt(req.params.id, 10);
    const idx = maintenance.findIndex(item => item.id === id);
    if (idx === -1) return res.status(404).json({ error: { code: 404, message: "Task not found" } });
    const { id: _id, ...payload } = parsePayload(req);
    validateMaintenanceTask(payload);
    maintenance[idx] = {
      ...maintenance[idx],
      ...payload,
      id,
      photo: req.file ? `/uploads/${req.file.filename}` : payload.photo ?? maintenance[idx].photo ?? null,
    };
    saveFile(MAINTENANCE_FILE, maintenance);
    res.json(maintenance[idx]);
  } catch (err) {
    next(err);
  }
});

app.delete("/api/maintenance/:id", (req, res, next) => {
  try {
    const maintenance = safeLoad(MAINTENANCE_FILE, SAMPLE_MAINTENANCE);
    saveFile(MAINTENANCE_FILE, maintenance.filter(item => item.id !== parseInt(req.params.id, 10)));
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// ── Plants ────────────────────────────────────────────────────────────────────

app.get("/api/plants", (_, res) => res.json(safeLoad(PLANTS_FILE, SAMPLE_PLANTS)));

app.post("/api/plants", (req, res, next) => {
  try {
    const plants = safeLoad(PLANTS_FILE, SAMPLE_PLANTS);
    const { id: _id, ...payload } = parsePayload(req);
    validatePlant(payload);
    const plant = { ...payload, id: nextId(plants) };
    plants.push(plant);
    saveFile(PLANTS_FILE, plants);
    res.json(plant);
  } catch (err) { next(err); }
});

app.put("/api/plants/:id", (req, res, next) => {
  try {
    const plants = safeLoad(PLANTS_FILE, SAMPLE_PLANTS);
    const id = parseInt(req.params.id, 10);
    const idx = plants.findIndex(item => item.id === id);
    if (idx === -1) return res.status(404).json({ error: { code: 404, message: "Plant not found" } });
    const { id: _id, ...payload } = parsePayload(req);
    validatePlant(payload);
    plants[idx] = { ...plants[idx], ...payload, id };
    saveFile(PLANTS_FILE, plants);
    res.json(plants[idx]);
  } catch (err) { next(err); }
});

app.delete("/api/plants/:id", (req, res, next) => {
  try {
    const plants = safeLoad(PLANTS_FILE, SAMPLE_PLANTS);
    saveFile(PLANTS_FILE, plants.filter(item => item.id !== parseInt(req.params.id, 10)));
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// ── Calendar ──────────────────────────────────────────────────────────────────

app.get("/api/calendar", (_, res) => res.json(safeLoad(CALENDAR_FILE, SAMPLE_CALENDAR)));

app.put("/api/calendar", (req, res, next) => {
  try {
    const payload = parsePayload(req);
    const data = { providers: payload.providers || [], events: payload.events || [] };
    saveFile(CALENDAR_FILE, data);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

app.delete("/api/calendar/providers/:id", (req, res, next) => {
  try {
    const calId = parseInt(req.params.id, 10);
    const calendar = safeLoad(CALENDAR_FILE, SAMPLE_CALENDAR);
    const data = {
      providers: calendar.providers.filter(p => p.id !== calId),
      events: calendar.events.filter(e => e.calendarId !== calId),
    };
    saveFile(CALENDAR_FILE, data);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

app.post("/api/calendar-import", async (req, res, next) => {
  const { url, provider } = req.body;
  if (!url) return res.status(400).json({ error: { code: 400, message: "URL required" } });

  let fetchUrl = url;
  if (url.startsWith("webcal://")) fetchUrl = url.replace("webcal://", "https://");
  else if (url.startsWith("webcals://")) fetchUrl = url.replace("webcals://", "https://");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(fetchUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; HomeHub/1.0; +calendar-importer)",
        "Accept": "text/calendar, text/plain, */*",
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) {
      return res.status(response.status).json({ error: { code: response.status, message: `Calendar server returned HTTP ${response.status}.` } });
    }

    const content = await response.text();

    if (content.trimStart().startsWith("<")) {
      return res.status(400).json({ error: { code: 400, message: "The URL returned an HTML page instead of calendar data. Make sure the calendar is set to public sharing and use the ICS/webcal export link." } });
    }

    if (!content.includes("BEGIN:VCALENDAR")) {
      return res.status(400).json({ error: { code: 400, message: "The response does not appear to be a valid ICS calendar file." } });
    }

    const events = parseICS(content, provider || "Calendar");

    if (!events.length) {
      return res.status(400).json({ error: { code: 400, message: "The calendar was imported successfully but contains no events." } });
    }

    res.json({ events, count: events.length });
  } catch (error) {
    clearTimeout(timeout);
    const msg = error.name === "AbortError"
      ? "Calendar request timed out after 10 seconds"
      : (error.message || "Failed to import calendar");
    next(Object.assign(new Error(msg), { status: 500 }));
  }
});

// ── Philips Hue ───────────────────────────────────────────────────────────────

const hue = require("./services/hue");

const requireHue = (req, res, next) => {
  if (!HUE_BRIDGE_IP || !HUE_API_KEY) {
    return res.status(503).json({ error: { code: 503, message: "Hue not configured. Set HUE_BRIDGE_IP and HUE_API_KEY." } });
  }
  next();
};

app.get("/api/hue/lights", requireHue, async (req, res, next) => {
  try {
    const lights = await hue.getLights(HUE_BRIDGE_IP, HUE_API_KEY);
    res.json(lights);
  } catch (err) {
    next(Object.assign(err, { status: 502 }));
  }
});

app.get("/api/hue/groups", requireHue, async (req, res, next) => {
  try {
    const groups = await hue.getGroups(HUE_BRIDGE_IP, HUE_API_KEY);
    res.json(groups);
  } catch (err) {
    next(Object.assign(err, { status: 502 }));
  }
});

app.put("/api/hue/lights/:id/state", requireHue, async (req, res, next) => {
  try {
    const result = await hue.setLightState(HUE_BRIDGE_IP, HUE_API_KEY, req.params.id, req.body);
    res.json(result);
  } catch (err) {
    next(Object.assign(err, { status: 502 }));
  }
});

app.put("/api/hue/groups/:id/action", requireHue, async (req, res, next) => {
  try {
    const result = await hue.setGroupAction(HUE_BRIDGE_IP, HUE_API_KEY, req.params.id, req.body);
    res.json(result);
  } catch (err) {
    next(Object.assign(err, { status: 502 }));
  }
});

app.get("/api/hue/scenes", requireHue, async (req, res, next) => {
  try {
    const scenes = await hue.getScenes(HUE_BRIDGE_IP, HUE_API_KEY);
    res.json(scenes);
  } catch (err) {
    next(Object.assign(err, { status: 502 }));
  }
});

app.put("/api/hue/groups/:id/scene", requireHue, async (req, res, next) => {
  try {
    const result = await hue.activateScene(HUE_BRIDGE_IP, HUE_API_KEY, req.params.id, req.body.scene);
    res.json(result);
  } catch (err) {
    next(Object.assign(err, { status: 502 }));
  }
});

// ── Centralized error handler (must be last) ──────────────────────────────────

app.use(errorHandler);

app.listen(PORT, "0.0.0.0", () => console.log(`Backend running on :${PORT}`));
