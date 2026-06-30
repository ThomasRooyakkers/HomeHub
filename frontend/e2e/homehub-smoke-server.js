const fs = require("fs");
const os = require("os");
const path = require("path");

const port = Number(process.env.SMOKE_PORT || 5090);
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "homehub-smoke-"));
const buildDir = path.resolve(__dirname, "..", "build");
const indexHtml = path.join(buildDir, "index.html");

if (!fs.existsSync(indexHtml)) {
  console.error("Smoke server requires a frontend production build. Run `npm run build` first.");
  process.exit(1);
}

process.env.DATA_DIR = dataDir;
process.env.UPLOADS_DIR = path.join(dataDir, "uploads");
process.env.ADMIN_USERNAME = process.env.SMOKE_ADMIN_USERNAME || "admin";
process.env.ADMIN_PASSWORD = process.env.SMOKE_ADMIN_PASSWORD || "secret123";
process.env.SESSION_SECRET = process.env.SESSION_SECRET || "smoke-session-secret";
process.env.COOKIE_SECURE = "false";

const express = require("../../backend/node_modules/express");
const { app } = require("../../backend/server");

app.use(express.static(buildDir));
app.get("*", (_, res) => res.sendFile(indexHtml));

const server = app.listen(port, "127.0.0.1", () => {
  console.log(`HomeHub smoke server running on http://127.0.0.1:${port}`);
});

let closing = false;
const cleanup = () => {
  fs.rmSync(dataDir, { recursive: true, force: true });
};

const shutdown = (code = 0) => {
  if (closing) return;
  closing = true;
  server.close(() => {
    cleanup();
    process.exit(code);
  });
  setTimeout(() => {
    cleanup();
    process.exit(code);
  }, 3000).unref();
};

server.on("error", (error) => {
  console.error(error);
  cleanup();
  process.exit(1);
});

process.on("SIGTERM", () => shutdown(0));
process.on("SIGINT", () => shutdown(0));
process.on("uncaughtException", (error) => {
  console.error(error);
  shutdown(1);
});
