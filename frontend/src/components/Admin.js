import { useState, useEffect } from "react";
import { apiFetch } from "../lib/api";

const CURRENCIES = ["EUR", "USD", "GBP", "CHF", "SEK", "NOK", "DKK"];

const labelStyle = { fontSize: 14, color: "#4b5563", display: "block", marginBottom: 6, fontWeight: 600 };
const inputStyle = {
  width: "100%", background: "rgba(255,255,255,0.95)", border: "1px solid rgba(0,0,0,0.12)",
  borderRadius: 12, padding: "11px 14px", fontSize: 15, fontFamily: "inherit", color: "#111827",
};
const btnPrimary = {
  padding: "10px 20px", background: "linear-gradient(135deg, var(--accent, #16a34a), #22c55e)",
  color: "#fff", border: "none", borderRadius: 12, fontWeight: 700, fontSize: 14,
  cursor: "pointer", fontFamily: "inherit",
};
const btnDanger = {
  padding: "6px 12px", background: "rgba(252,165,165,0.12)", color: "#dc2626",
  border: "1px solid rgba(220,38,38,0.2)", borderRadius: 10, fontWeight: 600, fontSize: 13,
  cursor: "pointer", fontFamily: "inherit",
};
const btnSecondary = {
  padding: "10px 20px", background: "#f1f5f9", color: "#374151",
  border: "1px solid #e5e7eb", borderRadius: 12, fontWeight: 600, fontSize: 14,
  cursor: "pointer", fontFamily: "inherit",
};

const cardStyle = {
  background: "rgba(255,255,255,0.85)", borderRadius: 16,
  padding: "20px 24px", border: "1px solid rgba(0,0,0,0.06)",
  boxShadow: "0 2px 12px rgba(15,23,42,0.04)",
};

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function Admin({ currentUser, settings, applySettings, apiEnabled, showToast }) {
  const [tab, setTab] = useState("users");
  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState(null);
  const [settingsForm, setSettingsForm] = useState(settings);
  const [addForm, setAddForm] = useState(null);
  const [pwdForm, setPwdForm] = useState(null);
  const [deleteId, setDeleteId] = useState(null);

  useEffect(() => { setSettingsForm(settings); }, [settings]);

  useEffect(() => {
    if (!apiEnabled) return;
    if (tab === "users") loadUsers();
    if (tab === "stats") loadStats();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, apiEnabled]);

  const loadUsers = async () => {
    try { const d = await apiFetch("/api/admin/users"); if (d) setUsers(d); } catch {}
  };
  const loadStats = async () => {
    try { const d = await apiFetch("/api/admin/stats"); if (d) setStats(d); } catch {}
  };

  const saveSettings = async () => {
    try {
      const d = await apiFetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settingsForm),
      });
      if (d) { applySettings(d); showToast("Settings saved"); }
    } catch { showToast("Failed to save settings", "danger"); }
  };

  const addUser = async () => {
    if (!addForm?.username || !addForm?.password) return showToast("Username and password required", "danger");
    try {
      const d = await apiFetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(addForm),
      });
      if (d) { setUsers(u => [...u, d]); setAddForm(null); showToast(`User "${d.username}" created`); }
    } catch (err) { showToast(err.message || "Failed to add user", "danger"); }
  };

  const changePassword = async () => {
    if (!pwdForm?.password) return showToast("Password required", "danger");
    try {
      await apiFetch(`/api/admin/users/${pwdForm.id}/password`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: pwdForm.password }),
      });
      setPwdForm(null);
      showToast("Password updated");
    } catch { showToast("Failed to update password", "danger"); }
  };

  const deleteUser = async (id) => {
    try {
      await apiFetch(`/api/admin/users/${id}`, { method: "DELETE" });
      setUsers(u => u.filter(x => x.id !== id));
      setDeleteId(null);
      showToast("User deleted");
    } catch (err) { showToast(err.message || "Failed to delete user", "danger"); }
  };

  const tabs = [
    { id: "users", label: "Users" },
    { id: "stats", label: "System Stats" },
    { id: "settings", label: "App Settings" },
  ];

  return (
    <div style={{ maxWidth: 820, margin: "0 auto", padding: "28px 20px" }}>
      <h2 style={{ margin: "0 0 24px", fontSize: 26, fontWeight: 800, color: "#111827" }}>⚙️ Admin</h2>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 28 }}>
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              padding: "9px 20px", borderRadius: 12, fontFamily: "inherit",
              fontWeight: 600, fontSize: 14, cursor: "pointer",
              background: tab === t.id ? "linear-gradient(135deg, var(--accent, #16a34a), #22c55e)" : "#f1f5f9",
              color: tab === t.id ? "#fff" : "#374151",
              border: tab === t.id ? "none" : "1px solid #e5e7eb",
            }}
          >{t.label}</button>
        ))}
      </div>

      {/* Users tab */}
      {tab === "users" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Manage Users</h3>
            <button style={btnPrimary} onClick={() => setAddForm({ username: "", password: "", role: "user" })}>+ Add User</button>
          </div>

          {users.map(u => (
            <div key={u.id} style={{ ...cardStyle, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
              <div>
                <div style={{ fontWeight: 700, color: "#111827" }}>{u.username}</div>
                <div style={{ fontSize: 13, color: "#6b7280", marginTop: 2 }}>
                  Role: <span style={{ color: u.role === "admin" ? "var(--accent, #16a34a)" : "#374151", fontWeight: 600 }}>{u.role || "user"}</span>
                </div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button style={btnSecondary} onClick={() => setPwdForm({ id: u.id, username: u.username, password: "" })}>Change PW</button>
                {u.id !== currentUser?.id && (
                  <button style={btnDanger} onClick={() => setDeleteId(u.id)}>Delete</button>
                )}
              </div>
            </div>
          ))}

          {users.length === 0 && (
            <p style={{ color: "#9ca3af", textAlign: "center", padding: "32px 0" }}>No users found. API may be unavailable.</p>
          )}
        </div>
      )}

      {/* Stats tab */}
      {tab === "stats" && (
        <div>
          <h3 style={{ margin: "0 0 20px", fontSize: 18, fontWeight: 700 }}>System Stats</h3>
          {stats ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 16 }}>
              <div style={cardStyle}>
                <div style={{ fontSize: 28, fontWeight: 800, color: "var(--accent, #16a34a)" }}>{formatBytes(stats.storage?.uploadsBytes || 0)}</div>
                <div style={{ fontSize: 13, color: "#6b7280", marginTop: 4 }}>Upload storage</div>
              </div>
              {Object.entries(stats.counts || {}).map(([key, count]) => (
                <div key={key} style={cardStyle}>
                  <div style={{ fontSize: 28, fontWeight: 800, color: "#111827" }}>{count}</div>
                  <div style={{ fontSize: 13, color: "#6b7280", marginTop: 4, textTransform: "capitalize" }}>{key}</div>
                </div>
              ))}
            </div>
          ) : (
            <button style={btnPrimary} onClick={loadStats}>Load Stats</button>
          )}
        </div>
      )}

      {/* App Settings tab */}
      {tab === "settings" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 480 }}>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>App Settings</h3>

          <div>
            <label style={labelStyle}>App Name</label>
            <input style={inputStyle} value={settingsForm.appName || ""} onChange={e => setSettingsForm(f => ({ ...f, appName: e.target.value }))} />
          </div>
          <div>
            <label style={labelStyle}>Household Name</label>
            <input style={inputStyle} placeholder="e.g. The Smith Family" value={settingsForm.householdName || ""} onChange={e => setSettingsForm(f => ({ ...f, householdName: e.target.value }))} />
          </div>
          <div>
            <label style={labelStyle}>Currency</label>
            <select style={inputStyle} value={settingsForm.currency || "EUR"} onChange={e => setSettingsForm(f => ({ ...f, currency: e.target.value }))}>
              {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Accent Color</label>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <input
                type="color"
                value={settingsForm.accentColor || "#16a34a"}
                onChange={e => setSettingsForm(f => ({ ...f, accentColor: e.target.value }))}
                style={{ width: 48, height: 40, padding: 2, border: "1px solid #e5e7eb", borderRadius: 10, cursor: "pointer" }}
              />
              <input style={{ ...inputStyle, width: 140 }} value={settingsForm.accentColor || "#16a34a"} onChange={e => setSettingsForm(f => ({ ...f, accentColor: e.target.value }))} />
              <button style={btnSecondary} onClick={() => setSettingsForm(f => ({ ...f, accentColor: "#16a34a" }))}>Reset</button>
            </div>
          </div>

          <button style={{ ...btnPrimary, alignSelf: "flex-start" }} onClick={saveSettings}>Save Settings</button>
        </div>
      )}

      {/* Add User modal */}
      {addForm && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setAddForm(null)}>
          <div className="modal-box" style={{ maxWidth: 400 }}>
            <h3 style={{ margin: "0 0 20px", fontSize: 20, fontWeight: 700 }}>Add User</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={labelStyle}>Username</label>
                <input style={inputStyle} value={addForm.username} onChange={e => setAddForm(f => ({ ...f, username: e.target.value }))} />
              </div>
              <div>
                <label style={labelStyle}>Password</label>
                <input type="password" style={inputStyle} value={addForm.password} onChange={e => setAddForm(f => ({ ...f, password: e.target.value }))} />
              </div>
              <div>
                <label style={labelStyle}>Role</label>
                <select style={inputStyle} value={addForm.role} onChange={e => setAddForm(f => ({ ...f, role: e.target.value }))}>
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
                <button style={btnPrimary} onClick={addUser}>Create User</button>
                <button style={btnSecondary} onClick={() => setAddForm(null)}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Change Password modal */}
      {pwdForm && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setPwdForm(null)}>
          <div className="modal-box" style={{ maxWidth: 380 }}>
            <h3 style={{ margin: "0 0 20px", fontSize: 20, fontWeight: 700 }}>Change Password</h3>
            <p style={{ margin: "0 0 16px", color: "#6b7280" }}>For <strong style={{ color: "#111827" }}>{pwdForm.username}</strong></p>
            <div>
              <label style={labelStyle}>New Password</label>
              <input type="password" style={inputStyle} value={pwdForm.password} onChange={e => setPwdForm(f => ({ ...f, password: e.target.value }))} />
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <button style={btnPrimary} onClick={changePassword}>Update Password</button>
              <button style={btnSecondary} onClick={() => setPwdForm(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm modal */}
      {deleteId && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setDeleteId(null)}>
          <div className="modal-box" style={{ maxWidth: 360, textAlign: "center" }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>🗑️</div>
            <h3 style={{ margin: "0 0 10px", fontSize: 20, fontWeight: 700 }}>Delete User?</h3>
            <p style={{ margin: "0 0 24px", color: "#6b7280" }}>This cannot be undone.</p>
            <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
              <button style={btnDanger} onClick={() => deleteUser(deleteId)}>Delete</button>
              <button style={btnSecondary} onClick={() => setDeleteId(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
