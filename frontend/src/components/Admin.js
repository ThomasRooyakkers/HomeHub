import { useState, useEffect } from "react";
import { apiFetch } from "../lib/api";

const CURRENCIES = ["EUR", "USD", "GBP", "CHF", "SEK", "NOK", "DKK"];

const labelStyle = { fontSize: 12, color: "var(--g-muted)", display: "block", marginBottom: 6, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" };
const inputStyle = { width: "100%", background: "#fff", border: "1px solid var(--g-hair)", borderRadius: 12, padding: "11px 14px", fontSize: 14, fontFamily: "inherit", color: "var(--g-ink)", boxSizing: "border-box" };
const btnPrimary = { padding: "10px 20px", background: "var(--g-sage)", color: "#fff", border: "none", borderRadius: 12, fontWeight: 600, fontSize: 14, cursor: "pointer", fontFamily: "inherit" };
const btnSecondary = { padding: "10px 20px", background: "var(--g-bg)", color: "var(--g-ink2)", border: "1px solid var(--g-hair)", borderRadius: 12, fontWeight: 600, fontSize: 14, cursor: "pointer", fontFamily: "inherit" };
const btnDanger = { padding: "6px 14px", background: "var(--g-brick-bg)", color: "var(--g-brick)", border: "1px solid transparent", borderRadius: 10, fontWeight: 600, fontSize: 13, cursor: "pointer", fontFamily: "inherit" };

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
    { id: "stats", label: "System" },
    { id: "settings", label: "Settings" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24, padding: "32px 40px 60px", maxWidth: 900 }}>
      {/* Header */}
      <div>
        <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: "var(--g-sage)", textTransform: "uppercase", letterSpacing: "0.1em" }}>System</p>
        <h1 style={{ margin: "4px 0 0", fontSize: 44, fontWeight: 400, color: "var(--g-ink)", fontFamily: "var(--g-serif)", lineHeight: 1 }}>Admin</h1>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 6 }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            all: "unset", cursor: "pointer",
            padding: "8px 18px", borderRadius: 999,
            fontFamily: "var(--g-sans)", fontWeight: 600, fontSize: 13,
            background: tab === t.id ? "var(--g-sage-bg)" : "var(--g-card)",
            color: tab === t.id ? "var(--g-sage-dark)" : "var(--g-ink2)",
            border: `1px solid ${tab === t.id ? "transparent" : "var(--g-hair)"}`,
            boxShadow: "var(--g-shadow-sm)",
          }}>{t.label}</button>
        ))}
      </div>

      {/* Users tab */}
      {tab === "users" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3 style={{ margin: 0, fontSize: 20, fontWeight: 400, fontFamily: "var(--g-serif)", color: "var(--g-ink)" }}>Manage users</h3>
            <button style={btnPrimary} onClick={() => setAddForm({ username: "", password: "", role: "user" })}>+ Add user</button>
          </div>

          <div style={{ background: "var(--g-card)", borderRadius: 20, boxShadow: "var(--g-shadow)", overflow: "hidden" }}>
            {users.length === 0 ? (
              <p style={{ color: "var(--g-muted)", textAlign: "center", padding: "40px 0", fontFamily: "var(--g-sans)" }}>No users found. API may be unavailable.</p>
            ) : users.map((u, idx) => (
              <div key={u.id} style={{
                display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16,
                padding: "16px 24px",
                borderTop: idx > 0 ? "1px solid var(--g-hair2)" : "none",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: 12,
                    background: u.role === "admin" ? "var(--g-sage-bg)" : "var(--g-bg)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontFamily: "var(--g-serif)", fontSize: 18, color: u.role === "admin" ? "var(--g-sage-dark)" : "var(--g-muted)",
                  }}>
                    {u.username[0].toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, color: "var(--g-ink)", fontSize: 14, fontFamily: "var(--g-sans)" }}>{u.username}</div>
                    <div style={{ fontSize: 12, color: "var(--g-muted)", marginTop: 2, fontFamily: "var(--g-sans)" }}>
                      <span style={{
                        padding: "2px 8px", borderRadius: 999, fontSize: 11, fontWeight: 600,
                        background: u.role === "admin" ? "var(--g-sage-bg)" : "var(--g-hair2)",
                        color: u.role === "admin" ? "var(--g-sage-dark)" : "var(--g-muted)",
                      }}>{u.role || "user"}</span>
                    </div>
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
          </div>
        </div>
      )}

      {/* Stats tab */}
      {tab === "stats" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <h3 style={{ margin: 0, fontSize: 20, fontWeight: 400, fontFamily: "var(--g-serif)", color: "var(--g-ink)" }}>System stats</h3>

          {/* PWA install info card */}
          <div style={{ background: `linear-gradient(135deg, var(--g-card), var(--g-sky-bg))`, borderRadius: 20, padding: 22, boxShadow: "var(--g-shadow)" }}>
            <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: "var(--g-sky)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Install - iOS</p>
            <h3 style={{ margin: "4px 0 8px", fontSize: 20, fontWeight: 400, fontFamily: "var(--g-serif)", color: "var(--g-ink)" }}>Add to Home Screen</h3>
            <p style={{ margin: 0, fontSize: 13, color: "var(--g-ink2)", lineHeight: 1.6 }}>
              HomeHub runs as a progressive web app - no App Store. Open in Safari, then <strong>Share</strong>, then <strong>Add to Home Screen</strong>.
            </p>
          </div>

          {stats ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 14 }}>
              <div style={{ background: "var(--g-card)", borderRadius: 20, padding: "20px 22px", boxShadow: "var(--g-shadow)" }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: "var(--g-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Upload storage</div>
                <div style={{ fontSize: 26, fontWeight: 400, fontFamily: "var(--g-serif)", color: "var(--g-ink)", lineHeight: 1 }}>{formatBytes(stats.storage?.uploadsBytes || 0)}</div>
                <div style={{ height: 3, width: 28, background: "var(--g-sage)", borderRadius: 2, marginTop: 10 }} />
              </div>
              {Object.entries(stats.counts || {}).map(([key, count]) => (
                <div key={key} style={{ background: "var(--g-card)", borderRadius: 20, padding: "20px 22px", boxShadow: "var(--g-shadow)" }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "var(--g-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>{key}</div>
                  <div style={{ fontSize: 26, fontWeight: 400, fontFamily: "var(--g-serif)", color: "var(--g-ink)", lineHeight: 1 }}>{count}</div>
                  <div style={{ height: 3, width: 28, background: "var(--g-honey)", borderRadius: 2, marginTop: 10 }} />
                </div>
              ))}
            </div>
          ) : (
            <button style={{ ...btnPrimary, alignSelf: "flex-start" }} onClick={loadStats}>Load stats</button>
          )}
        </div>
      )}

      {/* Settings tab */}
      {tab === "settings" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 480 }}>
          <h3 style={{ margin: 0, fontSize: 20, fontWeight: 400, fontFamily: "var(--g-serif)", color: "var(--g-ink)" }}>App settings</h3>

          <div style={{ background: "var(--g-card)", borderRadius: 20, padding: "22px 24px", boxShadow: "var(--g-shadow)", display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <label style={labelStyle}>App name</label>
              <input style={inputStyle} value={settingsForm.appName || ""} onChange={e => setSettingsForm(f => ({ ...f, appName: e.target.value }))} />
            </div>
            <div>
              <label style={labelStyle}>Household name</label>
              <input style={inputStyle} placeholder="e.g. The Smiths" value={settingsForm.householdName || ""} onChange={e => setSettingsForm(f => ({ ...f, householdName: e.target.value }))} />
            </div>
            <div>
              <label style={labelStyle}>Currency</label>
              <select style={inputStyle} value={settingsForm.currency || "EUR"} onChange={e => setSettingsForm(f => ({ ...f, currency: e.target.value }))}>
                {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Accent colour</label>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <input
                  type="color"
                  value={settingsForm.accentColor || "#5a7a5e"}
                  onChange={e => setSettingsForm(f => ({ ...f, accentColor: e.target.value }))}
                  style={{ width: 48, height: 40, padding: 2, border: "1px solid var(--g-hair)", borderRadius: 10, cursor: "pointer" }}
                />
                <input style={{ ...inputStyle, width: 140 }} value={settingsForm.accentColor || "#5a7a5e"} onChange={e => setSettingsForm(f => ({ ...f, accentColor: e.target.value }))} />
                <button style={btnSecondary} onClick={() => setSettingsForm(f => ({ ...f, accentColor: "#5a7a5e" }))}>Reset</button>
              </div>
            </div>
            <div>
              <label style={labelStyle}>Weather location</label>
              <input
                style={inputStyle}
                placeholder="e.g. New York"
                value={settingsForm.location || ""}
                onChange={e => setSettingsForm(f => ({ ...f, location: e.target.value }))}
              />
            </div>
          </div>

          <button style={{ ...btnPrimary, alignSelf: "flex-start" }} onClick={saveSettings}>Save settings</button>
        </div>
      )}

      {/* Add User modal */}
      {addForm && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setAddForm(null)}>
          <div className="modal-box" style={{ maxWidth: 400 }}>
            <h3 style={{ margin: "0 0 20px", fontSize: 24, fontWeight: 400, fontFamily: "var(--g-serif)", color: "var(--g-ink)" }}>Add user</h3>
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
                <button style={btnPrimary} onClick={addUser}>Create</button>
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
            <h3 style={{ margin: "0 0 8px", fontSize: 24, fontWeight: 400, fontFamily: "var(--g-serif)", color: "var(--g-ink)" }}>Change password</h3>
            <p style={{ margin: "0 0 16px", color: "var(--g-muted)", fontSize: 13, fontFamily: "var(--g-sans)" }}>For <strong style={{ color: "var(--g-ink2)" }}>{pwdForm.username}</strong></p>
            <div>
              <label style={labelStyle}>New password</label>
              <input type="password" style={inputStyle} value={pwdForm.password} onChange={e => setPwdForm(f => ({ ...f, password: e.target.value }))} />
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <button style={btnPrimary} onClick={changePassword}>Update</button>
              <button style={btnSecondary} onClick={() => setPwdForm(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm modal */}
      {deleteId && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setDeleteId(null)}>
          <div className="modal-box" style={{ maxWidth: 360, textAlign: "center" }}>
            <h3 style={{ margin: "0 0 8px", fontSize: 22, fontWeight: 400, fontFamily: "var(--g-serif)", color: "var(--g-ink)" }}>Delete user?</h3>
            <p style={{ margin: "0 0 24px", color: "var(--g-muted)", fontSize: 14 }}>This cannot be undone.</p>
            <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
              <button style={{ ...btnSecondary, background: "var(--g-brick-bg)", color: "var(--g-brick)", borderColor: "transparent" }} onClick={() => deleteUser(deleteId)}>Delete</button>
              <button style={btnSecondary} onClick={() => setDeleteId(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
