import { Component } from "react";

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error("ErrorBoundary caught:", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 40, textAlign: "center" }}>
          <p style={{ fontSize: 32, margin: 0 }}>⚠️</p>
          <h2 style={{ margin: "16px 0 8px", color: "#991b1b", fontSize: 20, fontWeight: 800 }}>
            Something went wrong
          </h2>
          <p style={{ margin: 0, color: "#64748b", fontSize: 14 }}>
            {this.state.error?.message || "An unexpected error occurred in this panel."}
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{
              marginTop: 20,
              background: "var(--g-sage)",
              border: "none",
              color: "#fff",
              padding: "10px 20px",
              borderRadius: 12,
              fontSize: 14,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
