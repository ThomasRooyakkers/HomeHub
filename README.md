# Home Hub Dashboard

A polished green-themed dashboard for household management, combining invoice tracking, meal planning with recipe management, and home maintenance tasks.

## Project structure

- `frontend/` — React app for the Home Hub user interface
- `backend/` — Express backend for invoice file uploads and storage
- `Dockerfile`, `docker-compose.yml`, `nginx.conf`, `start.sh` — deployment configuration

## Available workspaces

### Frontend

```bash
cd frontend
npm install
npm start
```

Build the frontend:

```bash
npm run build
```

### Backend

```bash
cd backend
npm install
npm start
```

## App features

- Invoice tracker with status, overdue detection, and attachments
- Meal planner with weekly overview, recipe library, and meal prefills
- Recipe editor with image upload support
- Home maintenance task tracker with recurring reminders and photo attachments
- Persistent local storage for invoice, meal, recipe, and maintenance data

## Docker

Use Docker Compose to run the full stack:

```bash
docker-compose up --build
```

## Notes

The project is designed as a home dashboard prototype and is ready for further extension with backend persistence and user authentication.
