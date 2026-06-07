# HomeHub Roadmap

This roadmap covers the planned feature additions, excluding Reminder Center and Notifications.

## 1. Backup, Restore, Export

Add admin-only data safety tools.

Backend endpoints:

- `GET /api/admin/export.zip`
- `POST /api/admin/restore`
- `GET /api/admin/export/:resource.csv`

Implementation details:

- Include all JSON data files and uploads in the zip export.
- Validate restore archive structure before replacing data.
- Restore into a temporary directory first, then swap files.
- Export CSV for invoices, documents, contacts, inventory, recipes, maintenance, and plants.
- Add a backend helper that lists data files from `backend/config.js`.
- Add a new Admin `Data` tab with backup, restore, and CSV export controls.
- Restrict all actions to admin users.

## 3. Activity Log

Add an audit trail for important actions.

Backend data file:

- `activity.json`

Backend helper:

```js
logActivity(req, {
  resource,
  action,
  entityId,
  label,
  details
});
```

Track:

- Invoice created, updated, deleted, paid
- Document created, updated, deleted
- Inventory created, updated, deleted
- Calendar imported or provider deleted
- User created, deleted, or password changed
- Settings changed
- Backup restored

Endpoints:

- `GET /api/activity`
- Optional admin cleanup: `DELETE /api/activity`

Frontend:

- Add Admin `Activity` tab.
- Add filters for user, resource, and action.

## 4. Offline Sync Improvements

Improve offline behavior while preserving authenticated access expectations.

Desired behavior:

- If a safe cached user profile exists, allow cached offline mode when the backend is unreachable.
- If no cached user exists, require login.

Implementation details:

- Store a safe cached user profile in `localStorage`.
- Add a `syncQueue` in `localStorage`.
- For offline mutations, apply local state immediately and enqueue:
  - HTTP method
  - endpoint
  - body
  - resource
  - temporary local id
  - timestamp
- On backend reconnect, replay the queue in order.
- Resolve temporary ids after successful creates.
- Add an `Offline` / `Syncing` status indicator in the sidebar.
- Start with JSON-only operations.
- Keep file uploads online-only at first, or move queued uploads to IndexedDB in a later phase.

## 5. Document Expiry And Linking

Make the document vault useful for renewals and relationships.

Extend document model:

```js
{
  expiryDate,
  tags: [],
  linkedContactIds: [],
  linkedInventoryIds: [],
  linkedInvoiceIds: [],
  notes
}
```

Frontend:

- Add expiry date field.
- Add tag input.
- Add link selectors for contacts, inventory, and invoices.
- Add `Expiring soon` filter.
- Add related items panel in document preview.

Backend:

- Existing document routes can keep accepting flexible payloads.
- Add validation for field shapes.

## 6. Inventory Warranty Intelligence

Expand inventory into warranty and claim tracking.

Extend inventory model:

```js
{
  purchaseDate,
  warrantyUntil,
  purchasePrice,
  replacementValue,
  serialNumber,
  modelNumber,
  linkedDocumentIds: [],
  linkedContactIds: [],
  claimNotes
}
```

Frontend:

- Add warranty status badge.
- Add filters for active warranty, expired warranty, and missing documents.
- Link inventory items to documents.
- Link inventory items to contacts such as vendor, installer, or repair company.
- Add purchase value and replacement value summary.

## 7. Meal-To-Shopping Workflow

Turn recipes and meal plans into shopping items.

Features:

- Add `Add ingredients to shopping list` from recipe detail.
- Add `Add week ingredients` from the meal plan.
- Let the user choose a target store.
- Show a checklist before adding.
- Skip duplicates already unchecked in the target store.

Implementation details:

- Pass `shopping` and `setShopping` into `MealPlanner` from `App.js`.
- Reuse `/api/shopping/items`.
- Keep parsing simple in the first version: one ingredient line becomes one shopping item.
- Preserve quantity in the item name.
- Optionally add source metadata such as `{ source: "recipe", recipeId }`.

## 8. Recurring Invoice / Subscription Templates

Add recurring bill templates for predictable household costs.

Backend data file:

- `recurringInvoices.json`

Endpoints:

- `GET /api/recurring-invoices`
- `POST /api/recurring-invoices`
- `PUT /api/recurring-invoices/:id`
- `DELETE /api/recurring-invoices/:id`
- `POST /api/recurring-invoices/:id/generate`

Template model:

```js
{
  vendor,
  amount,
  category,
  frequency: "monthly" | "quarterly" | "yearly",
  dayOfMonth,
  nextDueDate,
  notes,
  active
}
```

Frontend:

- Add a `Recurring` tab inside `InvoiceTracker`.
- Show upcoming generated invoices.
- Add manual `Generate next invoice` action.

Generation rules:

- Generate only when `nextDueDate <= today`.
- Avoid duplicate invoices for the same template period.
- Keep automatic generation conservative and auditable.

## 9. Calendar Improvements

Improve calendar reliability and editing.

Backend:

- Store provider metadata:
  - color
  - lastRefreshAt
  - lastError
  - eventCount
- Deduplicate imported events by `uid + provider/calendarId`.
- Preserve provider color in events.

Frontend:

- Add manual event creation, editing, and deletion.
- Add provider color picker.
- Show refresh status per provider.
- Show import error history.
- Add duplicate-safe refresh behavior.
- Add event detail drawer.

Initial implementation can continue using `PUT /api/calendar`, with cleaner route splitting deferred.

## 10. Test And Smoke Coverage

Add focused automated coverage.

Backend tests:

- Invoice CRUD
- Auth guard and admin guard
- Settings update
- Upload validation
- Backup export
- Calendar import parsing and deduplication

Frontend tests:

- `apiFetch`
- Ingredient parsing
- Search indexing
- Offline queue helpers

Playwright smoke test:

- Login
- Dashboard loads
- Quick-add invoice
- Add shopping item
- Open meal planner
- Open admin stats

Suggested scripts:

```json
{
  "test": "react-scripts test --watchAll=false",
  "test:e2e": "playwright test"
}
```

## Recommended Order

1. Backup, restore, export
2. Global search
3. Meal-to-shopping workflow
4. Document expiry and linking
5. Inventory warranty intelligence
6. Recurring invoice templates
7. Calendar improvements
8. Activity log
9. Offline sync improvements
10. Test and smoke coverage

This order starts with data safety, then improves daily usefulness, then adds richer cross-module relationships and infrastructure.
