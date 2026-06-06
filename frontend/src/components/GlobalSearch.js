import { useEffect, useMemo, useRef, useState } from "react";

const MODULE_LABELS = {
  invoices: "Invoices",
  documents: "Documents",
  contacts: "Contacts",
  inventory: "Inventory",
  meal: "Recipes",
  tasks: "Tasks",
  maintenance: "Maintenance",
  calendar: "Calendar",
};

const normalize = (value) => String(value || "").toLowerCase();

const compact = (values) => values.filter(Boolean).map(String);

const makeResult = (module, item, title, subtitle, fields) => ({
  id: `${module}-${item?.id || title}`,
  module,
  label: MODULE_LABELS[module],
  title: title || "Untitled",
  subtitle: compact(subtitle).join(" - "),
  haystack: normalize(compact(fields).join(" ")),
});

const formatDate = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "numeric" });
};

function buildSearchIndex(data) {
  const tasks = Array.isArray(data.tasks?.items) ? data.tasks.items : [];

  return [
    ...(data.invoices || []).map((invoice) => makeResult(
      "invoices",
      invoice,
      invoice.vendor,
      [invoice.invoiceNo && `#${invoice.invoiceNo}`, invoice.category, invoice.status],
      [invoice.vendor, invoice.invoiceNo, invoice.notes, invoice.category]
    )),
    ...(data.documents || []).map((document) => makeResult(
      "documents",
      document,
      document.title,
      [document.category, document.originalName],
      [document.title, document.category, document.notes, document.originalName]
    )),
    ...(data.contacts || []).map((contact) => makeResult(
      "contacts",
      contact,
      contact.name,
      [contact.company || contact.category, contact.role, contact.phone, contact.email],
      [contact.name, contact.company, contact.role, contact.category, contact.phone, contact.email, contact.notes]
    )),
    ...(data.inventory || []).map((item) => makeResult(
      "inventory",
      item,
      item.name,
      [item.brand, item.model, item.location || item.room],
      [item.name, item.brand, item.model, item.serialNo || item.serial, item.location, item.room, item.notes]
    )),
    ...(data.recipes || []).map((recipe) => makeResult(
      "meal",
      recipe,
      recipe.name,
      [recipe.category, recipe.description],
      [recipe.name, recipe.category, recipe.description, recipe.ingredients, recipe.instructions]
    )),
    ...tasks.map((task) => makeResult(
      "tasks",
      task,
      task.title,
      [task.type === "weekday" ? "Recurring" : "One time", task.date],
      [task.title, task.notes, task.type, task.date]
    )),
    ...(data.maintenanceTasks || []).map((task) => makeResult(
      "maintenance",
      task,
      task.title,
      [task.frequency, task.completed ? "Completed" : "Pending", formatDate(task.nextDue)],
      [task.title, task.frequency, task.instructions, task.nextDue]
    )),
    ...(data.calendarEvents || []).map((event) => makeResult(
      "calendar",
      event,
      event.title,
      [formatDate(event.start), event.location],
      [event.title, event.location, event.description, event.start, event.end]
    )),
  ].filter((result) => result.title && result.haystack);
}

export default function GlobalSearch({ open, onClose, onNavigate, searchData }) {
  const [query, setQuery] = useState("");
  const inputRef = useRef(null);

  const index = useMemo(() => buildSearchIndex(searchData), [searchData]);
  const groupedResults = useMemo(() => {
    const q = normalize(query.trim());
    if (!q) return [];

    const matches = index
      .filter((result) => result.haystack.includes(q))
      .slice(0, 40);

    return Object.entries(
      matches.reduce((groups, result) => {
        if (!groups[result.module]) groups[result.module] = [];
        groups[result.module].push(result);
        return groups;
      }, {})
    ).map(([module, results]) => ({ module, label: MODULE_LABELS[module] || module, results }));
  }, [index, query]);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    const id = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, open]);

  if (!open) return null;

  const hasQuery = query.trim().length > 0;
  const resultCount = groupedResults.reduce((total, group) => total + group.results.length, 0);

  const openResult = (result) => {
    onNavigate(result.module);
    onClose();
  };

  return (
    <div className="global-search-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="global-search-panel" role="dialog" aria-modal="true" aria-label="Global search">
        <div className="global-search-input-row">
          <SearchIcon />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search HomeHub"
            aria-label="Search HomeHub"
          />
          <button type="button" onClick={onClose} aria-label="Close search">Esc</button>
        </div>

        <div className="global-search-results">
          {!hasQuery && (
            <div className="global-search-empty">
              Search invoices, documents, contacts, inventory, recipes, tasks, maintenance, and calendar events.
            </div>
          )}

          {hasQuery && resultCount === 0 && (
            <div className="global-search-empty">No results found.</div>
          )}

          {groupedResults.map((group) => (
            <div className="global-search-group" key={group.module}>
              <div className="global-search-group-title">
                <span>{group.label}</span>
                <span>{group.results.length}</span>
              </div>
              {group.results.map((result) => (
                <button
                  key={result.id}
                  type="button"
                  className="global-search-result"
                  onClick={() => openResult(result)}
                >
                  <span>
                    <strong>{result.title}</strong>
                    {result.subtitle && <small>{result.subtitle}</small>}
                  </span>
                  <span className="global-search-result-module">{result.label}</span>
                </button>
              ))}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function SearchIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-4-4" />
    </svg>
  );
}
