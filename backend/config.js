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
  UPLOAD_MAX_MB: parseInt(process.env.UPLOAD_MAX_MB || "10", 10),
  CORS_ORIGIN: process.env.CORS_ORIGIN || null,
  WEATHER_LAT: process.env.WEATHER_LAT || "51.05",
  WEATHER_LON: process.env.WEATHER_LON || "5.45",
  WEATHER_LOCATION: process.env.WEATHER_LOCATION || "Houthalen-Helchteren, BE",
  HUE_BRIDGE_IP: process.env.HUE_BRIDGE_IP || null,
  HUE_API_KEY: process.env.HUE_API_KEY || null,
};
