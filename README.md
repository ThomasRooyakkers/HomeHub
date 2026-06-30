# HomeHub

> A self-hosted household management dashboard for organizing invoices, shopping lists, meals, maintenance, documents, contacts, inventory, and more — all in one place.

HomeHub is a personal home-management app designed for single-household use. It combines everyday household tools into one clean dashboard and can be run locally or self-hosted with Docker.

<img width="1352" height="821" alt="image" src="https://github.com/user-attachments/assets/087c0335-7cba-4215-b356-86afbeede747" />


---

## Features

### Household management

| Area            | What it does                                                                                             |
| --------------- | -------------------------------------------------------------------------------------------------------- |
| **Invoices**    | Track invoice status, due dates, overdue items, attachments, previews, and OCR-assisted field assignment |
| **Shopping**    | Create per-store shopping lists with grocery-style item organization                                     |
| **Meals**       | Plan weekly meals and manage a recipe cookbook with image uploads                                        |
| **Maintenance** | Track recurring household tasks and attach photo evidence                                                |
| **Calendar**    | Import ICS/webcal feeds with automatic refresh                                                           |
| **Plants**      | Manage watering and feeding schedules                                                                    |
| **Documents**   | Store and preview household documents in a categorized vault                                             |
| **Contacts**    | Keep important household contacts in one place                                                           |
| **Inventory**   | Track household assets and stored items                                                                  |
| **Admin**       | Manage users, settings, and storage statistics                                                           |

---

## Why HomeHub?

Most household information ends up scattered across notes apps, cloud drives, spreadsheets, reminders, and paper documents. HomeHub brings those practical workflows together in a single self-hosted interface.

It is built for people who want:

* A private household dashboard
* One place for invoices, documents, meals, and tasks
* A Docker-based self-hosted setup
* A mobile-friendly app that can be installed as a PWA
* Offline-friendly behavior when the backend is temporarily unavailable

---

## How it works

HomeHub has two operating modes:

* **Backend available:** the Express API is used as the source of truth.
* **Backend unavailable:** the frontend falls back to `localStorage`, so the UI can continue working offline.

The app is also installable as a Progressive Web App, allowing it to be added to a phone or tablet home screen.

---

## Tech stack

| Layer           | Technology                                  |
| --------------- | ------------------------------------------- |
| Frontend        | React                                       |
| Backend         | Node.js, Express                            |
| Storage         | JSON files under `DATA_DIR`                 |
| Auth            | Session cookies, bcrypt, rate-limited login |
| Uploads         | Local file storage                          |
| OCR             | Tesseract.js                                |
| Deployment      | Docker, Docker Compose, nginx               |
| Optional access | Cloudflare Tunnel                           |

---

## Project structure

```text
HomeHub/
├── frontend/              # React application
├── backend/               # Express API
├── Dockerfile             # Production image
├── docker-compose.yml     # Self-hosted deployment
├── nginx.conf             # Serves frontend and proxies API/uploads
├── start.sh               # Container startup script
├── .env.example           # Environment variable template
└── README.md
```

---

## Getting started

### 1. Clone the repository

```bash
git clone https://github.com/ThomasRooyakkers/HomeHub.git
cd HomeHub
```

### 2. Create your environment file

```bash
cp .env.example .env
```

Then edit `.env` and fill in the required values.

At minimum, set:

```env
SESSION_SECRET=
ADMIN_USERNAME=admin
ADMIN_PASSWORD=
```

Generate a strong session secret with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Use a strong admin password, preferably 20+ characters.

### 3. Start with Docker Compose

```bash
docker-compose up --build
```

The stack builds the frontend, starts the backend, serves the app through nginx, and stores persistent data in a Docker volume.

---

## Configuration

All configuration lives in `.env`.

| Variable                  | Description                                        |
| ------------------------- | -------------------------------------------------- |
| `PORT`                    | Internal backend port, usually `3001`              |
| `DATA_DIR`                | Directory for persistent app data                  |
| `UPLOADS_DIR`             | Directory for uploaded files                       |
| `UPLOAD_MAX_MB`           | Maximum upload size in MB                          |
| `CORS_ORIGIN`             | Allowed frontend origin for split-host development |
| `SESSION_SECRET`          | Required secret used for session signing           |
| `COOKIE_SECURE`           | Keep `true` in production with HTTPS               |
| `ADMIN_USERNAME`          | Initial admin username                             |
| `ADMIN_PASSWORD`          | Initial admin password                             |
| `CLOUDFLARE_TUNNEL_TOKEN` | Optional Cloudflare Tunnel token                   |

Never commit your `.env` file.

---

## Development

Run the backend:

```bash
cd backend
npm install
npm start
```

Run the frontend:

```bash
cd frontend
npm install
npm start
```

The backend runs on port `3001` and the frontend development server runs on port `3000`.

When running the frontend and backend separately, set `CORS_ORIGIN` in the backend `.env` file:

```env
CORS_ORIGIN=http://localhost:3000
```

---

## Testing

Run the focused backend and frontend test suites:

```bash
npm test
```

Individual suites:

```bash
npm run test:backend
npm run test:frontend
```

Run the browser smoke test:

```bash
npm run test:smoke
```

The smoke test builds the frontend, starts a production-like local server that mounts the real backend and static build, then drives the login/dashboard/quick-add/shopping/meals/admin flow with Playwright. On a fresh Linux/WSL install, install Playwright's Chromium system dependencies first:

```bash
cd frontend
npx playwright install-deps chromium
```

---

## Production deployment

The production setup uses:

* nginx to serve the React build
* nginx reverse proxying for `/api/*` and `/uploads/*`
* Express for the backend API
* Docker volume storage for persistent data
* Optional Cloudflare Tunnel access

Start the stack with:

```bash
docker-compose up --build -d
```

View logs:

```bash
docker-compose logs -f
```

Stop the stack:

```bash
docker-compose down
```

---

## Security notes

HomeHub is intended for self-hosted household use.

Before exposing it publicly:

* Use HTTPS
* Keep `COOKIE_SECURE=true`
* Use a strong `SESSION_SECRET`
* Use a strong admin password
* Restrict access where possible
* Keep backups of your Docker volume
* Review the code before relying on it for sensitive documents

This project has not been externally security-audited.

---

## Current status

HomeHub is an early-stage personal project built iteratively with AI-assisted development. It is functional, but still evolving.

Feedback, suggestions, and pull requests are welcome, especially around:

* Setup documentation
* Security hardening
* UI/UX improvements
* Modular feature design
* Backup and restore workflows
* Multi-household or multi-user improvements

---

## Roadmap ideas

* [ ] Add screenshots and demo GIFs
* [ ] Add first release
* [ ] Add backup and restore documentation
* [ ] Add import/export tools
* [x] Add automated tests
* [ ] Add example deployment guide
* [ ] Add more granular user permissions

---

## Contributing

Contributions are welcome.

Good first areas to help with:

* Documentation improvements
* Bug reports
* UI polish
* Docker/self-hosting improvements
* Security review
* Feature suggestions

Please open an issue before starting larger changes.

---

## License

MIT

If you plan to publish this more broadly, add a root `LICENSE` file so GitHub can detect the license automatically.
