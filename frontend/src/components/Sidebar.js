export default function Sidebar({ activeTool, setActiveTool, tools, showToast }) {
  return (
    <aside className="sidebar">
      <div>
        <div style={{
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          width: 48, height: 48, borderRadius: 16, background: "#f8fafc",
          color: "#16a34a", fontSize: 20, marginBottom: 18,
          boxShadow: "0 6px 20px rgba(15,23,42,0.06)",
        }}>🏡</div>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: "#111827" }}>Home Hub</h1>
      </div>

      <nav style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {tools.map(tool => {
          const isActive = activeTool === tool.id;
          return (
            <button
              key={tool.id}
              onClick={() => tool.active ? setActiveTool(tool.id) : showToast(`${tool.name} is coming soon.`)}
              style={{
                display: "flex", alignItems: "center", gap: 14, width: "100%",
                textAlign: "left", borderRadius: 18, border: "none", cursor: "pointer",
                background: isActive ? "rgba(16,185,129,0.12)" : "transparent",
                padding: "16px 18px",
                boxShadow: isActive ? "inset 4px 0 0 0 #10b981" : "none",
                transition: "background 0.2s ease",
              }}
            >
              <span style={{ fontSize: 20, width: 28, textAlign: "center" }}>{tool.icon}</span>
              <span style={{ fontWeight: 700, fontSize: 15, color: isActive ? "#0f766e" : "#111827" }}>
                {tool.name}
              </span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
