import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { HabitEvent } from "../lib/api";
import { nowInLocal } from "../lib/date";

type DayData = {
  date: string;
  action: "done" | "push" | "skip" | "overdue" | null;
};

const COLORS: Record<string, string> = {
  done: "#a5d6a7",
  push: "#c5e1a5",
  skip: "#e1bee7",
  overdue: "#fce4ec",
  null: "#f3ecf9",
};

const BORDER_COLORS: Record<string, string> = {
  overdue: "#f8bbd0",
};

function toYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function parseDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export default function Heatmap(props: {
  events: HabitEvent[];
  nextDueDate: string;
  onMonthClick?: (year: number, month: number) => void;
}) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const scrollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollState = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 1);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 1);
  }, []);

  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollLeft = scrollContainerRef.current.scrollWidth;
      updateScrollState();
    }
  }, [updateScrollState]);

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    el.addEventListener("scroll", updateScrollState, { passive: true });
    return () => el.removeEventListener("scroll", updateScrollState);
  }, [updateScrollState]);

  const stopScroll = useCallback(() => {
    if (scrollIntervalRef.current) {
      clearInterval(scrollIntervalRef.current);
      scrollIntervalRef.current = null;
    }
  }, []);

  const startScroll = useCallback(
    (direction: "left" | "right") => {
      stopScroll();
      const el = scrollContainerRef.current;
      if (!el) return;
      const step = direction === "left" ? -8 : 8;
      scrollIntervalRef.current = setInterval(() => {
        el.scrollBy({ left: step });
      }, 16);
    },
    [stopScroll]
  );

  const weeks = useMemo(() => {
    const now = nowInLocal();
    const endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - 364);

    const dayMap = new Map<string, DayData>();

    for (const e of props.events) {
      const existing = dayMap.get(e.actionDate);
      const priority = (a: string) => {
        if (a === "overdue") return 4;
        if (a === "done") return 3;
        if (a === "push") return 2;
        if (a === "skip") return 1;
        return 0;
      };
      const newAction = e.action as DayData["action"];
      if (!existing || (newAction && priority(newAction) > priority(existing.action || ""))) {
        dayMap.set(e.actionDate, { date: e.actionDate, action: newAction });
      }
    }

    const dueDate = parseDate(props.nextDueDate);
    if (dueDate <= endDate && dueDate >= startDate) {
      const ds = toYmd(dueDate);
      if (!dayMap.has(ds)) {
        dayMap.set(ds, { date: ds, action: "overdue" });
      }
    }

    const allDays: (DayData | null)[] = [];
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const ds = toYmd(d);
      allDays.push(dayMap.get(ds) || { date: ds, action: null });
    }

    const startDow = startDate.getDay();
    const padded: (DayData | null)[] = [];
    for (let i = 0; i < (startDow === 0 ? 6 : startDow - 1); i++) padded.push(null);
    padded.push(...allDays);
    while (padded.length % 7 !== 0) padded.push(null);

    const result: (DayData | null)[][] = [];
    for (let i = 0; i < padded.length; i += 7) result.push(padded.slice(i, i + 7));

    return result;
  }, [props.events, props.nextDueDate]);

  const monthLabels = useMemo(() => {
    if (!weeks.length) return [];
    const labels: { index: number; label: string }[] = [];
    const monthNames = [
      "1月",
      "2月",
      "3月",
      "4月",
      "5月",
      "6月",
      "7月",
      "8月",
      "9月",
      "10月",
      "11月",
      "12月",
    ];
    let lastMonth = -1;
    for (let w = 0; w < weeks.length; w++) {
      const day = weeks[w]?.find((d) => d !== null);
      if (day) {
        const m = parseDate(day.date).getMonth();
        if (m !== lastMonth) {
          labels.push({ index: w, label: monthNames[m]! });
          lastMonth = m;
        }
      }
    }
    return labels;
  }, [weeks]);

  function handleClick(d: DayData | null) {
    if (!d || !props.onMonthClick) return;
    const date = parseDate(d.date);
    props.onMonthClick(date.getFullYear(), date.getMonth());
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2 gap-2">
        <div className="text-[14px] sm:text-[13px] font-semibold text-ink shrink-0">打卡热力图</div>
        <div className="flex items-center gap-2 text-[12px] sm:text-[11px] text-muted-light">
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-sm" style={{ background: "#f3ecf9" }} />
            无记录
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-sm" style={{ background: "#e1bee7" }} />
            跳过
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-sm" style={{ background: "#c5e1a5" }} />
            推迟
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-sm" style={{ background: "#a5d6a7" }} />
            打卡
          </span>
          <span className="flex items-center gap-1">
            <span
              className="inline-block h-2 w-2 rounded-sm border"
              style={{ background: "#fce4ec", borderColor: "#f8bbd0" }}
            />
            逾期
          </span>
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        <button
          type="button"
          className={`shrink-0 flex items-center justify-center w-5 h-10 rounded-md border text-ink/60 hover:text-ink/90 transition-all select-none ${
            canScrollLeft
              ? "bg-white/80 hover:bg-white shadow-sm border-transparent opacity-100"
              : "opacity-0 pointer-events-none border-transparent"
          }`}
          onPointerDown={() => startScroll("left")}
          onPointerUp={stopScroll}
          onPointerLeave={stopScroll}
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path
              d="M7 1L3 5L7 9"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        <div
          ref={scrollContainerRef}
          className="overflow-x-auto pb-1.5 flex-1 min-w-0"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          <div className="inline-flex gap-[3px]" style={{ minWidth: "max-content" }}>
            {weeks.map((week, wi) => (
              <div key={wi} className="flex flex-col gap-[3px] items-center">
                <div className="h-3 leading-3 text-[11px] sm:text-[9px] text-muted-light">
                  {monthLabels.find((l) => l.index === wi)?.label || ""}
                </div>
                {week.map((day, di) => (
                  <div
                    key={di}
                    className="h-3 w-3 rounded-sm cursor-pointer transition-opacity hover:opacity-80"
                    style={{
                      background: day ? COLORS[day.action || "null"] || "#f3f4f6" : "transparent",
                      border:
                        day && BORDER_COLORS[day.action || ""]
                          ? `1px solid ${BORDER_COLORS[day.action || ""]}`
                          : undefined,
                    }}
                    title={day ? `${day.date} ${day.action || "无记录"}` : ""}
                    onClick={() => handleClick(day)}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
        <button
          type="button"
          className={`shrink-0 flex items-center justify-center w-5 h-10 rounded-md border text-ink/60 hover:text-ink/90 transition-all select-none ${
            canScrollRight
              ? "bg-white/80 hover:bg-white shadow-sm border-transparent opacity-100"
              : "opacity-0 pointer-events-none border-transparent"
          }`}
          onPointerDown={() => startScroll("right")}
          onPointerUp={stopScroll}
          onPointerLeave={stopScroll}
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path
              d="M3 1L7 5L3 9"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}
