const express = require("express");
const cors = require("cors");
const https = require("https");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const session = require("express-session");
const FileStore = require("session-file-store")(session);
const bcrypt = require("bcryptjs");
const rateLimit = require("express-rate-limit");
const config = require("./config");
const { diskUpload, memUpload, sanitizeFilename, validateMagicBytes } = require("./middleware/upload");
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
  USERS_FILE,
  SETTINGS_FILE,
  SHOPPING_FILE,
  DOCUMENTS_FILE,
  CONTACTS_FILE,
  INVENTORY_FILE,
  CORS_ORIGIN,
  SESSION_SECRET,
  COOKIE_SECURE,
} = config;

const app = express();

if (CORS_ORIGIN) {
  app.use(cors({ origin: CORS_ORIGIN, credentials: true }));
}

app.use(express.json({ limit: "256kb" }));
app.use(express.urlencoded({ extended: true, limit: "256kb" }));

fs.mkdirSync(UPLOADS_DIR, { recursive: true });
app.use("/uploads", express.static(UPLOADS_DIR));

// ── Session ───────────────────────────────────────────────────────────────────

app.set("trust proxy", "loopback");

const resolvedSecret = SESSION_SECRET || (() => {
  console.warn("[auth] SESSION_SECRET not set — using ephemeral secret. Sessions will be lost on restart.");
  return crypto.randomBytes(32).toString("hex");
})();

app.use(session({
  store: new FileStore({ path: path.join(config.DATA_DIR, "sessions"), ttl: 90 * 24 * 60 * 60, retries: 1 }),
  secret: resolvedSecret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: COOKIE_SECURE,
    sameSite: "lax",
    maxAge: 90 * 24 * 60 * 60 * 1000,
  },
}));

// ── Rate limiters ─────────────────────────────────────────────────────────────

const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 429, message: "Too many requests, please slow down." } },
});

const ocrLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 429, message: "Too many OCR requests, please wait." } },
});

app.use("/api", globalLimiter);

// ── Global auth guard ─────────────────────────────────────────────────────────

const PUBLIC_API_PATHS = new Set(["/ping", "/health", "/auth/login", "/auth/logout", "/auth/me"]);

app.use("/api", (req, res, next) => {
  if (PUBLIC_API_PATHS.has(req.path)) return next();
  if (req.session?.userId) return next();
  res.status(401).json({ error: { code: 401, message: "Authentication required" } });
});

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

// ── SSE broadcast ─────────────────────────────────────────────────────────────

const clients = new Set();

const broadcast = (resource) => {
  const msg = `data: ${JSON.stringify({ resource })}\n\n`;
  for (const res of clients) { try { res.write(msg); } catch {} }
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

// ── SSE endpoint ─────────────────────────────────────────────────────────────

app.get("/api/events", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();
  clients.add(res);
  const hb = setInterval(() => { try { res.write(": ping\n\n"); } catch {} }, 25000);
  req.on("close", () => { clients.delete(res); clearInterval(hb); });
});

// ── User seeding ──────────────────────────────────────────────────────────────

const seedUsers = () => {
  if (!process.env.ADMIN_USERNAME || !process.env.ADMIN_PASSWORD) return;
  const users = safeLoad(USERS_FILE, []);
  if (users.length > 0) return;
  const passwordHash = bcrypt.hashSync(process.env.ADMIN_PASSWORD, 12);
  saveFile(USERS_FILE, [{ id: crypto.randomUUID(), username: process.env.ADMIN_USERNAME, passwordHash, role: "admin" }]);
  console.log(`[auth] Created initial user "${process.env.ADMIN_USERNAME}"`);
};
seedUsers();

const requireAdmin = (req, res, next) => {
  const users = safeLoad(USERS_FILE, []);
  const u = users.find(u => u.id === req.session?.userId);
  if (u?.role !== "admin") return res.status(403).json({ error: { code: 403, message: "Admin only" } });
  next();
};

const SAMPLE_SETTINGS = { appName: "HomeHub", householdName: "", currency: "EUR", accentColor: "#16a34a" };

// ── Auth routes ───────────────────────────────────────────────────────────────

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: { code: 429, message: "Too many login attempts, please try again later." } },
});

app.post("/api/auth/login", loginLimiter, async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: { code: 400, message: "Username and password required" } });
  }
  const users = safeLoad(USERS_FILE, []);
  const user = users.find(u => u.username === username);
  if (!user || !await bcrypt.compare(password, user.passwordHash)) {
    return res.status(401).json({ error: { code: 401, message: "Invalid username or password" } });
  }
  req.session.userId = user.id;
  req.session.username = user.username;
  req.session.role = user.role || "user";
  res.json({ id: user.id, username: user.username, role: user.role || "user" });
});

app.post("/api/auth/logout", (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.get("/api/auth/me", (req, res) => {
  res.json({ id: req.session.userId, username: req.session.username, role: req.session.role || "user" });
});

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

// ── OCR (4.3) ─────────────────────────────────────────────────────────────────

app.post("/api/ocr", ocrLimiter, memUpload.single("file"), async (req, res, next) => {
  if (!req.file) {
    return res.status(400).json({ error: { code: 400, message: "No file provided" } });
  }
  try {
    validateMagicBytes(req.file);
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
    if (req.file) validateMagicBytes(req.file);
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
    broadcast("invoices");
    res.json(invoice);
  } catch (err) {
    next(err);
  }
});

app.put("/api/invoices/:id", diskUpload.single("file"), (req, res, next) => {
  try {
    if (req.file) validateMagicBytes(req.file);
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
    broadcast("invoices");
    res.json(invoices[idx]);
  } catch (err) {
    next(err);
  }
});

app.delete("/api/invoices/:id", (req, res, next) => {
  try {
    const invoices = safeLoad(INVOICES_FILE, SAMPLE_INVOICES);
    saveFile(INVOICES_FILE, invoices.filter(item => item.id !== parseInt(req.params.id, 10)));
    broadcast("invoices");
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// ── Recipes ───────────────────────────────────────────────────────────────────

app.get("/api/recipes", (_, res) => res.json(safeLoad(RECIPES_FILE, SAMPLE_RECIPES)));

app.post("/api/recipes", diskUpload.single("image"), (req, res, next) => {
  try {
    if (req.file) validateMagicBytes(req.file);
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
    broadcast("recipes");
    res.json(recipe);
  } catch (err) {
    next(err);
  }
});

app.put("/api/recipes/:id", diskUpload.single("image"), (req, res, next) => {
  try {
    if (req.file) validateMagicBytes(req.file);
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
    broadcast("recipes");
    res.json(recipes[idx]);
  } catch (err) {
    next(err);
  }
});

app.delete("/api/recipes/:id", (req, res, next) => {
  try {
    const recipes = safeLoad(RECIPES_FILE, SAMPLE_RECIPES);
    saveFile(RECIPES_FILE, recipes.filter(item => item.id !== parseInt(req.params.id, 10)));
    broadcast("recipes");
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
    broadcast("mealPlan");
    res.json(payload || {});
  } catch (err) {
    next(err);
  }
});

// ── Maintenance ───────────────────────────────────────────────────────────────

app.get("/api/maintenance", (_, res) => res.json(safeLoad(MAINTENANCE_FILE, SAMPLE_MAINTENANCE)));

app.post("/api/maintenance", diskUpload.single("photo"), (req, res, next) => {
  try {
    if (req.file) validateMagicBytes(req.file);
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
    broadcast("maintenance");
    res.json(task);
  } catch (err) {
    next(err);
  }
});

app.put("/api/maintenance/:id", diskUpload.single("photo"), (req, res, next) => {
  try {
    if (req.file) validateMagicBytes(req.file);
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
    broadcast("maintenance");
    res.json(maintenance[idx]);
  } catch (err) {
    next(err);
  }
});

app.delete("/api/maintenance/:id", (req, res, next) => {
  try {
    const maintenance = safeLoad(MAINTENANCE_FILE, SAMPLE_MAINTENANCE);
    saveFile(MAINTENANCE_FILE, maintenance.filter(item => item.id !== parseInt(req.params.id, 10)));
    broadcast("maintenance");
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
    broadcast("plants");
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
    broadcast("plants");
    res.json(plants[idx]);
  } catch (err) { next(err); }
});

app.delete("/api/plants/:id", (req, res, next) => {
  try {
    const plants = safeLoad(PLANTS_FILE, SAMPLE_PLANTS);
    saveFile(PLANTS_FILE, plants.filter(item => item.id !== parseInt(req.params.id, 10)));
    broadcast("plants");
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
    broadcast("calendar");
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
    broadcast("calendar");
    res.json(data);
  } catch (err) {
    next(err);
  }
});

const PRIVATE_IP_RE = /^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|127\.|0\.0\.0\.0|::1$|localhost$)/i;
const MAX_ICS_BYTES = 5 * 1024 * 1024;

app.post("/api/calendar-import", async (req, res, next) => {
  const { url, provider } = req.body;
  if (!url) return res.status(400).json({ error: { code: 400, message: "URL required" } });

  let fetchUrl = url;
  if (url.startsWith("webcal://")) fetchUrl = url.replace("webcal://", "https://");
  else if (url.startsWith("webcals://")) fetchUrl = url.replace("webcals://", "https://");

  let parsed;
  try { parsed = new URL(fetchUrl); } catch {
    return res.status(400).json({ error: { code: 400, message: "Invalid URL." } });
  }
  if (!["http:", "https:"].includes(parsed.protocol)) {
    return res.status(400).json({ error: { code: 400, message: "Only http and https URLs are allowed." } });
  }
  if (PRIVATE_IP_RE.test(parsed.hostname)) {
    return res.status(400).json({ error: { code: 400, message: "Private or local URLs are not permitted." } });
  }

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

    const reader = response.body.getReader();
    let received = 0;
    const chunks = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.length;
      if (received > MAX_ICS_BYTES) {
        return res.status(413).json({ error: { code: 413, message: "Calendar response too large (max 5 MB)." } });
      }
      chunks.push(value);
    }
    const content = Buffer.concat(chunks).toString("utf8");

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

// ── Settings ──────────────────────────────────────────────────────────────────

app.get("/api/settings", (_, res) => res.json(safeLoad(SETTINGS_FILE, SAMPLE_SETTINGS)));

app.put("/api/settings", requireAdmin, (req, res, next) => {
  try {
    const current = safeLoad(SETTINGS_FILE, SAMPLE_SETTINGS);
    const { appName, householdName, currency, accentColor } = parsePayload(req);
    const updated = {
      ...current,
      ...(appName !== undefined && { appName: String(appName).trim() || current.appName }),
      ...(householdName !== undefined && { householdName: String(householdName).trim() }),
      ...(currency !== undefined && { currency: String(currency) }),
      ...(accentColor !== undefined && { accentColor: String(accentColor) }),
    };
    saveFile(SETTINGS_FILE, updated);
    broadcast("settings");
    res.json(updated);
  } catch (err) { next(err); }
});

// ── Admin ─────────────────────────────────────────────────────────────────────

app.get("/api/admin/users", requireAdmin, (_, res) => {
  const users = safeLoad(USERS_FILE, []);
  res.json(users.map(({ passwordHash: _, ...u }) => u));
});

app.post("/api/admin/users", requireAdmin, async (req, res, next) => {
  try {
    const { username, password, role = "user" } = parsePayload(req);
    if (!username || !password) return res.status(400).json({ error: { code: 400, message: "username and password required" } });
    const users = safeLoad(USERS_FILE, []);
    if (users.find(u => u.username === username)) return res.status(409).json({ error: { code: 409, message: "Username already exists" } });
    const passwordHash = await bcrypt.hash(password, 12);
    const user = { id: crypto.randomUUID(), username, passwordHash, role: ["admin", "user"].includes(role) ? role : "user" };
    users.push(user);
    saveFile(USERS_FILE, users);
    const { passwordHash: _, ...safe } = user;
    res.json(safe);
  } catch (err) { next(err); }
});

app.put("/api/admin/users/:id/password", requireAdmin, async (req, res, next) => {
  try {
    const { password } = parsePayload(req);
    if (!password) return res.status(400).json({ error: { code: 400, message: "password required" } });
    const users = safeLoad(USERS_FILE, []);
    const idx = users.findIndex(u => u.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: { code: 404, message: "User not found" } });
    users[idx].passwordHash = await bcrypt.hash(password, 12);
    saveFile(USERS_FILE, users);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

app.delete("/api/admin/users/:id", requireAdmin, (req, res, next) => {
  try {
    if (req.params.id === req.session.userId) return res.status(400).json({ error: { code: 400, message: "Cannot delete your own account" } });
    const users = safeLoad(USERS_FILE, []);
    if (!users.find(u => u.id === req.params.id)) return res.status(404).json({ error: { code: 404, message: "User not found" } });
    saveFile(USERS_FILE, users.filter(u => u.id !== req.params.id));
    res.json({ ok: true });
  } catch (err) { next(err); }
});

app.get("/api/admin/stats", requireAdmin, (_, res) => {
  try {
    const uploadsDir = UPLOADS_DIR;
    let uploadsBytes = 0;
    try {
      const files = fs.readdirSync(uploadsDir);
      for (const f of files) {
        try { uploadsBytes += fs.statSync(path.join(uploadsDir, f)).size; } catch {}
      }
    } catch {}
    res.json({
      storage: { uploadsBytes },
      counts: {
        invoices:    safeLoad(INVOICES_FILE,   []).length,
        recipes:     safeLoad(RECIPES_FILE,    []).length,
        maintenance: safeLoad(MAINTENANCE_FILE,[]).length,
        plants:      safeLoad(PLANTS_FILE,     []).length,
        contacts:    safeLoad(CONTACTS_FILE,   []).length,
        inventory:   safeLoad(INVENTORY_FILE,  []).length,
        documents:   safeLoad(DOCUMENTS_FILE,  []).length,
        users:       safeLoad(USERS_FILE,      []).length,
      },
    });
  } catch (err) { res.status(500).json({ error: { code: 500, message: err.message } }); }
});

// ── Shopping ──────────────────────────────────────────────────────────────────

const SAMPLE_SHOPPING = { stores: [], items: [] };
const nextShoppingId = (arr) => arr.reduce((m, i) => Math.max(m, i.id || 0), 0) + 1;

app.get("/api/shopping", (_, res) => res.json(safeLoad(SHOPPING_FILE, SAMPLE_SHOPPING)));

app.post("/api/shopping/stores", (req, res, next) => {
  try {
    const data = safeLoad(SHOPPING_FILE, SAMPLE_SHOPPING);
    const { id: _id, ...payload } = parsePayload(req);
    if (!payload.name) return res.status(400).json({ error: { code: 400, message: "name required" } });
    const store = { ...payload, id: nextShoppingId(data.stores) };
    data.stores.push(store);
    saveFile(SHOPPING_FILE, data);
    broadcast("shopping");
    res.json(store);
  } catch (err) { next(err); }
});

app.put("/api/shopping/stores/:id", (req, res, next) => {
  try {
    const data = safeLoad(SHOPPING_FILE, SAMPLE_SHOPPING);
    const id = parseInt(req.params.id, 10);
    const idx = data.stores.findIndex(s => s.id === id);
    if (idx === -1) return res.status(404).json({ error: { code: 404, message: "Store not found" } });
    const { id: _id, ...payload } = parsePayload(req);
    data.stores[idx] = { ...data.stores[idx], ...payload, id };
    saveFile(SHOPPING_FILE, data);
    broadcast("shopping");
    res.json(data.stores[idx]);
  } catch (err) { next(err); }
});

app.delete("/api/shopping/stores/:id", (req, res, next) => {
  try {
    const data = safeLoad(SHOPPING_FILE, SAMPLE_SHOPPING);
    const id = parseInt(req.params.id, 10);
    data.stores = data.stores.filter(s => s.id !== id);
    data.items = data.items.filter(i => i.storeId !== id);
    saveFile(SHOPPING_FILE, data);
    broadcast("shopping");
    res.json({ ok: true });
  } catch (err) { next(err); }
});

app.post("/api/shopping/items", (req, res, next) => {
  try {
    const data = safeLoad(SHOPPING_FILE, SAMPLE_SHOPPING);
    const { id: _id, ...payload } = parsePayload(req);
    if (!payload.name) return res.status(400).json({ error: { code: 400, message: "name required" } });
    const item = { ...payload, id: nextShoppingId(data.items), checked: false };
    data.items.push(item);
    saveFile(SHOPPING_FILE, data);
    broadcast("shopping");
    res.json(item);
  } catch (err) { next(err); }
});

app.put("/api/shopping/items/:id", (req, res, next) => {
  try {
    const data = safeLoad(SHOPPING_FILE, SAMPLE_SHOPPING);
    const id = parseInt(req.params.id, 10);
    const idx = data.items.findIndex(i => i.id === id);
    if (idx === -1) return res.status(404).json({ error: { code: 404, message: "Item not found" } });
    const { id: _id, ...payload } = parsePayload(req);
    data.items[idx] = { ...data.items[idx], ...payload, id };
    saveFile(SHOPPING_FILE, data);
    broadcast("shopping");
    res.json(data.items[idx]);
  } catch (err) { next(err); }
});

app.delete("/api/shopping/items/:id", (req, res, next) => {
  try {
    const data = safeLoad(SHOPPING_FILE, SAMPLE_SHOPPING);
    data.items = data.items.filter(i => i.id !== parseInt(req.params.id, 10));
    saveFile(SHOPPING_FILE, data);
    broadcast("shopping");
    res.json({ ok: true });
  } catch (err) { next(err); }
});

app.delete("/api/shopping/items/checked", (req, res, next) => {
  try {
    const { storeId } = req.query;
    const data = safeLoad(SHOPPING_FILE, SAMPLE_SHOPPING);
    data.items = data.items.filter(i => !i.checked || (storeId && i.storeId !== parseInt(storeId, 10)));
    saveFile(SHOPPING_FILE, data);
    broadcast("shopping");
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// ── Documents ─────────────────────────────────────────────────────────────────

app.get("/api/documents", (_, res) => res.json(safeLoad(DOCUMENTS_FILE, [])));

app.post("/api/documents", diskUpload.single("file"), (req, res, next) => {
  try {
    if (req.file) validateMagicBytes(req.file);
    const docs = safeLoad(DOCUMENTS_FILE, []);
    const { id: _id, ...payload } = parsePayload(req);
    const doc = {
      ...payload,
      id: nextId(docs),
      uploadedAt: new Date().toISOString().slice(0, 10),
      file: req.file ? req.file.filename : null,
      originalName: req.file ? sanitizeFilename(req.file.originalname) : null,
    };
    docs.push(doc);
    saveFile(DOCUMENTS_FILE, docs);
    broadcast("documents");
    res.json(doc);
  } catch (err) { next(err); }
});

app.put("/api/documents/:id", diskUpload.single("file"), (req, res, next) => {
  try {
    if (req.file) validateMagicBytes(req.file);
    const docs = safeLoad(DOCUMENTS_FILE, []);
    const id = parseInt(req.params.id, 10);
    const idx = docs.findIndex(d => d.id === id);
    if (idx === -1) return res.status(404).json({ error: { code: 404, message: "Document not found" } });
    const { id: _id, ...payload } = parsePayload(req);
    if (req.file && docs[idx].file) {
      try { fs.unlinkSync(path.join(UPLOADS_DIR, docs[idx].file)); } catch {}
    }
    docs[idx] = {
      ...docs[idx],
      ...payload,
      id,
      ...(req.file && { file: req.file.filename, originalName: sanitizeFilename(req.file.originalname) }),
    };
    saveFile(DOCUMENTS_FILE, docs);
    broadcast("documents");
    res.json(docs[idx]);
  } catch (err) { next(err); }
});

app.delete("/api/documents/:id", (req, res, next) => {
  try {
    const docs = safeLoad(DOCUMENTS_FILE, []);
    const doc = docs.find(d => d.id === parseInt(req.params.id, 10));
    if (doc?.file) { try { fs.unlinkSync(path.join(UPLOADS_DIR, doc.file)); } catch {} }
    saveFile(DOCUMENTS_FILE, docs.filter(d => d.id !== parseInt(req.params.id, 10)));
    broadcast("documents");
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// ── Contacts ──────────────────────────────────────────────────────────────────

app.get("/api/contacts", (_, res) => res.json(safeLoad(CONTACTS_FILE, [])));

app.post("/api/contacts", (req, res, next) => {
  try {
    const contacts = safeLoad(CONTACTS_FILE, []);
    const { id: _id, ...payload } = parsePayload(req);
    if (!payload.name) return res.status(400).json({ error: { code: 400, message: "name required" } });
    const contact = { ...payload, id: nextId(contacts) };
    contacts.push(contact);
    saveFile(CONTACTS_FILE, contacts);
    broadcast("contacts");
    res.json(contact);
  } catch (err) { next(err); }
});

app.put("/api/contacts/:id", (req, res, next) => {
  try {
    const contacts = safeLoad(CONTACTS_FILE, []);
    const id = parseInt(req.params.id, 10);
    const idx = contacts.findIndex(c => c.id === id);
    if (idx === -1) return res.status(404).json({ error: { code: 404, message: "Contact not found" } });
    const { id: _id, ...payload } = parsePayload(req);
    contacts[idx] = { ...contacts[idx], ...payload, id };
    saveFile(CONTACTS_FILE, contacts);
    broadcast("contacts");
    res.json(contacts[idx]);
  } catch (err) { next(err); }
});

app.delete("/api/contacts/:id", (req, res, next) => {
  try {
    const contacts = safeLoad(CONTACTS_FILE, []);
    saveFile(CONTACTS_FILE, contacts.filter(c => c.id !== parseInt(req.params.id, 10)));
    broadcast("contacts");
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// ── Inventory ─────────────────────────────────────────────────────────────────

app.get("/api/inventory", (_, res) => res.json(safeLoad(INVENTORY_FILE, [])));

app.post("/api/inventory", diskUpload.single("photo"), (req, res, next) => {
  try {
    if (req.file) validateMagicBytes(req.file);
    const items = safeLoad(INVENTORY_FILE, []);
    const { id: _id, ...payload } = parsePayload(req);
    const item = {
      ...payload,
      id: nextId(items),
      photo: req.file ? `/uploads/${req.file.filename}` : payload.photo || null,
    };
    items.push(item);
    saveFile(INVENTORY_FILE, items);
    broadcast("inventory");
    res.json(item);
  } catch (err) { next(err); }
});

app.put("/api/inventory/:id", diskUpload.single("photo"), (req, res, next) => {
  try {
    if (req.file) validateMagicBytes(req.file);
    const items = safeLoad(INVENTORY_FILE, []);
    const id = parseInt(req.params.id, 10);
    const idx = items.findIndex(i => i.id === id);
    if (idx === -1) return res.status(404).json({ error: { code: 404, message: "Item not found" } });
    const { id: _id, ...payload } = parsePayload(req);
    items[idx] = {
      ...items[idx],
      ...payload,
      id,
      photo: req.file ? `/uploads/${req.file.filename}` : payload.photo ?? items[idx].photo ?? null,
    };
    saveFile(INVENTORY_FILE, items);
    broadcast("inventory");
    res.json(items[idx]);
  } catch (err) { next(err); }
});

app.delete("/api/inventory/:id", (req, res, next) => {
  try {
    const items = safeLoad(INVENTORY_FILE, []);
    saveFile(INVENTORY_FILE, items.filter(i => i.id !== parseInt(req.params.id, 10)));
    broadcast("inventory");
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// ── Centralized error handler (must be last) ──────────────────────────────────

app.use(errorHandler);

app.listen(PORT, "0.0.0.0", () => console.log(`Backend running on :${PORT}`));
