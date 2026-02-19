/**
 * DateRangeFilter — Polished date-range dropdown for the dashboard.
 *
 * Features:
 *  - Quick presets (Today, Yesterday, Previous week/7d/30d, month/3mo/12mo)
 *  - Fixed date range (Between/Before/On/After + dual calendar)
 *  - Relative date range (Previous/Current/Next + number + unit + include-today)
 *  - Exclude filters (days of week, months of year)
 *
 * Accepts `onApply({ from: Date, to: Date, excludeDays: number[], excludeMonths: number[], label: string })`
 * and `activeLabel` for the trigger button text.
 */

import { useState, useRef, useEffect, useCallback } from "react";

// ─── Date helpers ────────────────────────────────────────────

function startOfDay(d) { const n = new Date(d); n.setHours(0, 0, 0, 0); return n; }
function endOfDay(d) { const n = new Date(d); n.setHours(23, 59, 59, 999); return n; }
function addDays(d, n) { const r = new Date(d); r.setDate(r.getDate() + n); return r; }
function addMonths(d, n) { const r = new Date(d); r.setMonth(r.getMonth() + n); return r; }

function fmtDisplay(d) {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function fmtMonthYear(d) {
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function isBetween(d, from, to) {
  return d >= startOfDay(from) && d <= endOfDay(to);
}

function getMonthDays(year, month) {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const days = [];
  const startDay = first.getDay();
  for (let i = 0; i < startDay; i++) days.push(null);
  for (let d = 1; d <= last.getDate(); d++) days.push(new Date(year, month, d));
  return days;
}

function startOfWeek(d) {
  const n = new Date(d);
  n.setDate(n.getDate() - n.getDay());
  n.setHours(0, 0, 0, 0);
  return n;
}

function startOfMonth(d) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function endOfMonth(d) { return new Date(d.getFullYear(), d.getMonth() + 1, 0); }

// ─── Preset definitions ─────────────────────────────────────

function getPresetRange(key) {
  const today = startOfDay(new Date());
  const yesterday = addDays(today, -1);
  switch (key) {
    case "today": return { from: today, to: endOfDay(today), label: "Today" };
    case "yesterday": return { from: yesterday, to: endOfDay(yesterday), label: "Yesterday" };
    case "prev_week": {
      const end = addDays(startOfWeek(today), -1);
      const start = addDays(end, -6);
      return { from: start, to: endOfDay(end), label: "Previous week" };
    }
    case "prev_7": return { from: addDays(today, -7), to: endOfDay(yesterday), label: "Previous 7 days" };
    case "prev_30": return { from: addDays(today, -30), to: endOfDay(yesterday), label: "Previous 30 days" };
    case "prev_month": {
      const start = startOfMonth(addMonths(today, -1));
      return { from: start, to: endOfDay(endOfMonth(start)), label: "Previous month" };
    }
    case "prev_3mo": return { from: addDays(today, -90), to: endOfDay(yesterday), label: "Previous 3 months" };
    case "prev_12mo": return { from: addDays(today, -365), to: endOfDay(yesterday), label: "Previous 12 months" };
    default: return { from: addDays(today, -30), to: endOfDay(yesterday), label: "Previous 30 days" };
  }
}

const PRESETS = [
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "prev_week", label: "Previous week" },
  { key: "prev_7", label: "Previous 7 days" },
  { key: "prev_30", label: "Previous 30 days" },
];

const PRESETS_2 = [
  { key: "prev_month", label: "Previous month" },
  { key: "prev_3mo", label: "Previous 3 months" },
  { key: "prev_12mo", label: "Previous 12 months" },
];

const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DAY_HEADERS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

const UNIT_OPTIONS = ["days", "weeks", "months"];

// ─── Styles ──────────────────────────────────────────────────

const ds = {
  trigger: {
    display: "inline-flex", alignItems: "center", gap: "8px", padding: "8px 14px",
    background: "#fff", border: "1px solid #d1d5db", borderRadius: "8px",
    fontSize: "13px", fontWeight: "500", color: "#374151", cursor: "pointer",
    transition: "border-color 0.15s, box-shadow 0.15s",
  },
  triggerIcon: { width: "16px", height: "16px", color: "#6b7280", flexShrink: 0 },
  panel: {
    position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 50,
    background: "#fff", borderRadius: "12px", border: "1px solid #e5e7eb",
    boxShadow: "0 12px 40px rgba(0,0,0,0.12)", minWidth: "260px", overflow: "hidden",
  },
  widePanel: { minWidth: "580px" },
  option: {
    display: "block", width: "100%", padding: "10px 20px", fontSize: "14px",
    color: "#374151", background: "none", border: "none", cursor: "pointer",
    textAlign: "left", transition: "background 0.1s",
  },
  optionHover: { background: "#f3f4f6" },
  divider: { height: "1px", background: "#e5e7eb", margin: "4px 0" },
  subHeader: {
    display: "flex", alignItems: "center", gap: "10px", padding: "12px 16px",
    borderBottom: "1px solid #e5e7eb", fontSize: "14px", fontWeight: "500", color: "#111827",
  },
  backBtn: {
    background: "none", border: "none", cursor: "pointer", padding: "4px",
    fontSize: "18px", color: "#374151", lineHeight: 1, display: "flex", alignItems: "center",
  },
  tabRow: {
    display: "flex", borderBottom: "2px solid #e5e7eb",
  },
  tab: {
    padding: "10px 16px", fontSize: "13px", fontWeight: "500", color: "#9ca3af",
    background: "none", border: "none", borderBottom: "2px solid transparent",
    marginBottom: "-2px", cursor: "pointer", transition: "all 0.15s",
  },
  tabActive: { color: "#111827", borderBottomColor: "#111827" },
  calendarGrid: {
    display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "0",
    textAlign: "center", fontSize: "13px",
  },
  calHeader: { padding: "8px 0", fontSize: "11px", fontWeight: "600", color: "#9ca3af" },
  calDay: {
    padding: "7px 0", cursor: "pointer", borderRadius: "6px",
    transition: "background 0.1s", color: "#374151",
  },
  calDaySelected: { background: "#111827", color: "#fff", fontWeight: "600" },
  calDayInRange: { background: "#e0e7ff", color: "#3730a3" },
  calDayToday: { fontWeight: "700", color: "#111827" },
  calDayDisabled: { color: "#d1d5db", cursor: "default" },
  dateInput: {
    padding: "8px 12px", fontSize: "13px", border: "1px solid #d1d5db",
    borderRadius: "6px", width: "100%", outline: "none", boxSizing: "border-box",
    color: "#374151",
  },
  addFilterBtn: {
    padding: "8px 20px", fontSize: "13px", fontWeight: "600",
    background: "#111827", color: "#fff", border: "none", borderRadius: "8px",
    cursor: "pointer", transition: "background 0.15s",
  },
  checkRow: {
    display: "flex", alignItems: "center", gap: "10px", padding: "10px 20px",
    fontSize: "14px", color: "#374151", cursor: "pointer",
  },
  checkbox: {
    width: "18px", height: "18px", accentColor: "#111827", cursor: "pointer",
  },
  toggleTrack: {
    width: "40px", height: "22px", borderRadius: "11px", cursor: "pointer",
    transition: "background 0.2s", position: "relative", flexShrink: 0,
  },
  toggleThumb: {
    width: "18px", height: "18px", borderRadius: "50%", background: "#fff",
    position: "absolute", top: "2px", transition: "left 0.2s",
    boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
  },
  relInput: {
    width: "60px", padding: "8px 10px", fontSize: "14px", border: "1px solid #d1d5db",
    borderRadius: "6px", textAlign: "center", outline: "none",
  },
  relSelect: {
    padding: "8px 12px", fontSize: "14px", border: "1px solid #d1d5db",
    borderRadius: "6px", outline: "none", color: "#374151", background: "#fff",
    cursor: "pointer",
  },
  datePreview: {
    display: "flex", alignItems: "center", gap: "8px", padding: "12px 20px",
    fontSize: "13px", color: "#6b7280",
  },
};

// ─── Calendar Component ──────────────────────────────────────

function Calendar({ month, year, selected, rangeStart, rangeEnd, onSelect, onMonthChange }) {
  const days = getMonthDays(year, month);
  const today = startOfDay(new Date());

  return (
    <div style={{ flex: 1, minWidth: "240px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 4px", marginBottom: "8px" }}>
        <button type="button" style={ds.backBtn} onClick={() => onMonthChange(-1)}>‹</button>
        <span style={{ fontSize: "13px", fontWeight: "600", color: "#111827" }}>
          {fmtMonthYear(new Date(year, month))}
        </span>
        <button type="button" style={ds.backBtn} onClick={() => onMonthChange(1)}>›</button>
      </div>
      <div style={ds.calendarGrid}>
        {DAY_HEADERS.map((h) => <div key={h} style={ds.calHeader}>{h}</div>)}
        {days.map((d, i) => {
          if (!d) return <div key={`e-${i}`} />;
          const isSelected = selected && isSameDay(d, selected);
          const isRangeStart = rangeStart && isSameDay(d, rangeStart);
          const isRangeEnd = rangeEnd && isSameDay(d, rangeEnd);
          const inRange = rangeStart && rangeEnd && isBetween(d, rangeStart, rangeEnd) && !isRangeStart && !isRangeEnd;
          const isToday = isSameDay(d, today);
          return (
            <div
              key={d.toISOString()}
              style={{
                ...ds.calDay,
                ...(isSelected || isRangeStart || isRangeEnd ? ds.calDaySelected : {}),
                ...(inRange ? ds.calDayInRange : {}),
                ...(!isSelected && !isRangeStart && !isRangeEnd && !inRange && isToday ? ds.calDayToday : {}),
              }}
              onClick={() => onSelect(d)}
            >
              {d.getDate()}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────

export default function DateRangeFilter({ onApply, activeLabel = "Date Range" }) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState("main"); // main | fixed | relative | exclude | exclude_days | exclude_months
  const ref = useRef(null);

  // Fixed date range state
  const [fixedTab, setFixedTab] = useState("between"); // between | before | on | after
  const [fixedFrom, setFixedFrom] = useState(null);
  const [fixedTo, setFixedTo] = useState(null);
  const [calMonth1, setCalMonth1] = useState(() => new Date().getMonth());
  const [calYear1, setCalYear1] = useState(() => new Date().getFullYear());
  const [calMonth2, setCalMonth2] = useState(() => {
    const n = addMonths(new Date(), 1);
    return n.getMonth();
  });
  const [calYear2, setCalYear2] = useState(() => {
    const n = addMonths(new Date(), 1);
    return n.getFullYear();
  });

  // Relative date range state
  const [relTab, setRelTab] = useState("previous");
  const [relAmount, setRelAmount] = useState(30);
  const [relUnit, setRelUnit] = useState("days");
  const [relIncludeToday, setRelIncludeToday] = useState(false);

  // Exclude state
  const [excludeDays, setExcludeDays] = useState([]);
  const [excludeMonths, setExcludeMonths] = useState([]);

  // Click outside
  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
        setView("main");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const syncCal2 = useCallback(() => {
    const next = addMonths(new Date(calYear1, calMonth1), 1);
    setCalMonth2(next.getMonth());
    setCalYear2(next.getFullYear());
  }, [calMonth1, calYear1]);

  useEffect(syncCal2, [syncCal2]);

  // ── Preset click ──
  const handlePreset = (key) => {
    const r = getPresetRange(key);
    onApply({ from: r.from, to: r.to, excludeDays: [], excludeMonths: [], label: r.label });
    setOpen(false);
    setView("main");
  };

  // ── Fixed date apply ──
  const handleFixedApply = () => {
    let from, to, label;
    const today = startOfDay(new Date());
    switch (fixedTab) {
      case "between":
        if (!fixedFrom || !fixedTo) return;
        from = startOfDay(fixedFrom);
        to = endOfDay(fixedTo);
        label = `${fmtDisplay(from)} – ${fmtDisplay(to)}`;
        break;
      case "before":
        if (!fixedFrom) return;
        from = new Date(2000, 0, 1);
        to = endOfDay(addDays(fixedFrom, -1));
        label = `Before ${fmtDisplay(fixedFrom)}`;
        break;
      case "on":
        if (!fixedFrom) return;
        from = startOfDay(fixedFrom);
        to = endOfDay(fixedFrom);
        label = `On ${fmtDisplay(fixedFrom)}`;
        break;
      case "after":
        if (!fixedFrom) return;
        from = startOfDay(addDays(fixedFrom, 1));
        to = endOfDay(today);
        label = `After ${fmtDisplay(fixedFrom)}`;
        break;
    }
    onApply({ from, to, excludeDays, excludeMonths, label });
    setOpen(false);
    setView("main");
  };

  // Calendar day click for fixed range
  const handleCalSelect = (d) => {
    if (fixedTab === "between") {
      if (!fixedFrom || (fixedFrom && fixedTo)) {
        setFixedFrom(d);
        setFixedTo(null);
      } else {
        if (d < fixedFrom) { setFixedTo(fixedFrom); setFixedFrom(d); }
        else setFixedTo(d);
      }
    } else {
      setFixedFrom(d);
    }
  };

  // ── Relative date compute ──
  const computeRelRange = () => {
    const today = startOfDay(new Date());
    let from, to;
    const amt = Math.max(1, relAmount || 1);
    if (relTab === "previous") {
      to = relIncludeToday ? endOfDay(today) : endOfDay(addDays(today, -1));
      if (relUnit === "days") from = addDays(relIncludeToday ? today : addDays(today, -1), -(amt - 1));
      else if (relUnit === "weeks") from = addDays(relIncludeToday ? today : addDays(today, -1), -(amt * 7 - 1));
      else from = addMonths(relIncludeToday ? today : addDays(today, -1), -amt);
    } else if (relTab === "current") {
      if (relUnit === "days") { from = today; to = endOfDay(today); }
      else if (relUnit === "weeks") { from = startOfWeek(today); to = endOfDay(addDays(startOfWeek(today), 6)); }
      else { from = startOfMonth(today); to = endOfDay(endOfMonth(today)); }
    } else {
      from = addDays(today, 1);
      if (relUnit === "days") to = endOfDay(addDays(today, amt));
      else if (relUnit === "weeks") to = endOfDay(addDays(today, amt * 7));
      else to = endOfDay(addMonths(today, amt));
    }
    return { from: startOfDay(from), to };
  };

  const relRange = computeRelRange();
  const relPreview = `${fmtDisplay(relRange.from)} – ${fmtDisplay(relRange.to)}`;

  const handleRelApply = () => {
    const r = computeRelRange();
    const label = `${relTab === "previous" ? "Prev" : relTab === "current" ? "Current" : "Next"} ${relAmount} ${relUnit}`;
    onApply({ from: r.from, to: r.to, excludeDays, excludeMonths, label });
    setOpen(false);
    setView("main");
  };

  // ── Exclude toggles ──
  const toggleDay = (idx) => setExcludeDays((p) => p.includes(idx) ? p.filter((d) => d !== idx) : [...p, idx]);
  const toggleMonth = (idx) => setExcludeMonths((p) => p.includes(idx) ? p.filter((m) => m !== idx) : [...p, idx]);
  const toggleAllDays = () => setExcludeDays((p) => p.length === 7 ? [] : [0, 1, 2, 3, 4, 5, 6]);
  const toggleAllMonths = () => setExcludeMonths((p) => p.length === 12 ? [] : [...Array(12).keys()]);

  const handleExcludeApply = () => {
    setView("main");
  };

  const calMonthChange1 = (delta) => {
    const next = addMonths(new Date(calYear1, calMonth1), delta);
    setCalMonth1(next.getMonth());
    setCalYear1(next.getFullYear());
  };

  const calMonthChange2 = (delta) => {
    const next = addMonths(new Date(calYear2, calMonth2), delta);
    setCalMonth2(next.getMonth());
    setCalYear2(next.getFullYear());
  };

  // Build the active label with exclude info
  let displayLabel = activeLabel;
  if (excludeDays.length > 0 || excludeMonths.length > 0) {
    const parts = [];
    if (excludeDays.length > 0) parts.push(`excl. ${excludeDays.length} day${excludeDays.length > 1 ? "s" : ""}`);
    if (excludeMonths.length > 0) parts.push(`excl. ${excludeMonths.length} mo.`);
    displayLabel = `${activeLabel} (${parts.join(", ")})`;
  }

  return (
    <div style={{ position: "relative", display: "inline-block" }} ref={ref}>
      {/* Trigger button */}
      <button
        type="button"
        style={ds.trigger}
        onClick={() => { setOpen((o) => !o); setView("main"); }}
        onMouseOver={(e) => { e.currentTarget.style.borderColor = "#9ca3af"; e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.06)"; }}
        onMouseOut={(e) => { e.currentTarget.style.borderColor = "#d1d5db"; e.currentTarget.style.boxShadow = "none"; }}
      >
        <svg style={ds.triggerIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
        {displayLabel}
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ color: "#9ca3af" }}>
          <path d="M2.5 3.75L5 6.25L7.5 3.75" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {!open ? null : view === "main" ? (
        /* ── Main preset list ── */
        <div style={ds.panel}>
          {PRESETS.map((p) => (
            <Option key={p.key} label={p.label} onClick={() => handlePreset(p.key)} />
          ))}
          <div style={ds.divider} />
          {PRESETS_2.map((p) => (
            <Option key={p.key} label={p.label} onClick={() => handlePreset(p.key)} />
          ))}
          <div style={ds.divider} />
          <Option label="Fixed date range..." onClick={() => { setView("fixed"); setFixedFrom(null); setFixedTo(null); }} />
          <Option label="Relative date range..." onClick={() => setView("relative")} />
          <Option label="Exclude..." onClick={() => setView("exclude")} />
        </div>
      ) : view === "fixed" ? (
        /* ── Fixed date range panel ── */
        <div style={{ ...ds.panel, ...ds.widePanel }}>
          <div style={ds.subHeader}>
            <button type="button" style={ds.backBtn} onClick={() => setView("main")}>‹</button>
            <div style={ds.tabRow}>
              {["between", "before", "on", "after"].map((t) => (
                <button
                  key={t}
                  type="button"
                  style={{ ...ds.tab, ...(fixedTab === t ? ds.tabActive : {}) }}
                  onClick={() => { setFixedTab(t); setFixedFrom(null); setFixedTo(null); }}
                >
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div style={{ padding: "16px 20px" }}>
            {fixedTab === "between" ? (
              <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
                <input style={ds.dateInput} readOnly value={fixedFrom ? fmtDisplay(fixedFrom) : ""} placeholder="Start date" />
                <span style={{ color: "#9ca3af", fontSize: "13px", flexShrink: 0 }}>and</span>
                <input style={ds.dateInput} readOnly value={fixedTo ? fmtDisplay(fixedTo) : ""} placeholder="End date" />
              </div>
            ) : (
              <div style={{ marginBottom: "16px" }}>
                <input style={ds.dateInput} readOnly value={fixedFrom ? fmtDisplay(fixedFrom) : ""} placeholder="Select a date" />
              </div>
            )}

            <div style={{ display: "flex", gap: "24px", marginBottom: "16px" }}>
              <Calendar
                month={calMonth1} year={calYear1}
                selected={fixedTab !== "between" ? fixedFrom : null}
                rangeStart={fixedTab === "between" ? fixedFrom : null}
                rangeEnd={fixedTab === "between" ? fixedTo : null}
                onSelect={handleCalSelect}
                onMonthChange={calMonthChange1}
              />
              {fixedTab === "between" && (
                <Calendar
                  month={calMonth2} year={calYear2}
                  selected={null}
                  rangeStart={fixedFrom}
                  rangeEnd={fixedTo}
                  onSelect={handleCalSelect}
                  onMonthChange={calMonthChange2}
                />
              )}
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button
                type="button"
                style={{ ...ds.addFilterBtn, opacity: fixedTab === "between" ? (fixedFrom && fixedTo ? 1 : 0.4) : (fixedFrom ? 1 : 0.4) }}
                disabled={fixedTab === "between" ? !fixedFrom || !fixedTo : !fixedFrom}
                onClick={handleFixedApply}
              >
                Add filter
              </button>
            </div>
          </div>
        </div>
      ) : view === "relative" ? (
        /* ── Relative date range panel ── */
        <div style={{ ...ds.panel, minWidth: "340px" }}>
          <div style={ds.subHeader}>
            <button type="button" style={ds.backBtn} onClick={() => setView("main")}>‹</button>
            <div style={ds.tabRow}>
              {["previous", "current", "next"].map((t) => (
                <button
                  key={t}
                  type="button"
                  style={{ ...ds.tab, ...(relTab === t ? ds.tabActive : {}) }}
                  onClick={() => setRelTab(t)}
                >
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div style={{ padding: "16px 20px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
              <input
                type="number"
                min="1"
                style={ds.relInput}
                value={relAmount}
                onChange={(e) => setRelAmount(parseInt(e.target.value) || 1)}
              />
              <select style={ds.relSelect} value={relUnit} onChange={(e) => setRelUnit(e.target.value)}>
                {UNIT_OPTIONS.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>

            {relTab === "previous" && (
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
                <div
                  style={{ ...ds.toggleTrack, background: relIncludeToday ? "#111827" : "#d1d5db" }}
                  onClick={() => setRelIncludeToday((v) => !v)}
                >
                  <div style={{ ...ds.toggleThumb, left: relIncludeToday ? "20px" : "2px" }} />
                </div>
                <span style={{ fontSize: "14px", color: "#374151" }}>Include today</span>
              </div>
            )}

            <div style={ds.datePreview}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
              {relPreview}
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button type="button" style={ds.addFilterBtn} onClick={handleRelApply}>
                Add filter
              </button>
            </div>
          </div>
        </div>
      ) : view === "exclude" ? (
        /* ── Exclude submenu ── */
        <div style={ds.panel}>
          <div style={ds.subHeader}>
            <button type="button" style={ds.backBtn} onClick={() => setView("main")}>‹</button>
            Exclude...
          </div>
          <Option label="Days of the week..." onClick={() => setView("exclude_days")} />
          <Option label="Months of the year..." onClick={() => setView("exclude_months")} />
        </div>
      ) : view === "exclude_days" ? (
        /* ── Exclude days ── */
        <div style={{ ...ds.panel, minWidth: "280px" }}>
          <div style={ds.subHeader}>
            <button type="button" style={ds.backBtn} onClick={() => setView("exclude")}>‹</button>
            Days of the week...
          </div>
          <label style={ds.checkRow}>
            <input type="checkbox" style={ds.checkbox} checked={excludeDays.length === 7} onChange={toggleAllDays} />
            Select all
          </label>
          <div style={ds.divider} />
          {DAY_NAMES.map((d, i) => (
            <label key={d} style={ds.checkRow}>
              <input type="checkbox" style={ds.checkbox} checked={excludeDays.includes(i)} onChange={() => toggleDay(i)} />
              {d}
            </label>
          ))}
          <div style={{ padding: "12px 20px", display: "flex", justifyContent: "flex-end" }}>
            <button
              type="button"
              style={{ ...ds.addFilterBtn, opacity: excludeDays.length > 0 ? 1 : 0.4 }}
              onClick={handleExcludeApply}
            >
              Add filter
            </button>
          </div>
        </div>
      ) : view === "exclude_months" ? (
        /* ── Exclude months ── */
        <div style={{ ...ds.panel, minWidth: "340px" }}>
          <div style={ds.subHeader}>
            <button type="button" style={ds.backBtn} onClick={() => setView("exclude")}>‹</button>
            Months of the year...
          </div>
          <label style={ds.checkRow}>
            <input type="checkbox" style={ds.checkbox} checked={excludeMonths.length === 12} onChange={toggleAllMonths} />
            Select all
          </label>
          <div style={ds.divider} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", padding: "0 8px" }}>
            {MONTH_NAMES.map((m, i) => (
              <label key={m} style={{ ...ds.checkRow, padding: "10px 12px" }}>
                <input type="checkbox" style={ds.checkbox} checked={excludeMonths.includes(i)} onChange={() => toggleMonth(i)} />
                {m}
              </label>
            ))}
          </div>
          <div style={{ padding: "12px 20px", display: "flex", justifyContent: "flex-end" }}>
            <button
              type="button"
              style={{ ...ds.addFilterBtn, opacity: excludeMonths.length > 0 ? 1 : 0.4 }}
              onClick={handleExcludeApply}
            >
              Add filter
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Option({ label, onClick }) {
  return (
    <button
      type="button"
      style={ds.option}
      onClick={onClick}
      onMouseOver={(e) => (e.currentTarget.style.background = "#f3f4f6")}
      onMouseOut={(e) => (e.currentTarget.style.background = "none")}
    >
      {label}
    </button>
  );
}
