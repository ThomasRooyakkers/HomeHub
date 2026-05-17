# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

**Frontend (development)**
```bash
cd frontend && npm install && npm start   # dev server on :3000
cd frontend && npm run build              # production build → frontend/build/
```

**Backend**
```bash
cd backend && npm install && npm start    # runs on :3001
```

**Docker (production)**
```bash
docker-compose up --build   # serves on :5080
```

No test suite exists yet.

## Architecture

HomeHub is a single-household management dashboard with a **dual-mode design**: if the backend is reachable (`/api/ping`), it becomes the source of truth; if not, the app falls back silently to `localStorage`. This means all data mutations in `App.js` try `apiFetch` first and fall back to local state.

### Deployment topology

One Docker container runs nginx (port 80, mapped to host :5080) that:
- Serves the React static build for all non-`/api` and non-`/uploads` paths
- Reverse-proxies `/api/*` and `/uploads/*` to the Express backend on :3001
- `start.sh` starts both processes inside the container

### Data persistence

The backend stores everything as **JSON files** (not a database) under `DATA_DIR` (`/data` in Docker, backed by a named volume `homehub_data`):
- `/data/invoices.json`, `/data/recipes.json`, `/data/mealPlan.json`, `/data/maintenance.json`, `/data/calendar.json`
- File attachments in `/data/uploads/` using UUID-based filenames

`backend/config.js` is the single source for all paths and env-driven settings (`PORT`, `DATA_DIR`, `UPLOADS_DIR`, `UPLOAD_MAX_MB`, `CORS_ORIGIN`).

### Frontend state model

All application state lives in `App.js`. Feature components (`InvoiceTracker`, `MealPlanner`, `Maintenance`, `CalendarView`, `PlantManager`, `Weather`) are stateless — they receive state and setters as props. `App.js` owns all API calls and passes `apiEnabled` + `showToast` down to every module.

`frontend/src/lib/api.js` (`apiFetch`) wraps every backend call: returns `null` on any failure so callers fall back to local state.

### Backend structure

`backend/server.js` is a single-file Express app — no route splitting. Key middleware:
- `middleware/upload.js` — two multer instances: `diskUpload` (saves to `/data/uploads/` with UUID filename) and `memUpload` (memory buffer, used only for OCR). Allows PDF, JPEG, PNG, WEBP up to `UPLOAD_MAX_MB`.
- `middleware/validate.js` — validates invoice payloads.
- `middleware/error.js` — centralized error handler (last middleware).

The multipart upload routes accept a JSON field named `data` alongside the file — `parsePayload()` handles this so form submissions can include structured data.

### OCR

`backend/services/ocr.js` uses Tesseract.js (image-only; PDFs return `{ isPdf: true }` immediately). The worker is lazily initialized and cached as a module-level singleton. OCR results are word-level bounding boxes that the frontend uses to suggest field values — extracted data is never auto-saved.

### Calendar

Calendars are imported server-side via `POST /api/calendar-import` (ICS/webcal URLs), parsed by the inline `parseICS()` function in `server.js`. Events are stored in `calendar.json` alongside provider metadata. The frontend refreshes URL-based providers hourly when `apiEnabled`.

### Weather

Hardcoded to Houthalen-Helchteren, BE (lat 51.05, lon 5.45) via Open-Meteo (no API key). The frontend can fetch directly from Open-Meteo as a fallback when the backend is unavailable.

## Environment variables

Copy `.env.example` to `.env` and set:
- `DATA_DIR` — defaults to `/data`
- `PORT` — backend port, defaults to `3001`
- `UPLOAD_MAX_MB` — defaults to `10`
- `CORS_ORIGIN` — leave unset in Docker (nginx handles routing); set to frontend origin in split-host dev
