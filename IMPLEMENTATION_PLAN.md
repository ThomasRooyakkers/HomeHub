# HomeHub — Implementation Plan

_Audit date: 2026-05-16_
_Scope: code quality & architecture, feature gaps & UX_
_Depth: detailed plan with file pointers_

---

## 0. Scope note (read first)

Only the project spec is present in the synced workspace:

- `docs/README.md`
- `docs/docker-compose.yml`
- `docs/setup.md`
- `docs/run-dev.md`

No `frontend/` or `backend/` source tree is synced. Every recommendation below is grounded in what the spec describes; file-pointers reference the **expected layout** the README implies (`backend/server.js`, `frontend/src/...`, etc.) so they map cleanly once source is added. Wherever an item depends on seeing actual code (e.g., naming conventions, render perf, dead code, dependency CVEs), it is flagged **"requires source."**

To unlock file-level review, drop the `frontend/` and `backend/` directories into `C:\Users\rooya\Documents\Claude\Projects\HomeApp\` (or sync the repo to the HomeApp project) and I can do a second pass.

---

## 1. Findings at a glance

### Code quality & architecture
1. **Naming is inconsistent.** README brands the app "Invoice Tracker"; the folder/project is "HomeApp"; the user calls it "HomeHub." Three names for one product is a long-term documentation tax.
2. **`docker-compose.yml` has no network, no env, no healthchecks, no build args.** Frontend and backend share `default` network only by accident, ports are hardcoded, and there is no `.env` plumbing.
3. **Port mismatch risk on the frontend.** Compose maps `3000:3000`, but Vite's dev server defaults to `5173`. Either Vite is being run on `3000` via flag (not shown), or the mapping is wrong. Currently undocumented.
4. **`setup.md` writes `package.json` files inline via `echo`.** Fragile, version-pinned in shell, drifts from real `package.json` once the project evolves. Should be committed files, not a generator.
5. **No CORS configuration documented.** Backend on `:5000`, frontend on `:3000`, no `cors` middleware config visible in spec — README lists `cors` as a dep but origins aren't pinned.
6. **No env / config layer.** Database path, upload path, port, max upload size, allowed mime types — all implicit. Should live in a `config` module fed by env vars.
7. **No tests.** No mention of Vitest/Jest/Playwright. Even a minimal smoke test for upload + list would catch regressions.
8. **No CI.** No GitHub Actions or equivalent.
9. **shadcn/ui claimed but not provisioned.** README lists shadcn/ui but `setup.md` `package.json` has no `class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react`, or any shadcn primitives. Either the README is aspirational or the setup script is stale.
10. **SQLite + Docker volumes + uploads on local FS** is fine for single-user, but the schema has no `user_id`, so the moment a second household member needs access this breaks. (Acknowledged in README as "auth can be added later" — flagging the data-model implication.)
11. **`invoices.due_date` and `paid_at` typed as `TEXT`.** SQLite has no date type, but the column should be ISO-8601 normalized at write time, not "whatever the client sends." A `CHECK` constraint or app-layer validator avoids garbage dates.
12. **No file-type or size enforcement documented.** `multer` is a dep but limits, mime allowlist, and storage location need to be explicit — security risk + UX risk (50 MB image uploads).
13. **No filename collision strategy.** README implies files go straight to `/uploads`; needs UUID-prefix or hashed filename + original-name stored in DB column.
14. **No filename sanitization.** `multer`'s default uses original filename as a base — path traversal risk if not sanitized.

### Feature gaps & UX
1. **No categories or tags.** Electricity, internet, rent, insurance — users want to filter and trend by category.
2. **No recurring invoices.** Most household bills repeat monthly; entering them manually each time is the #1 friction point for this kind of app.
3. **No reminders.** "Due in 3 days" notifications (email, push, or in-app) are the entire value of a bill tracker.
4. **No OCR / auto-extract.** User uploads a PDF and types in title, amount, due date manually — Tesseract or an LLM OCR pass could prefill these.
5. **No multi-user / household sharing.** Schema has no concept of a household — see arch finding #10.
6. **No edit / delete after upload.** API only exposes create, list, pay, file-fetch. Typos are permanent.
7. **No undo for "Mark Paid."** Single-tap mistakes can't be reversed without DB surgery.
8. **No payment method tracking.** Useful for tax/expensing — "paid by credit card X" or "auto-debit."
9. **No totals / monthly summary view.** "How much did we spend last month?" requires running totals — high-value, low-effort.
10. **No export.** CSV/Excel/PDF export for tax season.
11. **No search.** Archive grows fast without text search across titles.
12. **Overdue logic is implicit.** README says "overdue highlighted in red" — but where is `is_overdue` computed? Should be a derived field on the API, not duplicated in frontend.
13. **No empty / loading / error states described.** UX gap — needs explicit design in the React tree.
14. **No mobile-first behavior documented.** README says "responsive" — but invoice upload from a phone (camera capture, scan-to-PDF) is the natural mobile use case and isn't called out.
15. **No accessibility statement.** shadcn/ui gives you Radix primitives which are accessible by default — worth confirming once code lands.

---

## 2. Prioritized implementation plan

Items are ordered by **impact ÷ effort**. Each carries:
- **Files** — where the change lands (or _new_ if creating).
- **Change** — what to do.
- **Why** — the motivation.

### Phase 1 — Foundations (1–2 days)

#### 1.1 Resolve naming
- **Files:** `README.md`, `package.json` (both), `docker-compose.yml`, project folder.
- **Change:** Pick one name (recommend **HomeHub** since the user is already saying it). Rename containers (`invoice_backend` → `homehub_backend`), update README title, set both `package.json` `"name"` fields. Add a one-line note in README: "formerly Invoice Tracker."
- **Why:** Three names compound friction in support, search, repo discovery, and onboarding.

#### 1.2 Add a config layer
- **Files (new):** `backend/config.js`, `backend/.env.example`, `frontend/.env.example`.
- **Change:** Read `PORT`, `DB_PATH`, `UPLOAD_DIR`, `MAX_UPLOAD_MB`, `ALLOWED_MIME`, `CORS_ORIGIN` from env with sane defaults. Frontend reads `VITE_API_URL`.
- **Why:** Every other recommendation depends on having a single place for configuration.

#### 1.3 Fix docker-compose
- **Files:** `docker-compose.yml`.
- **Change:**
  - Add `env_file: ./.env` on both services.
  - Add a named `homehub` network and put both services on it.
  - Add `healthcheck` on backend (`GET /api/health`).
  - Make frontend `depends_on: backend: condition: service_healthy`.
  - Move the upload volume to a named volume (`uploads:/app/uploads`) instead of `./backend/uploads:/app/uploads` for portability.
  - Confirm the frontend port: either set Vite to `--port 3000 --host` in dev, or change the mapping to `5173:5173`.
- **Why:** Current compose is a happy-path skeleton; healthchecks + env files are the cheapest reliability win.

#### 1.4 Add `/api/health`
- **Files:** `backend/server.js` (or `backend/routes/health.js` _new_).
- **Change:** Return `{ status: "ok", db: <bool>, uploads: <bool> }`. Verify SQLite is reachable and upload dir is writable.
- **Why:** Required for compose healthcheck; cheap observability.

#### 1.5 Replace `setup.md` inline `package.json`
- **Files:** `frontend/package.json`, `backend/package.json` (both committed), delete the heredoc in `docs/setup.md`.
- **Change:** Commit real `package.json` files. Reduce `setup.md` to: "Run `npm install` in `/frontend` and `/backend`."
- **Why:** Eliminates spec drift; you'll regret the inline JSON the first time you upgrade a dep.

### Phase 2 — Data model & security (2–3 days)

#### 2.1 Harden the schema
- **Files:** `backend/db/migrations/0002_normalize_dates.sql` _new_, `backend/db/init.sql`.
- **Change:**
  - Add `CHECK (due_date GLOB '____-__-__')` and same for `paid_at`.
  - Add `category TEXT`, `recurring_id INTEGER NULL`, `notes TEXT`.
  - Add `original_filename TEXT NOT NULL` and rename `file_path` → `stored_filename` (UUID-prefixed, no path traversal).
  - Index `status`, `due_date`.
- **Why:** Cheap-to-add fields, expensive-to-add later. Indexes pay off as the archive grows.

#### 2.2 Upload validation
- **Files:** `backend/middleware/upload.js` _new_, used in `backend/routes/invoices.js`.
- **Change:** Configure `multer` with:
  - `limits: { fileSize: MAX_UPLOAD_MB * 1024 * 1024 }`
  - `fileFilter` allowlisting `application/pdf`, `image/jpeg`, `image/png`, `image/webp`.
  - `storage: diskStorage` with `filename: () => uuid() + ext`.
  - Sanitize original filename before storing as `original_filename`.
- **Why:** Closes the path-traversal and DoS-by-upload surface; multer defaults are unsafe for this app's threat model.

#### 2.3 Centralized error handler + request validation
- **Files:** `backend/middleware/error.js` _new_, `backend/middleware/validate.js` _new_.
- **Change:** Use `zod` (or `joi`) for request body validation; one error handler at the end of the middleware stack that maps known errors to status codes and returns `{ error: { code, message } }`.
- **Why:** Removes ad-hoc try/catch noise from routes; consistent error shape for the frontend.

#### 2.4 CORS pinning
- **Files:** `backend/server.js`.
- **Change:** `cors({ origin: process.env.CORS_ORIGIN, credentials: true })`. No wildcard.
- **Why:** Once auth lands, an open CORS policy is a vulnerability.

### Phase 3 — High-value features (3–5 days)

#### 3.1 Categories
- **Files:** schema (Phase 2.1), `backend/routes/invoices.js`, `frontend/src/components/UploadForm.tsx`, `frontend/src/components/InvoiceList.tsx`, `frontend/src/components/CategoryFilter.tsx` _new_.
- **Change:** Add a category dropdown on upload (Utilities, Rent, Internet, Insurance, Other), filter chip row on list views.
- **Why:** Single most-requested feature in this category of app; data-cheap (one column).

#### 3.2 Monthly summary view
- **Files:** `backend/routes/summary.js` _new_ (`GET /api/summary?month=YYYY-MM`), `frontend/src/pages/Summary.tsx` _new_.
- **Change:** Aggregate totals by category and by status. Render with a simple bar chart (recharts).
- **Why:** Visible high-value feature; minimal backend (one SQL group-by).

#### 3.3 Edit / delete invoice
- **Files:** `backend/routes/invoices.js` (add `PATCH /api/invoices/:id`, `DELETE /api/invoices/:id`), `frontend/src/components/InvoiceCard.tsx`.
- **Change:** Edit modal reusing the upload form; soft-delete column `deleted_at`, exclude from default queries.
- **Why:** Without edit, every typo means a re-upload. Soft delete lets you ship undo.

#### 3.4 Undo "Mark Paid"
- **Files:** `backend/routes/invoices.js` (add `PATCH /api/invoices/:id/unpay`), `frontend/src/components/InvoiceCard.tsx`, `frontend/src/components/Toast.tsx` _new_.
- **Change:** After marking paid, show a 5s toast with Undo; calling unpay clears `paid_at` and resets status.
- **Why:** Two-line backend change, big UX improvement.

#### 3.5 Search
- **Files:** `backend/routes/invoices.js` (add `?q=` param), `frontend/src/components/SearchBar.tsx` _new_.
- **Change:** SQLite `LIKE %q%` over `title`, `notes`, `category` is enough for an archive of household-bill scale. Upgrade to FTS5 if list grows past ~10k rows.
- **Why:** Archive becomes unusable without search around invoice 50.

### Phase 4 — Differentiators (1–2 weeks)

#### 4.1 Recurring invoices
- **Files (new):** `backend/db/migrations/0003_recurring.sql`, `backend/services/recurring.js`, `backend/jobs/generate_recurring.js`.
- **Change:**
  - Table `recurring_invoices(id, title, amount, category, day_of_month, active)`.
  - A daily job (node-cron) generates the month's instances on day 1, linked via `invoices.recurring_id`.
  - Frontend: "Make this recurring" toggle in upload form; settings page to manage templates.
- **Why:** Eliminates the manual data-entry tax that kills retention in bill-tracker apps.

#### 4.2 Reminders
- **Files (new):** `backend/services/reminders.js`, `backend/jobs/send_reminders.js`.
- **Change:** Daily cron that finds invoices due in N days and sends email (nodemailer) or in-app notification. Add `reminder_days INTEGER DEFAULT 3` to user preferences (Phase 5).
- **Why:** Reminders are why people install bill-tracker apps in the first place.

#### 4.3 OCR / auto-extract on upload
- **Files (new):** `backend/services/ocr.js`, `backend/routes/invoices.js` (extend POST).
- **Change:** On upload, run Tesseract.js (free) or call a hosted vision model to extract `title`, `amount`, `due_date`. Return as suggested values the user confirms before save — never auto-save extracted data.
- **Why:** Removes the "fill out the form" friction that's the highest-cost step in the user journey.

#### 4.4 CSV export
- **Files:** `backend/routes/export.js` _new_.
- **Change:** `GET /api/export?format=csv&from=YYYY-MM&to=YYYY-MM` returns a download.
- **Why:** Tax season; takes an afternoon.

### Phase 5 — Multi-user / households (longer arc)

#### 5.1 Auth + households
- **Files (new):** `backend/auth/`, `backend/db/migrations/0004_users_households.sql`, `frontend/src/pages/Login.tsx`, frontend auth context.
- **Change:**
  - Tables: `users`, `households`, `household_members`. Add `household_id` to `invoices`, `recurring_invoices`.
  - JWT or session cookies; password hashing via `argon2`.
  - Invite-by-email flow for adding a partner/roommate.
- **Why:** Schema rework is much cheaper now than after the app is in real use. The README itself flags this as "later" — Phase 5 is when "later" arrives.

### Phase 6 — Quality & ops (parallel track)

- **Tests** _new_: Vitest for backend routes (`backend/tests/`), React Testing Library for the upload + pay flows, one Playwright happy-path that uploads a fixture PDF and marks it paid. Target a small but real fixture set in `backend/tests/fixtures/`.
- **CI** _new_: `.github/workflows/ci.yml` — install, lint, test, build, Docker build. Block PRs on red.
- **Lint / format** _new_: ESLint + Prettier configs at root; `husky` + `lint-staged` for pre-commit.
- **Observability** _new_: Replace `console.log` with `pino` (backend) + a one-line frontend error boundary that POSTs errors to `/api/log`. Cheap, makes debugging real users tractable.
- **Backups** _new_: Add a backup volume + nightly `sqlite3 .backup` cron in compose. Without this, a corrupted DB is total data loss.

---

## 3. Items that require source code

These can't be done from spec alone — drop in `frontend/` and `backend/` and I'll pass over them:

- Dead code & unused exports sweep.
- React component complexity audit (component split candidates, prop drilling, missing memoization).
- Bundle size analysis & code splitting opportunities.
- Dependency CVE scan (`npm audit`).
- SQL N+1 patterns and missing prepared statements.
- Naming-convention consistency (PascalCase vs kebab-case files, hook naming).
- Accessibility audit on the actual rendered UI.

---

## 4. Suggested next step

Either drop the `frontend/` and `backend/` directories into the HomeApp folder for a code-level pass, or pick a phase above and I'll expand it into concrete diffs.
