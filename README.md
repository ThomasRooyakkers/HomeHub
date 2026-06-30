# HomeHub

> A self-hosted household management dashboard for invoices, shopping, meals, maintenance, calendars, documents, contacts, inventory, plants, and household tasks.

HomeHub is built for a single household that wants practical private tooling without stitching together notes, spreadsheets, cloud folders, and reminder apps. It can run locally for development or as a Docker-based self-hosted app.

<img width="1352" height="821" alt="HomeHub dashboard screenshot" src="https://github.com/user-attachments/assets/087c0335-7cba-4215-b356-86afbeede747" />

## Features

| Area | What it does |
| --- | --- |
| Invoices | Track status, due dates, overdue items, attachments, previews, OCR suggestions, and recurring invoice templates |
| Shopping | Manage per-store shopping lists and add ingredients from recipes or meal plans |
| Meals | Plan weekly meals, store recipes, upload recipe images, and send ingredients to shopping lists |
| Maintenance | Track recurring household tasks with due dates and photo evidence |
| Calendar | Import ICS/webcal feeds, refresh providers, color-code events, and add manual events |
| Plants | Manage watering and feeding schedules |
| Documents | Store, categorize, preview, edit, and remove household documents |
| Contacts | Keep important household contacts in one place |
| Inventory | Track household assets, photos, linked documents, warranty details, and replacement values |
| Admin | Manage users, settings, backups, CSV exports, storage stats, and activity history |

## How It Works

HomeHub has two operating modes:

- Backend available: the Express API is the source of truth.
- Backend unavailable: the frontend falls back to local browser storage so the UI remains usable.

The app is installable as a Progressive Web App, so it can be added to a phone or tablet home screen from the browser.

## Tech Stack

| Layer | Technology |
| --- | --- |
| Frontend | React |
| Backend | Node.js, Express |
| Storage | JSON files under `DATA_DIR` |
| Auth | Session cookies, bcrypt, rate-limited login |
| Uploads | Local file storage |
| OCR | Tesseract.js |
| Deployment | Docker, Docker Compose, nginx |
| Optional access | Cloudflare Tunnel |

## Quick Start

Clone the repository:

```bash
git clone https://github.com/ThomasRooyakkers/HomeHub.git
cd HomeHub
```

Create an environment file:

```bash
cp .env.example .env
```

At minimum, set these values in `.env`:

```env
SESSION_SECRET=
ADMIN_USERNAME=admin
ADMIN_PASSWORD=
```

Generate a strong session secret:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Use a strong admin password, preferably 20 or more characters.

Start the Docker stack:

```bash
docker compose up --build
```

Open `http://localhost:5080`.

## Configuration

Runtime configuration lives in `.env`.

| Variable | Description |
| --- | --- |
| `APP_PORT` | Host port for the nginx frontend/API container. Defaults to `5080` |
| `PORT` | Internal backend port. Defaults to `3001` |
| `DATA_DIR` | Directory for persistent app data inside the container |
| `UPLOADS_DIR` | Directory for uploaded files |
| `UPLOAD_MAX_MB` | Maximum upload size in MB |
| `CORS_ORIGIN` | Allowed frontend origin for split-host development |
| `SESSION_SECRET` | Required secret used for session signing |
| `COOKIE_SECURE` | Set `true` when serving over HTTPS. Use `false` for local HTTP |
| `ADMIN_USERNAME` | Initial admin username |
| `ADMIN_PASSWORD` | Initial admin password |
| `CLOUDFLARE_TUNNEL_TOKEN` | Optional Cloudflare Tunnel token |

Never commit your `.env` file.

## Development

Install and run the backend:

```bash
cd backend
npm install
npm start
```

Install and run the frontend:

```bash
cd frontend
npm install
npm start
```

The backend runs on port `3001` and the frontend development server runs on port `3000`.

When running the frontend and backend separately, set `CORS_ORIGIN` in the backend environment:

```env
CORS_ORIGIN=http://localhost:3000
COOKIE_SECURE=false
```

## Testing

Run all tests from the repository root:

```bash
npm test
```

Run individual suites:

```bash
npm run test:backend
npm run test:frontend
npm run test:smoke
```

The smoke test builds the frontend, starts a production-like local server, and drives a browser through core flows with Playwright. On a fresh Linux or WSL install, install Playwright's Chromium system dependencies first:

```bash
cd frontend
npx playwright install-deps chromium
```

## Production Deployment

The production container uses nginx to serve the React build, proxy `/api/*` and `/uploads/*` to Express, and persist data in the `homehub_data` Docker volume.

Start in the background:

```bash
docker compose up --build -d
```

View logs:

```bash
docker compose logs -f
```

Stop the stack:

```bash
docker compose down
```

To use Cloudflare Tunnel, set `CLOUDFLARE_TUNNEL_TOKEN` and `COOKIE_SECURE=true` in `.env`, then start the optional tunnel profile:

```bash
docker compose --profile tunnel up --build -d
```

## Data Persistence

By default, Docker stores all persistent data in the `homehub_data` volume:

- JSON data files for invoices, recipes, meal plans, maintenance, calendar, plants, users, settings, shopping, documents, contacts, inventory, activity, and recurring invoices
- Uploaded files under `/data/uploads`
- Session data under `/data/sessions`

Use the Admin data tools to export a backup ZIP or CSV files for supported resources.

## Project Structure

```text
HomeHub/
|-- frontend/              # React application
|-- backend/               # Express API
|-- Dockerfile             # Production image
|-- docker-compose.yml     # Self-hosted deployment
|-- nginx.conf             # Serves frontend and proxies API/uploads
|-- start.sh               # Container startup script
|-- .env.example           # Environment variable template
|-- LICENSE
`-- README.md
```

## Security Notes

HomeHub is intended for self-hosted household use. Before exposing it beyond a trusted network:

- Use HTTPS.
- Set `COOKIE_SECURE=true` when serving over HTTPS.
- Use a strong `SESSION_SECRET`.
- Use a strong admin password.
- Restrict access where possible.
- Keep tested backups of your Docker volume.
- Review the code before relying on it for sensitive documents.

This project has not been externally security-audited.

## Contributing

Contributions are welcome. Useful areas include documentation, bug reports, UI polish, Docker/self-hosting improvements, security review, and feature suggestions.

Please open an issue before starting larger changes.

## License

MIT. See [LICENSE](LICENSE).
