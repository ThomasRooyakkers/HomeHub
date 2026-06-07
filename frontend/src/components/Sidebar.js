const NAV_ICONS = {
  dashboard: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>
    </svg>
  ),
  invoices: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 3h7l4 4v14H7z"/><path d="M14 3v4h4"/><path d="M10 12h6M10 16h4"/>
    </svg>
  ),
  shopping: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="20" r="1.4"/><circle cx="18" cy="20" r="1.4"/><path d="M3 4h2l2.5 12h12L22 8H6"/>
    </svg>
  ),
  meal: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 3v8a2 2 0 002 2v8"/><path d="M11 3v6"/><path d="M7 3v6"/><path d="M17 3c-2 0-3 2-3 5s1 5 3 5v8"/>
    </svg>
  ),
  tasks: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 6h11"/><path d="M9 12h11"/><path d="M9 18h11"/><path d="M4 6l1 1 2-2"/><path d="M4 12l1 1 2-2"/><path d="M4 18l1 1 2-2"/>
    </svg>
  ),
  maintenance: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.7 6.3a4 4 0 105.6 5.6L21 11l-3-3-1 1-2-2 1-1z"/><path d="M14.7 6.3L4 17a2.4 2.4 0 003.4 3.4l10.7-10.7"/>
    </svg>
  ),
  calendar: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 9h18M8 3v4M16 3v4"/>
    </svg>
  ),
  plants: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 19c0-8 6-14 14-14 0 8-6 14-14 14z"/><path d="M5 19c4-4 8-7 12-9"/>
    </svg>
  ),
  documents: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6a2 2 0 012-2h4l2 2h8a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
    </svg>
  ),
  contacts: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 4h3l2 5-2 1a11 11 0 006 6l1-2 5 2v3a2 2 0 01-2 2A15 15 0 013 6a2 2 0 012-2z"/>
    </svg>
  ),
  inventory: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12V4h8l10 10-8 8z"/><circle cx="8" cy="8" r="1.5"/>
    </svg>
  ),
  admin: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>
    </svg>
  ),
};

const HomeIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>
  </svg>
);

const PlusIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 5v14M5 12h14"/>
  </svg>
);

const SearchIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>
  </svg>
);

export default function Sidebar({ activeTool, setActiveTool, tools, showToast, currentUser, onLogout, settings, syncStatus = "online", syncQueueCount = 0, onOpenQuickAdd, onOpenSearch }) {
  const visibleTools = tools.filter(t => t.id !== "admin");
  const isAdmin = currentUser?.role === "admin";
  const appName   = settings?.appName       || "HomeHub";
  const household = settings?.householdName || "My Household";

  return (
    <aside className="sidebar">
      {/* Brand */}
      <div className="sidebar-header">
        <div className="sidebar-brand-icon">
          <HomeIcon />
        </div>
        <div>
          <div className="sidebar-brand-name">{appName}</div>
          {household && <div className="sidebar-brand-sub">{household}</div>}
        </div>
      </div>

      <button className="sidebar-search" onClick={onOpenSearch}>
        <SearchIcon />
        <span>Search</span>
        <kbd>Ctrl K</kbd>
      </button>

      {/* Navigation */}
      <nav className="sidebar-nav">
        {visibleTools.map(tool => {
          const active = activeTool === tool.id;
          return (
            <button
              key={tool.id}
              onClick={() => tool.active ? setActiveTool(tool.id) : showToast(`${tool.name} is coming soon.`)}
              className={`nav-btn${active ? " nav-btn--active" : ""}${tool.mobileVisible === false ? " nav-btn--mobile-hidden" : ""}`}
            >
              <span
                className="nav-btn__icon-wrap"
                style={{ color: active ? "var(--g-sage-dark)" : "var(--g-muted)" }}
              >
                {NAV_ICONS[tool.id] || NAV_ICONS.admin}
              </span>
              <span className="nav-btn__label">{tool.shortName || tool.name}</span>
            </button>
          );
        })}

        {isAdmin && (
          <button
            onClick={() => setActiveTool("admin")}
            className={`nav-btn${activeTool === "admin" ? " nav-btn--active" : ""}`}
          >
            <span
              className="nav-btn__icon-wrap"
              style={{ color: activeTool === "admin" ? "var(--g-sage-dark)" : "var(--g-muted)" }}
            >
              {NAV_ICONS.admin}
            </span>
            <span className="nav-btn__label">Admin</span>
          </button>
        )}
      </nav>

      {/* Quick add */}
      <button className="sidebar-quickadd" onClick={onOpenQuickAdd}>
        <PlusIcon />
        Quick add
      </button>

      {/* User */}
      {currentUser && (
        <div className="sidebar-user">
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
            padding: "7px 9px", borderRadius: 10,
            background: syncStatus === "online" ? "var(--g-sage-bg)" : syncStatus === "syncing" ? "var(--g-honey-bg)" : "var(--g-brick-bg)",
            color: syncStatus === "online" ? "var(--g-sage-dark)" : syncStatus === "syncing" ? "var(--g-honey)" : "var(--g-brick)",
            fontFamily: "var(--g-sans)", fontSize: 12, fontWeight: 700,
          }}>
            <span>{syncStatus === "syncing" ? "Syncing" : syncStatus === "online" ? "Online" : "Offline"}</span>
            {syncQueueCount > 0 && <span>{syncQueueCount} queued</span>}
          </div>
          <p style={{ margin: 0, fontFamily: "var(--g-sans)", fontSize: 12, color: "var(--g-muted)" }}>
            Signed in as{" "}
            <strong style={{ color: "var(--g-ink2)", fontWeight: 600 }}>{currentUser.username}</strong>
          </p>
          <button
            onClick={onLogout}
            style={{
              all: "unset", cursor: "pointer",
              fontFamily: "var(--g-sans)", fontSize: 12, fontWeight: 600,
              color: "var(--g-muted)", padding: "7px 10px",
              borderRadius: 10, border: "1px solid var(--g-hair)",
              textAlign: "center", width: "100%", boxSizing: "border-box",
            }}
          >
            Sign out
          </button>
        </div>
      )}
    </aside>
  );
}
