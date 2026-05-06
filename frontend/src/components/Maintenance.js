import { useState, useEffect, useRef } from "react";
import { apiFetch } from "../lib/api";
import { fmtDate } from "../lib/utils";

const EMPTY_TASK = { id: null, title: "", frequency: "monthly", nextDue: new Date().toISOString().slice(0, 10), instructions: "", photo: null, completed: false };

export default function Maintenance({ maintenanceTasks, setMaintenanceTasks, apiEnabled, showToast }) {
  const [taskForm, setTaskForm] = useState(null);
  const [deleteTaskId, setDeleteTaskId] = useState(null);
  const photoRef = useRef();

  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      if (taskForm) setTaskForm(null);
      else if (deleteTaskId) setDeleteTaskId(null);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [taskForm, deleteTaskId]);

  const handlePhoto = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = (ev) => setTaskForm(p => ({ ...p, photo: ev.target.result, _photoFile: f }));
    reader.readAsDataURL(f);
  };

  const saveTask = async () => {
    if (!taskForm.title.trim()) return;
    const { _photoFile, ...payload } = taskForm;

    if (apiEnabled) {
      const method = taskForm.id ? "PUT" : "POST";
      const endpoint = taskForm.id ? `/api/maintenance/${taskForm.id}` : "/api/maintenance";
      let body, headers;
      if (_photoFile) {
        body = new FormData();
        body.append("data", JSON.stringify({ ...payload, photo: null }));
        body.append("photo", _photoFile);
      } else {
        body = JSON.stringify(payload);
        headers = { "Content-Type": "application/json" };
      }
      const result = await apiFetch(endpoint, { method, body, headers });
      if (result) {
        setMaintenanceTasks(prev => taskForm.id ? prev.map(t => t.id === taskForm.id ? result : t) : [...prev, result]);
        showToast(taskForm.id ? "Task updated" : "Task added");
        setTaskForm(null);
        return;
      }
    }

    if (taskForm.id) {
      setMaintenanceTasks(prev => prev.map(t => t.id === taskForm.id ? { ...payload } : t));
    } else {
      setMaintenanceTasks(prev => [...prev, { ...payload, id: Date.now() }]);
    }
    showToast(taskForm.id ? "Task updated" : "Task added");
    setTaskForm(null);
  };

  const toggleCompleted = async (id) => {
    const task = maintenanceTasks.find(t => t.id === id);
    if (!task) return;
    const updated = { ...task, completed: !task.completed };
    if (apiEnabled) {
      const result = await apiFetch(`/api/maintenance/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(updated) });
      if (result) { setMaintenanceTasks(prev => prev.map(t => t.id === id ? result : t)); showToast("Status updated"); return; }
    }
    setMaintenanceTasks(prev => prev.map(t => t.id === id ? updated : t));
    showToast("Status updated");
  };

  const confirmDelete = async () => {
    if (apiEnabled) await apiFetch(`/api/maintenance/${deleteTaskId}`, { method: "DELETE" });
    setMaintenanceTasks(prev => prev.filter(t => t.id !== deleteTaskId));
    setDeleteTaskId(null);
    showToast("Task removed", "danger");
  };

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16, marginBottom: 32 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 28, fontWeight: 800, color: "#166534" }}>🛠️ Home Maintenance</h2>
          <p style={{ margin: "8px 0 0", color: "#64748b", fontSize: 16 }}>Track upkeep, inspections, and recurring house tasks.</p>
        </div>
        <button onClick={() => setTaskForm({ ...EMPTY_TASK })} style={{ background: "linear-gradient(135deg, #16a34a, #22c55e)", border: "none", color: "#fff", padding: "14px 24px", borderRadius: 16, fontSize: 15, fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 12px rgba(22,163,74,0.3)" }}>
          + New task
        </button>
      </div>

      {maintenanceTasks.length === 0 ? (
        <div style={{ padding: 32, borderRadius: 20, background: "rgba(255,255,255,0.9)", border: "1px solid rgba(34,197,94,0.1)", color: "#64748b", fontSize: 15, textAlign: "center" }}>
          No maintenance tasks yet. Add one to keep your home checklist on schedule.
        </div>
      ) : (
        <div style={{ display: "grid", gap: 20 }}>
          {maintenanceTasks.map(task => (
            <div key={task.id} style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 16, background: "rgba(255,255,255,0.95)", border: "1px solid rgba(34,197,94,0.1)", borderRadius: 20, padding: 24, boxShadow: "0 10px 20px rgba(0,0,0,0.05)" }}>
              <div>
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", marginBottom: 10 }}>
                  <h4 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#166534" }}>{task.title}</h4>
                  <span style={{ fontSize: 12, color: task.completed ? "#16a34a" : "#64748b", fontWeight: 700, padding: "5px 12px", borderRadius: 16, background: task.completed ? "rgba(22,163,74,0.12)" : "rgba(148,163,184,0.12)" }}>
                    {task.completed ? "Completed" : "Pending"}
                  </span>
                </div>
                {task.instructions && <p style={{ margin: 0, fontSize: 14, color: "#4b5563", lineHeight: 1.7 }}>{task.instructions}</p>}
                <div style={{ display: "flex", gap: 20, flexWrap: "wrap", marginTop: 14, color: "#64748b", fontSize: 13 }}>
                  <span>Frequency: {task.frequency}</span>
                  <span>Next due: {fmtDate(task.nextDue)}</span>
                </div>
                {task.photo && (
                  <div style={{ marginTop: 18, maxWidth: 340, borderRadius: 16, overflow: "hidden", boxShadow: "0 8px 16px rgba(0,0,0,0.08)" }}>
                    <img src={task.photo} alt={task.title} style={{ width: "100%", display: "block", objectFit: "cover", maxHeight: 220 }} />
                  </div>
                )}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10, justifyContent: "flex-start" }}>
                <button onClick={() => toggleCompleted(task.id)} style={{ background: task.completed ? "rgba(34,197,94,0.15)" : "rgba(255,255,255,0.95)", border: "1px solid rgba(34,197,94,0.2)", color: "#16a34a", borderRadius: 12, padding: "10px 14px", cursor: "pointer", fontWeight: 700, fontSize: 13 }}>
                  {task.completed ? "Mark pending" : "Mark done"}
                </button>
                <button onClick={() => setTaskForm({ ...task })} style={{ background: "rgba(255,255,255,0.95)", border: "1px solid rgba(107,114,128,0.15)", color: "#374151", borderRadius: 12, padding: "10px 14px", cursor: "pointer", fontWeight: 700, fontSize: 13 }}>Edit</button>
                <button onClick={() => setDeleteTaskId(task.id)} style={{ background: "rgba(252,165,165,0.1)", border: "1px solid rgba(252,165,165,0.3)", color: "#dc2626", borderRadius: 12, padding: "10px 14px", cursor: "pointer", fontWeight: 700, fontSize: 13 }}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Task form modal */}
      {taskForm && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setTaskForm(null)}>
          <div className="modal-box">
            <h2 style={{ margin: "0 0 20px", fontSize: 20, fontWeight: 800, color: "#166534" }}>
              {taskForm.id ? "Edit Task" : "New Maintenance Task"}
            </h2>
            <div style={{ display: "grid", gap: 16 }}>
              <div>
                <label style={labelStyle}>Title</label>
                <input value={taskForm.title} onChange={e => setTaskForm(p => ({ ...p, title: e.target.value }))} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Frequency</label>
                <select value={taskForm.frequency} onChange={e => setTaskForm(p => ({ ...p, frequency: e.target.value }))} style={inputStyle}>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="annually">Annually</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>Next due date</label>
                <input type="date" value={taskForm.nextDue} onChange={e => setTaskForm(p => ({ ...p, nextDue: e.target.value }))} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Instructions</label>
                <textarea value={taskForm.instructions} onChange={e => setTaskForm(p => ({ ...p, instructions: e.target.value }))} rows={4} style={{ ...inputStyle, resize: "vertical" }} />
              </div>
              <div>
                <label style={labelStyle}>Photo evidence</label>
                <input ref={photoRef} type="file" accept="image/*" onChange={handlePhoto} style={{ display: "none" }} />
                <button onClick={() => photoRef.current.click()} style={uploadBtnStyle}>
                  {taskForm.photo ? "📷 Photo uploaded" : "Click to upload photo"}
                </button>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <input id="completedCheck" type="checkbox" checked={taskForm.completed} onChange={e => setTaskForm(p => ({ ...p, completed: e.target.checked }))} style={{ width: 16, height: 16, accentColor: "#16a34a" }} />
                <label htmlFor="completedCheck" style={{ color: "#4b5563", fontSize: 14, fontWeight: 600 }}>Mark as completed</label>
              </div>
            </div>
            <div style={modalFooterStyle}>
              <button onClick={() => setTaskForm(null)} style={cancelBtnStyle}>Cancel</button>
              <button onClick={saveTask} style={primaryBtnStyle}>Save task</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {deleteTaskId && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setDeleteTaskId(null)}>
          <div className="modal-box" style={{ maxWidth: 400, textAlign: "center" }}>
            <p style={{ fontSize: 18, marginBottom: 24, color: "#166534" }}>Delete this task? This cannot be undone.</p>
            <div style={{ display: "flex", gap: 12 }}>
              <button onClick={() => setDeleteTaskId(null)} style={cancelBtnStyle}>Cancel</button>
              <button onClick={confirmDelete} style={{ ...cancelBtnStyle, background: "rgba(252,165,165,0.1)", border: "1px solid rgba(252,165,165,0.3)", color: "#dc2626" }}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

const labelStyle = { fontSize: 14, color: "#4b5563", display: "block", marginBottom: 6, fontWeight: 600 };
const inputStyle = { width: "100%", background: "rgba(255,255,255,0.9)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: 12, padding: "12px 16px", color: "#166534", fontSize: 15, boxSizing: "border-box" };
const uploadBtnStyle = { background: "rgba(255,255,255,0.9)", border: "2px dashed rgba(34,197,94,0.3)", borderRadius: 12, padding: "16px", color: "#16a34a", cursor: "pointer", fontSize: 14, width: "100%", fontWeight: 600 };
const modalFooterStyle = { display: "flex", gap: 12, marginTop: 24 };
const cancelBtnStyle = { flex: 1, padding: "14px", background: "rgba(255,255,255,0.9)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: 12, color: "#64748b", cursor: "pointer", fontSize: 15, fontWeight: 600 };
const primaryBtnStyle = { flex: 2, padding: "14px", background: "linear-gradient(135deg, #16a34a, #22c55e)", border: "none", borderRadius: 12, color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 15 };
