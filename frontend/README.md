# Home Hub Frontend

This React application powers the Home Hub dashboard for invoice management, weekly meal planning, and home maintenance tracking.

## Available Scripts

In the `frontend/` directory, run:

### `npm install`

Installs the project dependencies.

### `npm start`

Runs the app in development mode. Open [http://localhost:3000](http://localhost:3000) to view it.

### `npm run build`

Builds the app for production in the `build/` folder.

### `npm test`

Runs the test suite.

## Features

- Invoice tracker with overdue status detection and attachment support
- Meal planner with weekly view, today’s cooking summary, and recipe selection
- Recipe library with image upload, edit, and quick preview
- Home maintenance tracker with recurring tasks, due dates, photo notes, and completion toggles
- Local data persistence via `localStorage`

## Deployment

Use the root project `docker-compose.yml` or build the frontend separately.

```bash
cd frontend
npm run build
```
