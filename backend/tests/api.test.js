const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const request = require("supertest");
const AdmZip = require("adm-zip");

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "homehub-api-"));

process.env.DATA_DIR = dataDir;
process.env.UPLOADS_DIR = path.join(dataDir, "uploads");
process.env.ADMIN_USERNAME = "admin";
process.env.ADMIN_PASSWORD = "secret123";
process.env.SESSION_SECRET = "test-session-secret";
process.env.COOKIE_SECURE = "false";

const { app, parseICS } = require("../server");

const ADMIN = { username: "admin", password: "secret123" };

const removeDataFiles = (...names) => {
  for (const name of names) {
    fs.rmSync(path.join(dataDir, name), { force: true });
  }
};

const loginAs = async ({ username, password } = ADMIN) => {
  const agent = request.agent(app);
  await agent
    .post("/api/auth/login")
    .send({ username, password })
    .expect(200);
  return agent;
};

const binaryParser = (res, callback) => {
  const chunks = [];
  res.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
  res.on("end", () => callback(null, Buffer.concat(chunks)));
};

test.after(() => {
  fs.rmSync(dataDir, { recursive: true, force: true });
});

test("public health endpoints work while protected APIs require authentication", async () => {
  await request(app).get("/api/ping").expect(200, { ok: true });
  await request(app).get("/api/health").expect(200);

  const res = await request(app).get("/api/invoices").expect(401);
  assert.equal(res.body.error.message, "Authentication required");
});

test("admin-only endpoints reject authenticated non-admin users", async () => {
  const admin = await loginAs();
  const username = `user-${Date.now()}`;

  await admin
    .post("/api/admin/users")
    .send({ username, password: "userpass123", role: "user" })
    .expect(200);

  const user = await loginAs({ username, password: "userpass123" });
  const res = await user.get("/api/admin/stats").expect(403);

  assert.equal(res.body.error.message, "Admin only");
});

test("invoice CRUD persists JSON-backed records", async () => {
  removeDataFiles("invoices.json", "activity.json");
  const agent = await loginAs();

  const created = await agent
    .post("/api/invoices")
    .send({
      vendor: "Smoke Utilities",
      amount: 42.5,
      dueDate: "2026-07-15",
      category: "Utilities",
      status: "unpaid",
    })
    .expect(200);

  assert.equal(created.body.vendor, "Smoke Utilities");
  assert.match(created.body.invoiceNo, /^INV-\d{4}-\d{4}$/);

  const listed = await agent.get("/api/invoices").expect(200);
  assert.ok(listed.body.some((invoice) => invoice.id === created.body.id));

  const updated = await agent
    .put(`/api/invoices/${created.body.id}`)
    .send({ ...created.body, amount: 55, status: "paid" })
    .expect(200);

  assert.equal(updated.body.amount, 55);
  assert.equal(updated.body.status, "paid");

  await agent.delete(`/api/invoices/${created.body.id}`).expect(200, { ok: true });

  const afterDelete = await agent.get("/api/invoices").expect(200);
  assert.equal(afterDelete.body.some((invoice) => invoice.id === created.body.id), false);
});

test("settings updates require admin and normalize feature flags", async () => {
  removeDataFiles("settings.json", "activity.json");

  await request(app)
    .put("/api/settings")
    .send({ appName: "Rejected" })
    .expect(401);

  const agent = await loginAs();
  const res = await agent
    .put("/api/settings")
    .send({
      appName: "Test Hub",
      householdName: "Smoke House",
      currency: "USD",
      accentColor: "#123456",
      location: "Brussels",
      enabledFeatures: { invoices: false, meal: true },
    })
    .expect(200);

  assert.equal(res.body.appName, "Test Hub");
  assert.equal(res.body.currency, "USD");
  assert.equal(res.body.enabledFeatures.invoices, false);
  assert.equal(res.body.enabledFeatures.meal, true);
  assert.equal(res.body.enabledFeatures.shopping, true);
});

test("multipart upload rejects files whose magic bytes do not match supported types", async () => {
  removeDataFiles("invoices.json", "activity.json");
  const agent = await loginAs();

  const res = await agent
    .post("/api/invoices")
    .field("data", JSON.stringify({
      vendor: "Bad Attachment",
      amount: 12,
      dueDate: "2026-07-20",
      status: "unpaid",
    }))
    .attach("file", Buffer.from("this is not a png"), {
      filename: "invoice.png",
      contentType: "image/png",
    })
    .expect(415);

  assert.match(res.body.error.message, /File content does not match/);
});

test("backup export includes JSON data files and uploaded file entries", async () => {
  removeDataFiles("invoices.json", "activity.json");
  const agent = await loginAs();

  await agent
    .post("/api/invoices")
    .send({ vendor: "Backup Vendor", amount: 100, dueDate: "2026-08-01" })
    .expect(200);

  const res = await agent
    .get("/api/admin/export.zip")
    .buffer(true)
    .parse(binaryParser)
    .expect(200)
    .expect("Content-Type", /application\/zip/);

  const zip = new AdmZip(res.body);
  const entries = zip.getEntries().map((entry) => entry.entryName);
  assert.ok(entries.includes("data/invoices.json"));
  assert.ok(entries.includes("data/users.json"));

  const invoices = JSON.parse(zip.readAsText("data/invoices.json"));
  assert.ok(invoices.some((invoice) => invoice.vendor === "Backup Vendor"));
});

test("calendar import parses ICS and calendar save deduplicates repeated events", async () => {
  removeDataFiles("calendar.json", "activity.json");
  const agent = await loginAs();
  const ics = [
    "BEGIN:VCALENDAR",
    "BEGIN:VEVENT",
    "UID:event-1",
    "SUMMARY:Dentist",
    "DTSTART:20260701T090000Z",
    "DTEND:20260701T093000Z",
    "LOCATION:Clinic",
    "END:VEVENT",
    "BEGIN:VEVENT",
    "UID:event-2",
    "SUMMARY:School pickup",
    "DTSTART;VALUE=DATE:20260702",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\n");

  const parsed = parseICS(ics, "Family");
  assert.equal(parsed.length, 2);
  assert.equal(parsed[0].title, "Dentist");
  assert.equal(parsed[0].provider, "Family");

  const originalFetch = global.fetch;
  global.fetch = async () => new Response(ics, {
    status: 200,
    headers: { "Content-Type": "text/calendar" },
  });

  let imported;
  try {
    imported = await agent
      .post("/api/calendar-import")
      .send({ url: "https://calendar.example/family.ics", provider: "Family" })
      .expect(200);
  } finally {
    global.fetch = originalFetch;
  }

  assert.equal(imported.body.count, 2);
  assert.equal(imported.body.events[1].title, "School pickup");

  const event = { ...imported.body.events[0], calendarId: 1 };
  const saved = await agent
    .put("/api/calendar")
    .send({
      providers: [{ id: 1, provider: "Family", source: "https://calendar.example/family.ics" }],
      events: [event, { ...event, title: "Duplicate Dentist" }],
    })
    .expect(200);

  assert.equal(saved.body.events.length, 1);
  assert.equal(saved.body.events[0].title, "Dentist");
});
