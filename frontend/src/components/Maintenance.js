import { useState, useEffect, useRef } from "react";
import { apiFetch } from "../lib/api";
import { fmtDate } from "../lib/utils";

const EMPTY_TASK = { id: null, title: "", frequency: "monthly", nextDue: new Date().toISOString().slice(0, 10), instructions: "", photo: null, completed: false };

const FILTERS = ["All", "Due soon", "Completed"];

export default function Maintenance({ maintenanceTasks, setMaintenanceTasks, apiEnabled, showToast }) {
  const [taskForm, setTaskForm] = useState(null);
  const [deleteTaskId, setDeleteTaskId] = useState(null);
  const [filter, setFilter] = useState("All");
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
      try {
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
        setMaintenanceTasks(prev => taskForm.id ? prev.map(t => t.id === taskForm.id ? result : t) : [...prev, result]);
        showToast(taskForm.id ? "Task updated" : "Task added");
        setTaskForm(null);
        return;
      } catch (err) {
        showToast(err.message || "Request failed", "danger");
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
      try {
        const result = await apiFetch(`/api/maintenance/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(updated) });
        setMaintenanceTasks(prev => prev.map(t => t.id === id ? result : t));
        showToast("Status updated");
        return;
      } catch (err) {
        showToast(err.message || "Update failed", "danger");
        return;
      }
    }
    setMaintenanceTasks(prev => prev.map(t => t.id === id ? updated : t));
    showToast("Status updated");
  };

  const confirmDelete = async () => {
    if (apiEnabled) {
      try {
        await apiFetch(`/api/maintenance/${deleteTaskId}`, { method: "DELETE" });
      } catch (err) {
        showToast(err.message || "Delete failed", "danger");
        setDeleteTaskId(null);
        return;
      }
    }
    setMaintenanceTasks(prev => prev.filter(t => t.id !== deleteTaskId));
    setDeleteTaskId(null);
    showToast("Task removed", "danger");
  };

  const today = new Date();
  const soonMs = 7 * 24 * 60 * 60 * 1000;

  const totalTasks = maintenanceTasks.length;
  const completedCount = maintenanceTasks.filter(t => t.completed).length;
  const dueSoonCount = maintenanceTasks.filter(t => !t.completed && new Date(t.nextDue) - today <= soonMs).length;
  const pendingCount = maintenanceTasks.filter(t => !t.completed).length;

  const filteredTasks = maintenanceTasks.filter(t => {
    if (filter === "Completed") return t.completed;
    if (filter === "Due soon") return !t.completed && new Date(t.nextDue) - today <= soonMs;
    return true;
  });

  return (
    <div className="page" style={{ display: "flex", flexDirection: "column", gap: 24, fontFamily: "var(--g-sans)" }}>
      {/* Page header */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
        <div>
          <p style={{ margin: 0, fontSize: 11.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, color: "var(--g-sage)", fontFamily: "var(--g-sans)" }}>Home</p>
          <h1 style={{ margin: "4px 0 0", fontSize: 44, fontWeight: 400, fontFamily: "var(--g-serif)", color: "var(--g-ink)", letterSpacing: "-0.5px", lineHeight: 1 }}>Maintain</h1>
        </div>
        <button
          onClick={() => setTaskForm({ ...EMPTY_TASK })}
          style={{ background: "var(--g-sage)", border: "none", color: "#fff", padding: "10px 20px", borderRadius: 12, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "var(--g-sans)" }}
        >
          + New task
        </button>
      </div>

      {/* Stats grid */}
      <div className="stats-grid">
        {[
          { label: "Total tasks", value: totalTasks },
          { label: "Pending", value: pendingCount },
          { label: "Due soon", value: dueSoonCount, warn: dueSoonCount > 0 },
          { label: "Completed", value: completedCount },
        ].map(s => (
          <div key={s.label} style={{ background: "var(--g-card)", borderRadius: 20, padding: "20px 24px", boxShadow: "var(--g-shadow-sm)" }}>
            <p style={{ margin: 0, fontSize: 11.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.8, color: s.warn ? "var(--g-honey)" : "var(--g-muted)" }}>{s.label}</p>
            <p style={{ margin: "8px 0 0", fontSize: 32, fontWeight: 400, fontFamily: "var(--g-serif)", color: s.warn ? "var(--g-honey)" : "var(--g-ink)", lineHeight: 1 }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filter pills */}
      <div style={{ display: "flex", gap: 8 }}>
        {FILTERS.map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              border: filter === f ? "none" : "1px solid var(--g-hair)",
              borderRadius: 999,
              padding: "7px 16px",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "var(--g-sans)",
              background: filter === f ? "var(--g-sage-bg)" : "var(--g-card)",
              color: filter === f ? "var(--g-sage-dark)" : "var(--g-ink2)",
            }}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Task list */}
      <div style={{ background: "var(--g-card)", borderRadius: 20, boxShadow: "var(--g-shadow)" }}>
        {filteredTasks.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: "var(--g-muted)", fontSize: 14 }}>
            {maintenanceTasks.length === 0
              ? "No maintenance tasks yet. Add one to keep your home on schedule."
              : "No tasks match this filter."}
          </div>
        ) : (
          filteredTasks.map((task, i) => {
            const isDueSoon = !task.completed && new Date(task.nextDue) - today <= soonMs;
            return (
              <div
                key={task.id}
                className="maintenance-task-row"
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  gap: 16,
                  padding: "14px 24px",
                  borderTop: i === 0 ? "none" : "1px solid var(--g-hair2)",
                }}
              >
                <div style={{ display: "flex", gap: 14, alignItems: "flex-start", flex: 1 }}>
                  {/* Wrench icon square */}
                  <div style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    background: task.completed ? "var(--g-sage-bg)" : isDueSoon ? "var(--g-honey-bg)" : "var(--g-bg)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}>
                    <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
                      <path d="M14.5 2.5a3.5 3.5 0 0 1 0 7 3.5 3.5 0 0 1-3.46-3H10L4 12.5 5.5 14l1-1 1 1-1 1L8 16.5l2.5-2.5v-1.3a3.5 3.5 0 0 1 4-5.7" stroke={task.completed ? "var(--g-sage)" : isDueSoon ? "var(--g-honey)" : "var(--g-muted)"} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>

                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 4 }}>
                      {/* Checkbox */}
                      <input
                        type="checkbox"
                        checked={task.completed}
                        onChange={() => toggleCompleted(task.id)}
                        style={{ width: 15, height: 15, accentColor: "var(--g-sage)", cursor: "pointer", flexShrink: 0 }}
                      />
                      <span style={{ fontSize: 15, fontWeight: 600, color: task.completed ? "var(--g-muted)" : "var(--g-ink)", textDecoration: task.completed ? "line-through" : "none" }}>
                        {task.title}
                      </span>
                      {/* Frequency */}
                      <span style={{ fontSize: 12, color: "var(--g-muted)" }}>{task.frequency}</span>
                      {/* Status badge */}
                      <span style={{
                        borderRadius: 999,
                        padding: "4px 9px",
                        fontSize: 11.5,
                        fontWeight: 600,
                        background: task.completed ? "var(--g-sage-bg)" : isDueSoon ? "var(--g-honey-bg)" : "var(--g-bg)",
                        color: task.completed ? "var(--g-sage-dark)" : isDueSoon ? "var(--g-honey)" : "var(--g-muted)",
                      }}>
                        {task.completed ? "Completed" : isDueSoon ? "Due soon" : "Pending"}
                      </span>
                    </div>

                    {task.instructions && (
                      <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--g-ink2)", lineHeight: 1.6 }}>{task.instructions}</p>
                    )}

                    <p style={{ margin: "6px 0 0", fontSize: 12, color: "var(--g-muted)" }}>
                      Next due: {fmtDate(task.nextDue)}
                    </p>

                    {task.photo && (
                      <div style={{ marginTop: 12, maxWidth: 280, borderRadius: 12, overflow: "hidden", boxShadow: "var(--g-shadow-sm)" }}>
                        <img src={task.photo} alt={task.title} style={{ width: "100%", display: "block", objectFit: "cover", maxHeight: 180 }} />
                      </div>
                    )}
                  </div>
                </div>

                <div className="maintenance-task-actions" style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                  <button
                    onClick={() => setTaskForm({ ...task })}
                    style={{ background: "var(--g-bg)", border: "1px solid var(--g-hair)", color: "var(--g-ink2)", borderRadius: 12, padding: "7px 12px", cursor: "pointer", fontWeight: 600, fontSize: 13, fontFamily: "var(--g-sans)" }}
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => setDeleteTaskId(task.id)}
                    style={{ background: "var(--g-brick-bg)", border: "none", color: "var(--g-brick)", borderRadius: 12, padding: "7px 12px", cursor: "pointer", fontWeight: 600, fontSize: 13, fontFamily: "var(--g-sans)" }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Task form modal */}
      {taskForm && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setTaskForm(null)}>
          <div className="modal-box">
            <h2 style={{ margin: "0 0 20px", fontSize: 22, fontWeight: 400, fontFamily: "var(--g-serif)", color: "var(--g-ink)" }}>
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
                  {taskForm.photo ? "Photo uploaded" : "Click to upload photo"}
                </button>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <input id="completedCheck" type="checkbox" checked={taskForm.completed} onChange={e => setTaskForm(p => ({ ...p, completed: e.target.checked }))} style={{ width: 15, height: 15, accentColor: "var(--g-sage)" }} />
                <label htmlFor="completedCheck" style={{ color: "var(--g-ink2)", fontSize: 14, fontWeight: 600, fontFamily: "var(--g-sans)" }}>Mark as completed</label>
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
            <p style={{ fontSize: 16, marginBottom: 24, color: "var(--g-ink)", fontFamily: "var(--g-sans)" }}>Delete this task? This cannot be undone.</p>
            <div style={{ display: "flex", gap: 12 }}>
              <button onClick={() => setDeleteTaskId(null)} style={cancelBtnStyle}>Cancel</button>
              <button onClick={confirmDelete} style={{ ...cancelBtnStyle, background: "var(--g-brick-bg)", border: "none", color: "var(--g-brick)" }}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const labelStyle = { fontSize: 12, color: "var(--g-muted)", display: "block", marginBottom: 6, fontWeight: 600, fontFamily: "var(--g-sans)" };
const inputStyle = { width: "100%", background: "#fff", border: "1px solid var(--g-hair)", borderRadius: 12, padding: "11px 14px", color: "var(--g-ink)", fontSize: 14, boxSizing: "border-box", fontFamily: "var(--g-sans)" };
const uploadBtnStyle = { background: "#fff", border: "2px dashed var(--g-hair)", borderRadius: 12, padding: "16px", color: "var(--g-sage)", cursor: "pointer", fontSize: 14, width: "100%", fontWeight: 600, fontFamily: "var(--g-sans)" };
const modalFooterStyle = { display: "flex", gap: 12, marginTop: 24 };
const cancelBtnStyle = { flex: 1, padding: "12px", background: "var(--g-bg)", border: "1px solid var(--g-hair)", borderRadius: 12, color: "var(--g-ink2)", cursor: "pointer", fontSize: 14, fontWeight: 600, fontFamily: "var(--g-sans)" };
const primaryBtnStyle = { flex: 2, padding: "12px", background: "var(--g-sage)", border: "none", borderRadius: 12, color: "#fff", fontWeight: 600, cursor: "pointer", fontSize: 14, fontFamily: "var(--g-sans)" };
