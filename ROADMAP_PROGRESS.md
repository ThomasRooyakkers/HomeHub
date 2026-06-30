# Roadmap Progress

Updated: 2026-06-30

Implemented in this pass:

- Backend API test coverage for auth/admin guards, invoice CRUD, settings updates, upload validation, backup ZIP export, and calendar ICS parsing/deduplication.
- Frontend helper coverage for ingredient parsing and global search indexing.
- Playwright smoke coverage for login, dashboard load, quick-add invoice, shopping item creation, meal planner navigation, and admin stats.
- Root test scripts for backend, frontend, combined, and browser smoke runs.
- Backup, restore, and CSV export backend endpoints.
- Admin Data tab for backup download, ZIP restore, and CSV exports.
- Activity log storage, endpoints, filters, and Admin Activity tab.
- Audit events for invoices, documents, inventory, calendar, users, settings, backup, and recurring invoice generation.
- Recurring invoice template backend endpoints and manual invoice generation.
- Invoice Tracker Recurring tab with create, edit, delete, and generate actions.
- Meal-to-shopping workflow from recipe detail and weekly meal plan, with store selection, checklist review, and unchecked duplicate skipping.
- Calendar improvements: provider colors, persisted provider metadata, duplicate-safe event persistence, manual event create/edit/delete, and event detail modal.
- Initial frontend coverage for `apiFetch` and date/week/status utility behavior.
- Offline sync improvements: safe cached user profile, queued JSON mutation storage, reconnect polling, replay in order, sidebar Online/Offline/Syncing indicator, and queue coverage for App-owned toggles, quick add, invoices, recurring invoices, meal plan/recipes, calendar, and shopping list JSON mutations.

Verified:

- `npm test` passes.
- `npm run test:backend` passes.
- `npm run test:frontend` passes.
- `npm run test:smoke` passes.
- `frontend npm run build` passes.
- The Playwright smoke server starts and `/api/health` returns ok.
- `backend/server.js` passes `node --check`.
- `backend/middleware/upload.js` passes `node --check`.
- `frontend` production build passes.
- `frontend npm test -- --runInBand` passes.

Not completed in this pass:

- File upload offline queueing remains intentionally deferred.
