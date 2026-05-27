const path = require("path");

const DATA_DIR = process.env.DATA_DIR || "/data";

module.exports = {
  PORT: parseInt(process.env.PORT || "3001", 10),
  DATA_DIR,
  UPLOADS_DIR: process.env.UPLOADS_DIR || path.join(DATA_DIR, "uploads"),
  INVOICES_FILE: path.join(DATA_DIR, "invoices.json"),
  RECIPES_FILE: path.join(DATA_DIR, "recipes.json"),
  MEALPLAN_FILE: path.join(DATA_DIR, "mealPlan.json"),
  MAINTENANCE_FILE: path.join(DATA_DIR, "maintenance.json"),
  CALENDAR_FILE: path.join(DATA_DIR, "calendar.json"),
  PLANTS_FILE: path.join(DATA_DIR, "plants.json"),
  USERS_FILE: path.join(DATA_DIR, "users.json"),
  UPLOAD_MAX_MB: parseInt(process.env.UPLOAD_MAX_MB || "10", 10),
  CORS_ORIGIN: process.env.CORS_ORIGIN || null,
  SESSION_SECRET: process.env.SESSION_SECRET || null,
  COOKIE_SECURE: process.env.COOKIE_SECURE === "true",
};
