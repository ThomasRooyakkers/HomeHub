import { useState, useEffect } from "react";

export const fmt = (n) =>
  new Intl.NumberFormat("nl-BE", { style: "currency", currency: "EUR" }).format(n);

export const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString("nl-BE", { day: "2-digit", month: "short", year: "numeric" }) : "—";

export const dateKey = (date) => new Date(date).toISOString().slice(0, 10);

export const getWeekDays = () => {
  const today = new Date();
  return Array.from({ length: 7 }).map((_, idx) => {
    const day = new Date(today);
    day.setDate(today.getDate() + idx);
    return {
      key: dateKey(day),
      label: day.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" }),
      short: day.toLocaleDateString("en-US", { weekday: "short" }),
      isToday: idx === 0,
    };
  });
};

export const displayStatus = (inv) => {
  if (!inv.dueDate) return inv.status;
  return new Date(inv.dueDate) < new Date() && inv.status !== "paid" ? "overdue" : inv.status;
};

export const statusStyle = (s) =>
  ({
    paid: { bg: "#d1fae5", color: "#065f46", label: "Paid" },
    unpaid: { bg: "#fef3c7", color: "#92400e", label: "Unpaid" },
    overdue: { bg: "#fee2e2", color: "#991b1b", label: "Overdue" },
  }[s] || { bg: "#f3f4f6", color: "#374151", label: s });

export const useTodayKey = () => {
  const [today, setToday] = useState(() => dateKey(new Date()));
  useEffect(() => {
    const id = setInterval(() => {
      const k = dateKey(new Date());
      setToday(prev => prev === k ? prev : k);
    }, 60_000);
    return () => clearInterval(id);
  }, []);
  return today;
};
