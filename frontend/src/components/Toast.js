export default function Toast({ toast }) {
  if (!toast) return null;
  return (
    <div style={{
      position: "fixed", top: 20, right: 20, zIndex: 9999,
      background: toast.type === "danger" ? "#dc2626" : "#16a34a",
      color: "#fff", padding: "16px 24px", borderRadius: 16,
      fontSize: 14, fontWeight: 500,
      boxShadow: "0 10px 25px rgba(0,0,0,0.15)",
      animation: "fadein .2s ease",
    }}>
      {toast.msg}
    </div>
  );
}
