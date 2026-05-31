# HomeHub

A single-household management dashboard: invoices, shopping lists, meal planning,
maintenance, calendar, plants, documents, contacts and inventory — in one place.

The app runs in **dual mode**: when the backend is reachable it is the source of
truth; if it is unavailable the UI falls back to `localStorage` so it keeps working
offline. It is also installable as a PWA ("Add to Home Screen").

## Project structure

- `frontend/` — React app (Create React App)
- `backend/` — single-file Express API; data persisted as JSON files under `DATA_DIR`
- `Dockerfile`, `docker-compose.yml`, `nginx.conf`, `start.sh` — deployment

## Development

```bash
cd backend  && npm install && npm start   # API on :3001
cd frontend && npm install && npm start   # dev server on :3000
```

When running split-host in dev, set `CORS_ORIGIN` in the backend `.env` to the
frontend origin (e.g. `http://localhost:3000`).

## Production (Docker)

```bash
cp .env.example .env   # then fill in the values (see below)
docker-compose up --build
```

nginx serves the React build and reverse-proxies `/api/*` and `/uploads/*` to the
Express backend. The stack is exposed via a Cloudflare Tunnel.

## Configuration

All settings live in `.env` (never commit it). See `.env.example` for the full list.
Key values:

- `SESSION_SECRET` — required in production; generate with
  `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
- `ADMIN_USERNAME` / `ADMIN_PASSWORD` — seed the first admin account on first boot
  (use a strong password — at least 20 characters)
- `COOKIE_SECURE` — keep `true` in production (HTTPS); set `false` only for local
  non-HTTPS development
- `CLOUDFLARE_TUNNEL_TOKEN` — token for the `cloudflared` tunnel container

## Features

- **Invoices** — status tracking, overdue detection, PDF/image attachments with
  in-browser preview and click-to-fill OCR field assignment
- **Shopping** — BRING-style per-store lists with auto-detected grocery icons
- **Meals** — weekly planner plus a recipe cookbook with image upload
- **Maintenance** — recurring tasks with photo evidence
- **Calendar** — import ICS/webcal feeds, hourly auto-refresh
- **Plants** — watering/feeding schedules
- **Documents** — categorised vault with preview
- **Contacts** & **Inventory** — household directory and asset tracking
- **Admin** — user management, settings, storage stats
- Session-cookie authentication (bcrypt, rate-limited login)
