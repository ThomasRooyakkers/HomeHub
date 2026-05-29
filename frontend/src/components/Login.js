import { useState } from "react";
import { apiFetch } from "../lib/api";

export default function Login({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const user = await apiFetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      onLogin(user);
    } catch (err) {
      setError(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = {
    width: "100%",
    padding: "11px 14px",
    border: "1px solid var(--g-hair)",
    borderRadius: 12,
    fontSize: 14,
    outline: "none",
    fontFamily: "var(--g-sans)",
    background: "#fff",
    color: "var(--g-ink)",
    boxSizing: "border-box",
  };

  const labelStyle = {
    display: "block",
    fontSize: 12,
    fontWeight: 600,
    color: "var(--g-muted)",
    marginBottom: 6,
    fontFamily: "var(--g-sans)",
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "var(--g-bg)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "var(--g-sans)",
    }}>
      <div style={{
        background: "var(--g-card)",
        borderRadius: 24,
        padding: "48px 40px",
        width: "100%",
        maxWidth: 400,
        boxShadow: "var(--g-shadow)",
      }}>
        {/* Brand mark */}
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <div style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 36,
            height: 36,
            borderRadius: 10,
            background: "var(--g-sage)",
            marginBottom: 16,
          }}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M2 9.5L10 3l8 6.5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M4 8.5V17h4v-4h4v4h4V8.5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <h1 style={{
            margin: 0,
            fontSize: 28,
            fontWeight: 400,
            fontFamily: "var(--g-serif)",
            color: "var(--g-ink)",
            letterSpacing: "-0.5px",
          }}>HomeHub</h1>
          <p style={{
            margin: "6px 0 0",
            color: "var(--g-ink2)",
            fontSize: 14,
            fontFamily: "var(--g-sans)",
          }}>Sign in to continue</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Username</label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              required
              autoFocus
              autoComplete="username"
              style={inputStyle}
            />
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={labelStyle}>Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              style={inputStyle}
            />
          </div>

          {error && (
            <div style={{
              color: "var(--g-brick)",
              fontSize: 13,
              fontWeight: 500,
              marginBottom: 16,
              fontFamily: "var(--g-sans)",
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              padding: "12px",
              background: loading ? "var(--g-mute2)" : "var(--g-sage)",
              color: "#ffffff",
              border: "none",
              borderRadius: 12,
              fontSize: 14,
              fontWeight: 600,
              cursor: loading ? "not-allowed" : "pointer",
              fontFamily: "var(--g-sans)",
              transition: "opacity 0.15s",
            }}
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
