const express = require("express");
const https = require("https");
const multer = require("multer");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3001;
const DATA_DIR = "/data";
const UPLOADS_DIR = path.join(DATA_DIR, "uploads");
const INVOICES_FILE = path.join(DATA_DIR, "invoices.json");
const RECIPES_FILE = path.join(DATA_DIR, "recipes.json");
const MEALPLAN_FILE = path.join(DATA_DIR, "mealPlan.json");
const MAINTENANCE_FILE = path.join(DATA_DIR, "maintenance.json");
const CALENDAR_FILE = path.join(DATA_DIR, "calendar.json");

fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: UPLOADS_DIR,
  filename: (_, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ extended: true, limit: "20mb" }));
app.use("/uploads", express.static(UPLOADS_DIR));

const SAMPLE_INVOICES = [
  { id: 1, vendor: "Engie", amount: 187.5, dueDate: "2026-04-15", invoiceNo: "ENG-2026-0041", notes: "Gas & electricity", status: "overdue", file: null },
  { id: 2, vendor: "Proximus", amount: 49.99, dueDate: "2026-05-20", invoiceNo: "PRX-88210", notes: "Internet & TV", status: "unpaid", file: null },
  { id: 3, vendor: "Water-link", amount: 62.0, dueDate: "2026-04-30", invoiceNo: "WL-2026-112", notes: "Water Q1", status: "paid", file: null },
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

const safeLoad = (filePath, fallback) => {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    try { fs.writeFileSync(filePath, JSON.stringify(fallback, null, 2)); } catch {}
    return fallback;
  }
};

const saveFile = (filePath, data) => {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error(`Failed to save ${filePath}:`, err.message);
    throw err;
  }
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

// RFC 5545: unfold continuation lines before parsing
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

app.get("/api/weather", async (_, res) => {
  const url = "https://api.open-meteo.com/v1/forecast?latitude=51.05&longitude=5.45&current_weather=true&hourly=temperature_2m,precipitation_probability,weathercode,windspeed_10m&timezone=Europe%2FBrussels";
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
      location: "Houthalen-Helchteren, BE",
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
    console.error("Weather proxy failed:", error.message);
    res.status(502).json({ error: "Unable to fetch weather" });
  }
});

app.get("/api/ping", (_, res) => res.json({ ok: true }));

// ── Invoices ──────────────────────────────────────────────────────────────────

app.get("/api/invoices", (_, res) => res.json(safeLoad(INVOICES_FILE, SAMPLE_INVOICES)));

app.post("/api/invoices", upload.single("file"), (req, res) => {
  const invoices = safeLoad(INVOICES_FILE, SAMPLE_INVOICES);
  const { id: _id, ...payload } = parsePayload(req);
  const invoice = {
    ...payload,
    id: nextId(invoices),
    invoiceNo: payload.invoiceNo || generateInvoiceNo(invoices),
    file: req.file
      ? { name: req.file.originalname, path: `/uploads/${req.file.filename}` }
      : payload.file || null,
  };
  invoices.push(invoice);
  saveFile(INVOICES_FILE, invoices);
  res.json(invoice);
});

app.put("/api/invoices/:id", upload.single("file"), (req, res) => {
  const invoices = safeLoad(INVOICES_FILE, SAMPLE_INVOICES);
  const id = parseInt(req.params.id, 10);
  const idx = invoices.findIndex(item => item.id === id);
  if (idx === -1) return res.status(404).json({ error: "Not found" });
  const { id: _id, ...payload } = parsePayload(req);
  invoices[idx] = {
    ...invoices[idx],
    ...payload,
    id,
    file: req.file
      ? { name: req.file.originalname, path: `/uploads/${req.file.filename}` }
      : payload.file ?? invoices[idx].file ?? null,
  };
  saveFile(INVOICES_FILE, invoices);
  res.json(invoices[idx]);
});

app.delete("/api/invoices/:id", (req, res) => {
  const invoices = safeLoad(INVOICES_FILE, SAMPLE_INVOICES);
  saveFile(INVOICES_FILE, invoices.filter(item => item.id !== parseInt(req.params.id, 10)));
  res.json({ ok: true });
});

// ── Recipes ───────────────────────────────────────────────────────────────────

app.get("/api/recipes", (_, res) => res.json(safeLoad(RECIPES_FILE, SAMPLE_RECIPES)));

app.post("/api/recipes", upload.single("image"), (req, res) => {
  const recipes = safeLoad(RECIPES_FILE, SAMPLE_RECIPES);
  const { id: _id, ...payload } = parsePayload(req);
  const recipe = {
    ...payload,
    id: nextId(recipes),
    image: req.file ? `/uploads/${req.file.filename}` : payload.image || null,
  };
  recipes.push(recipe);
  saveFile(RECIPES_FILE, recipes);
  res.json(recipe);
});

app.put("/api/recipes/:id", upload.single("image"), (req, res) => {
  const recipes = safeLoad(RECIPES_FILE, SAMPLE_RECIPES);
  const id = parseInt(req.params.id, 10);
  const idx = recipes.findIndex(item => item.id === id);
  if (idx === -1) return res.status(404).json({ error: "Not found" });
  const { id: _id, ...payload } = parsePayload(req);
  recipes[idx] = {
    ...recipes[idx],
    ...payload,
    id,
    image: req.file ? `/uploads/${req.file.filename}` : payload.image ?? recipes[idx].image ?? null,
  };
  saveFile(RECIPES_FILE, recipes);
  res.json(recipes[idx]);
});

app.delete("/api/recipes/:id", (req, res) => {
  const recipes = safeLoad(RECIPES_FILE, SAMPLE_RECIPES);
  saveFile(RECIPES_FILE, recipes.filter(item => item.id !== parseInt(req.params.id, 10)));
  res.json({ ok: true });
});

// ── Meal plan ─────────────────────────────────────────────────────────────────

app.get("/api/meal-plan", (_, res) => res.json(safeLoad(MEALPLAN_FILE, SAMPLE_MEAL_PLAN)));

app.put("/api/meal-plan", (req, res) => {
  const payload = parsePayload(req);
  saveFile(MEALPLAN_FILE, payload || {});
  res.json(payload || {});
});

// ── Maintenance ───────────────────────────────────────────────────────────────

app.get("/api/maintenance", (_, res) => res.json(safeLoad(MAINTENANCE_FILE, SAMPLE_MAINTENANCE)));

app.post("/api/maintenance", upload.single("photo"), (req, res) => {
  const maintenance = safeLoad(MAINTENANCE_FILE, SAMPLE_MAINTENANCE);
  const { id: _id, ...payload } = parsePayload(req);
  const task = {
    ...payload,
    id: nextId(maintenance),
    photo: req.file ? `/uploads/${req.file.filename}` : payload.photo || null,
  };
  maintenance.push(task);
  saveFile(MAINTENANCE_FILE, maintenance);
  res.json(task);
});

app.put("/api/maintenance/:id", upload.single("photo"), (req, res) => {
  const maintenance = safeLoad(MAINTENANCE_FILE, SAMPLE_MAINTENANCE);
  const id = parseInt(req.params.id, 10);
  const idx = maintenance.findIndex(item => item.id === id);
  if (idx === -1) return res.status(404).json({ error: "Not found" });
  const { id: _id, ...payload } = parsePayload(req);
  maintenance[idx] = {
    ...maintenance[idx],
    ...payload,
    id,
    photo: req.file ? `/uploads/${req.file.filename}` : payload.photo ?? maintenance[idx].photo ?? null,
  };
  saveFile(MAINTENANCE_FILE, maintenance);
  res.json(maintenance[idx]);
});

app.delete("/api/maintenance/:id", (req, res) => {
  const maintenance = safeLoad(MAINTENANCE_FILE, SAMPLE_MAINTENANCE);
  saveFile(MAINTENANCE_FILE, maintenance.filter(item => item.id !== parseInt(req.params.id, 10)));
  res.json({ ok: true });
});

// ── Calendar ──────────────────────────────────────────────────────────────────

app.get("/api/calendar", (_, res) => res.json(safeLoad(CALENDAR_FILE, SAMPLE_CALENDAR)));

app.put("/api/calendar", (req, res) => {
  const payload = parsePayload(req);
  const data = { providers: payload.providers || [], events: payload.events || [] };
  saveFile(CALENDAR_FILE, data);
  res.json(data);
});

app.delete("/api/calendar/providers/:id", (req, res) => {
  const calId = parseInt(req.params.id, 10);
  const calendar = safeLoad(CALENDAR_FILE, SAMPLE_CALENDAR);
  const data = {
    providers: calendar.providers.filter(p => p.id !== calId),
    events: calendar.events.filter(e => e.calendarId !== calId),
  };
  saveFile(CALENDAR_FILE, data);
  res.json(data);
});

app.post("/api/calendar-import", async (req, res) => {
  const { url, provider } = req.body;
  if (!url) return res.status(400).json({ error: "URL required" });

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
      return res.status(response.status).json({ error: `Calendar server returned HTTP ${response.status}. Check the URL is correct and the calendar is publicly shared.` });
    }

    const content = await response.text();

    // Detect HTML response (auth page, error page, redirect) instead of ICS
    if (content.trimStart().startsWith("<")) {
      return res.status(400).json({ error: "The URL returned an HTML page instead of calendar data. Make sure the calendar is set to public sharing and use the ICS/webcal export link, not a web page URL." });
    }

    if (!content.includes("BEGIN:VCALENDAR")) {
      return res.status(400).json({ error: "The response does not appear to be a valid ICS calendar file." });
    }

    const events = parseICS(content, provider || "Calendar");

    if (!events.length) {
      return res.status(400).json({ error: "The calendar was imported successfully but contains no events. It may be empty or all events may be in the past." });
    }

    res.json({ events, count: events.length });
  } catch (error) {
    clearTimeout(timeout);
    console.error("Calendar import error:", error.message);
    const msg = error.name === "AbortError"
      ? "Calendar request timed out after 10 seconds"
      : (error.message || "Failed to import calendar");
    res.status(500).json({ error: msg });
  }
});

app.listen(PORT, "0.0.0.0", () => console.log(`Backend running on :${PORT}`));
