import { fmt, fmtDate, displayStatus, useTodayKey } from "../lib/utils";

// ─── Sub-components ────────────────────────────────────────────────────────────

function Section({ title, count, variant, onViewAll, children }) {
  const v = variant === "red"
    ? { bg: "rgba(254,242,242,0.7)", border: "rgba(220,38,38,0.14)", title: "#991b1b", badge: { bg: "#fee2e2", color: "#991b1b" } }
    : { bg: "rgba(255,251,235,0.7)", border: "rgba(245,158,11,0.18)", title: "#92400e", badge: { bg: "#fef3c7", color: "#92400e" } };
  return (
    <div style={{ background: v.bg, border: `1px solid ${v.border}`, borderRadius: 20, padding: "20px 20px 16px", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: v.title }}>{title}</h3>
          <span style={{ background: v.badge.bg, color: v.badge.color, fontSize: 12, fontWeight: 700, padding: "3px 9px", borderRadius: 20 }}>{count}</span>
        </div>
        <button onClick={onViewAll} style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
          View all →
        </button>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>{children}</div>
    </div>
  );
}

function InvoiceRow({ inv, onToggle, urgent }) {
  const daysLeft = inv.dueDate
    ? Math.ceil((new Date(inv.dueDate) - new Date()) / 86400000)
    : null;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", background: "#fff", borderRadius: 14, border: `1px solid ${urgent ? "rgba(220,38,38,0.1)" : "rgba(245,158,11,0.12)"}` }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontWeight: 700, fontSize: 14, color: "#1e293b" }}>{inv.vendor}</span>
          {inv.invoiceNo && <span style={{ fontSize: 12, color: "#94a3b8" }}>#{inv.invoiceNo}</span>}
          {inv.file && <span style={{ fontSize: 11 }}>📎</span>}
        </div>
        <p style={{ margin: "3px 0 0", fontSize: 12, color: urgent ? "#b91c1c" : "#92400e" }}>
          {urgent
            ? `Overdue since ${fmtDate(inv.dueDate)}`
            : `Due ${fmtDate(inv.dueDate)}${daysLeft !== null ? ` · ${daysLeft}d left` : ""}`}
        </p>
      </div>
      <span style={{ fontWeight: 800, fontSize: 15, color: "#1e293b", flexShrink: 0 }}>{fmt(inv.amount)}</span>
      <button
        onClick={onToggle}
        style={{ background: "linear-gradient(135deg,#16a34a,#22c55e)", border: "none", color: "#fff", padding: "7px 13px", borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: "pointer", flexShrink: 0, boxShadow: "0 2px 8px rgba(22,163,74,0.25)" }}
      >
        Mark paid
      </button>
    </div>
  );
}

function MaintenanceRow({ task, onToggle }) {
  const isOverdue = task.nextDue && new Date(task.nextDue) < new Date();
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", background: "#fff", borderRadius: 14, border: `1px solid ${isOverdue ? "rgba(220,38,38,0.1)" : "rgba(245,158,11,0.12)"}` }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <span style={{ fontWeight: 700, fontSize: 14, color: "#1e293b" }}>{task.title}</span>
        <p style={{ margin: "3px 0 0", fontSize: 12, color: isOverdue ? "#b91c1c" : "#92400e" }}>
          {task.frequency}
          {task.nextDue ? ` · ${isOverdue ? "Overdue since" : "Due"} ${fmtDate(task.nextDue)}` : ""}
        </p>
      </div>
      <button
        onClick={onToggle}
        style={{ background: "rgba(22,163,74,0.1)", border: "1px solid rgba(22,163,74,0.3)", color: "#16a34a", padding: "7px 13px", borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}
      >
        Mark done
      </button>
    </div>
  );
}

// ─── Dashboard ─────────────────────────────────────────────────────────────────

export default function Dashboard({
  invoices, mealPlan, recipes, maintenanceTasks,
  calendarEvents, onNavigate,
  onToggleInvoicePaid, onToggleMaintenanceDone,
}) {
  const todayKey = useTodayKey();
  const now = new Date();
  const sevenDaysOut = new Date(now);
  sevenDaysOut.setDate(now.getDate() + 7);
  const todayMeal = mealPlan[todayKey];
  const getRecipeById = (id) => recipes.find(r => String(r.id) === String(id)) || null;

  // Invoice buckets
  const overdueInvoices = invoices.filter(i => displayStatus(i) === "overdue");
  const dueSoonInvoices = invoices.filter(i => {
    if (displayStatus(i) !== "unpaid" || !i.dueDate) return false;
    const d = new Date(i.dueDate);
    return d >= now && d <= sevenDaysOut;
  });

  // Maintenance bucket — overdue or due within 7 days
  const maintenanceDue = maintenanceTasks.filter(t => {
    if (t.completed) return false;
    return !t.nextDue || new Date(t.nextDue) <= sevenDaysOut;
  });

  const upcomingEvents = calendarEvents
    .map(e => ({ ...e, startDate: new Date(e.start) }))
    .filter(e => e.startDate >= now)
    .sort((a, b) => a.startDate - b.startDate)
    .slice(0, 4);

  const totalUnpaid = invoices
    .filter(i => displayStatus(i) !== "paid")
    .reduce((a, i) => a + parseFloat(i.amount || 0), 0);

  const allClear = overdueInvoices.length === 0 && dueSoonInvoices.length === 0 && maintenanceDue.length === 0;

  return (
    <div style={{ display: "grid", gap: 24 }}>

      {/* ── Stats row ─────────────────────────────────────────────────────────── */}
      <div className="stats-grid">
        {[
          {
            label: "Unpaid balance",
            value: fmt(totalUnpaid),
            color: "#16a34a",
            alert: false,
            to: "invoices",
          },
          {
            label: "Overdue",
            value: overdueInvoices.length,
            color: overdueInvoices.length > 0 ? "#dc2626" : "#22c55e",
            alert: overdueInvoices.length > 0,
            to: "invoices",
          },
          {
            label: "Due this week",
            value: dueSoonInvoices.length,
            color: dueSoonInvoices.length > 0 ? "#d97706" : "#22c55e",
            alert: false,
            to: "invoices",
          },
          {
            label: "Maintenance due",
            value: maintenanceDue.length,
            color: maintenanceDue.length > 0 ? "#d97706" : "#22c55e",
            alert: false,
            to: "maintenance",
          },
        ].map(card => (
          <button
            key={card.label}
            onClick={() => onNavigate(card.to)}
            style={{
              background: card.alert
                ? "linear-gradient(135deg, #fef2f2, #fee2e2)"
                : "linear-gradient(135deg, #f0fdf4, #dcfce7)",
              border: card.alert
                ? "1px solid rgba(220,38,38,0.2)"
                : "1px solid rgba(34,197,94,0.2)",
              borderRadius: 20, padding: "22px 24px",
              boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
              textAlign: "left", cursor: "pointer", transition: "transform 0.15s ease",
            }}
            onMouseEnter={e => e.currentTarget.style.transform = "translateY(-2px)"}
            onMouseLeave={e => e.currentTarget.style.transform = "translateY(0)"}
          >
            <p style={{ margin: 0, fontSize: 12, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 600 }}>{card.label}</p>
            <p style={{ margin: "10px 0 0", fontSize: 30, fontWeight: 800, color: card.color }}>{card.value}</p>
          </button>
        ))}
      </div>

      {/* ── Main body ─────────────────────────────────────────────────────────── */}
      <div className="dashboard-main">

        {/* Left — action panel */}
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {allClear ? (
            <div style={{ background: "linear-gradient(135deg, #f0fdf4, #dcfce7)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: 20, padding: "32px 28px", textAlign: "center" }}>
              <p style={{ margin: 0, fontSize: 32 }}>✅</p>
              <p style={{ margin: "14px 0 6px", fontSize: 18, fontWeight: 800, color: "#166534" }}>All caught up!</p>
              <p style={{ margin: 0, color: "#64748b", fontSize: 14, lineHeight: 1.7 }}>No overdue bills, nothing due this week, and no maintenance outstanding.</p>
            </div>
          ) : (
            <>
              {overdueInvoices.length > 0 && (
                <Section title="Overdue bills" count={overdueInvoices.length} variant="red" onViewAll={() => onNavigate("invoices")}>
                  {overdueInvoices.map(inv => (
                    <InvoiceRow key={inv.id} inv={inv} onToggle={() => onToggleInvoicePaid(inv.id)} urgent />
                  ))}
                </Section>
              )}

              {dueSoonInvoices.length > 0 && (
                <Section title="Due this week" count={dueSoonInvoices.length} variant="amber" onViewAll={() => onNavigate("invoices")}>
                  {dueSoonInvoices.map(inv => (
                    <InvoiceRow key={inv.id} inv={inv} onToggle={() => onToggleInvoicePaid(inv.id)} />
                  ))}
                </Section>
              )}

              {maintenanceDue.length > 0 && (
                <Section title="Maintenance due" count={maintenanceDue.length} variant="amber" onViewAll={() => onNavigate("maintenance")}>
                  {maintenanceDue.map(task => (
                    <MaintenanceRow key={task.id} task={task} onToggle={() => onToggleMaintenanceDone(task.id)} />
                  ))}
                </Section>
              )}
            </>
          )}
        </div>

        {/* Right — meal + events */}
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>

          {/* Tonight's dinner */}
          <div style={{ background: "rgba(255,255,255,0.95)", border: "1px solid rgba(34,197,94,0.1)", borderRadius: 20, padding: 22, boxShadow: "0 4px 16px rgba(22,163,74,0.06)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "#166534" }}>🍽️ Tonight's dinner</h3>
              <button onClick={() => onNavigate("meal")} style={{ background: "none", border: "none", color: "#16a34a", fontWeight: 700, cursor: "pointer", fontSize: 13 }}>Planner →</button>
            </div>
            {todayMeal ? (
              <div>
                <p style={{ margin: 0, fontSize: 17, fontWeight: 800, color: "#166534" }}>{todayMeal.title}</p>
                {todayMeal.recipeId && getRecipeById(todayMeal.recipeId) && (
                  <p style={{ margin: "6px 0 0", color: "#64748b", fontSize: 13 }}>From: {getRecipeById(todayMeal.recipeId).name}</p>
                )}
                {todayMeal.notes && <p style={{ margin: "8px 0 0", color: "#64748b", fontSize: 13, lineHeight: 1.6 }}>{todayMeal.notes}</p>}
              </div>
            ) : (
              <div>
                <p style={{ margin: 0, color: "#94a3b8", fontSize: 14 }}>Nothing planned yet.</p>
                <button onClick={() => onNavigate("meal")} style={{ marginTop: 12, background: "linear-gradient(135deg, #16a34a, #22c55e)", border: "none", color: "#fff", padding: "9px 16px", borderRadius: 12, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                  Plan dinner
                </button>
              </div>
            )}
          </div>

          {/* Upcoming calendar events */}
          <div style={{ background: "rgba(255,255,255,0.95)", border: "1px solid rgba(34,197,94,0.1)", borderRadius: 20, padding: 22, boxShadow: "0 4px 16px rgba(22,163,74,0.06)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "#166534" }}>📅 Upcoming</h3>
              {upcomingEvents.length > 0 && (
                <button onClick={() => onNavigate("calendar")} style={{ background: "none", border: "none", color: "#16a34a", fontWeight: 700, cursor: "pointer", fontSize: 13 }}>View all →</button>
              )}
            </div>
            {upcomingEvents.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {upcomingEvents.map(event => (
                  <div key={event.uid} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                    <div style={{ minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#166534", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{event.title}</p>
                      {event.location && <p style={{ margin: "2px 0 0", fontSize: 12, color: "#94a3b8" }}>📍 {event.location}</p>}
                    </div>
                    <span style={{ fontSize: 12, color: "#64748b", whiteSpace: "nowrap", flexShrink: 0 }}>{fmtDate(event.start)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ margin: 0, color: "#94a3b8", fontSize: 14 }}>No upcoming events. Import a calendar to see your schedule.</p>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
