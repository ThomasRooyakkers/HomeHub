export default function Sidebar({ activeTool, setActiveTool, tools, showToast, currentUser, onLogout }) {
  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div style={{
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          width: 48, height: 48, borderRadius: 16, background: "#f8fafc",
          color: "#16a34a", fontSize: 20, marginBottom: 18,
          boxShadow: "0 6px 20px rgba(15,23,42,0.06)",
        }}>🏡</div>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: "#111827" }}>Home Hub</h1>
      </div>

      <nav className="sidebar-nav">
        {tools.map(tool => {
          const isActive = activeTool === tool.id;
          return (
            <button
              key={tool.id}
              onClick={() => tool.active ? setActiveTool(tool.id) : showToast(`${tool.name} is coming soon.`)}
              className={`nav-btn${isActive ? ' nav-btn--active' : ''}`}
            >
              <span className="nav-btn__icon">{tool.icon}</span>
              <span className="nav-btn__label">{tool.shortName || tool.name}</span>
            </button>
          );
        })}
      </nav>

      {currentUser && (
        <div style={{ marginTop: "auto", borderTop: "1px solid #e5e7eb", paddingTop: 16 }}>
          <p style={{ margin: "0 0 10px", fontSize: 13, color: "#6b7280" }}>
            Signed in as <strong style={{ color: "#111827" }}>{currentUser.username}</strong>
          </p>
          <button
            onClick={onLogout}
            style={{
              width: "100%",
              padding: "8px 12px",
              background: "transparent",
              border: "1px solid #e5e7eb",
              borderRadius: 10,
              fontSize: 13,
              fontWeight: 600,
              color: "#6b7280",
              cursor: "pointer",
              fontFamily: "inherit",
              textAlign: "left",
            }}
          >
            Sign out
          </button>
        </div>
      )}
    </aside>
  );
}
