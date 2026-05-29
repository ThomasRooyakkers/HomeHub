export default function Toast({ toast }) {
  if (!toast) return null;
  return (
    <div style={{
      position: "fixed", top: 20, right: 20, zIndex: 9999,
      background: "var(--g-card)",
      color: "var(--g-ink)",
      padding: "14px 20px",
      borderRadius: 16,
      fontSize: 14,
      fontWeight: 500,
      fontFamily: "var(--g-sans)",
      boxShadow: "var(--g-shadow)",
      borderLeft: toast.type === "danger"
        ? "3px solid var(--g-brick)"
        : "3px solid var(--g-sage)",
      animation: "fadein .2s ease",
      maxWidth: 320,
    }}>
      {toast.msg}
    </div>
  );
}
