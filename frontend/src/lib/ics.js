// RFC 5545 §3.1: unfold continuation lines (CRLF + whitespace) before parsing
const unfold = (content) => content.replace(/\r?\n[ \t]/g, "");

const parseTime = (value) => {
  if (!value) return null;
  const normalized = value.replace(/Z$/, "");
  if (/^\d{8}$/.test(normalized)) {
    return new Date(
      `${normalized.slice(0, 4)}-${normalized.slice(4, 6)}-${normalized.slice(6, 8)}T00:00:00`
    );
  }
  if (/^\d{8}T\d{6}$/.test(normalized)) {
    return new Date(
      `${normalized.slice(0, 4)}-${normalized.slice(4, 6)}-${normalized.slice(6, 8)}` +
      `T${normalized.slice(9, 11)}:${normalized.slice(11, 13)}:${normalized.slice(13, 15)}`
    );
  }
  return new Date(normalized);
};

export const parseICS = (content, provider) => {
  const lines = unfold(content).split(/\r?\n/).map(l => l.trim());
  const events = [];
  let current = null;

  for (const line of lines) {
    if (line === "BEGIN:VEVENT") { current = {}; continue; }
    if (line === "END:VEVENT") {
      if (current?.dtstart) {
        events.push({
          uid: current.uid || `${provider}-${Date.now()}-${Math.random()}`,
          title: current.summary || "Untitled event",
          description: current.description || "",
          location: current.location || "",
          start: parseTime(current.dtstart) || new Date().toISOString(),
          end: parseTime(current.dtend) || parseTime(current.dtstart) || new Date().toISOString(),
          provider,
        });
      }
      current = null;
      continue;
    }
    if (!current) continue;
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).split(";")[0].toLowerCase();
    current[key] = line.slice(colonIdx + 1);
  }

  return events;
};
