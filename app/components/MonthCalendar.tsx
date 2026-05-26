import { useMemo } from "react";

import type { HabitEvent } from "../lib/api";
import { nowInLocal } from "../lib/date";

type CellStatus = "done" | "push" | "skip" | "overdue" | "future" | "empty" | "nextDue";

const CELL_STYLES: Record<CellStatus, { bg: string; text: string; border?: string }> = {
  done: { bg: "#a5d6a7", text: "#ffffff" },
  push: { bg: "#c5e1a5", text: "#ffffff" },
  skip: { bg: "#e1bee7", text: "#7b1fa2" },
  overdue: { bg: "#fce4ec", text: "#e91e63", border: "#f8bbd0" },
  future: { bg: "transparent", text: "#d1c4e9" },
  empty: { bg: "transparent", text: "#d1c4e9" },
  nextDue: { bg: "#f5f5f5", text: "#7e57c2", border: "#b39ddb" },
};

function toYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

const WEEKDAYS = ["一", "二", "三", "四", "五", "六", "日"];
const MONTH_NAMES = [
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

export default function MonthCalendar(props: {
  events: HabitEvent[];
  nextDueDate: string;
  startDate?: string;
  year: number;
  month: number;
  onPrev: () => void;
  onNext: () => void;
  onReset?: () => void;
  onDateClick?: (date: string, event?: HabitEvent) => void;
}) {
  const todayStr = toYmd(nowInLocal());

  // 判断当前月份是否可以往前翻
  const canGoPrev =
    !props.startDate ||
    props.year > Number(props.startDate.slice(0, 4)) ||
    (props.year === Number(props.startDate.slice(0, 4)) &&
      props.month > Number(props.startDate.slice(5, 7)) - 1);

  const cells = useMemo(() => {
    const firstDay = new Date(props.year, props.month, 1);
    const lastDay = new Date(props.year, props.month + 1, 0);
    const daysInMonth = lastDay.getDate();

    let startDow = firstDay.getDay() - 1;
    if (startDow < 0) startDow = 6;

    const eventMap = new Map<string, HabitEvent>();
    for (const e of props.events) {
      const existing = eventMap.get(e.actionDate);
      const priority = (a: string) => (a === "done" ? 3 : a === "push" ? 2 : a === "skip" ? 1 : 0);
      if (!existing || priority(e.action) > priority(existing.action)) {
        eventMap.set(e.actionDate, e);
      }
    }

    const result: {
      day: number;
      date: string;
      status: CellStatus;
      event?: HabitEvent;
    }[] = [];

    for (let i = 0; i < startDow; i++) {
      result.push({ day: 0, date: "", status: "empty" });
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const date = toYmd(new Date(props.year, props.month, d));
      const isFuture = new Date(props.year, props.month, d) > nowInLocal();
      const beforeStart = props.startDate ? date < props.startDate : false;

      if (isFuture) {
        if (date === props.nextDueDate) {
          result.push({ day: d, date, status: "nextDue" });
        } else {
          result.push({ day: d, date, status: "future" });
        }
      } else if (beforeStart) {
        result.push({ day: d, date, status: "future" });
      } else {
        const evt = eventMap.get(date);
        const isOverdue = date === props.nextDueDate && !evt;

        if (evt) {
          result.push({
            day: d,
            date,
            status: evt.action as CellStatus,
            event: evt,
          });
        } else if (isOverdue) {
          result.push({ day: d, date, status: "overdue" });
        } else {
          result.push({ day: d, date, status: "empty" });
        }
      }
    }

    while (result.length % 7 !== 0) result.push({ day: 0, date: "", status: "empty" });
    return result;
  }, [props.events, props.nextDueDate, props.year, props.month, props.startDate]);

  const doneCount = cells.filter((c) => c.status === "done" || c.status === "push").length;
  const totalDue = cells.filter(
    (c) => c.status !== "empty" && c.status !== "future" && c.day > 0
  ).length;

  function handleClick(cell: {
    day: number;
    date: string;
    status: CellStatus;
    event?: HabitEvent;
  }) {
    if (!props.onDateClick) return;
    if (cell.status === "future") return;
    if (cell.day === 0) return;
    props.onDateClick(cell.date, cell.event);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="btn text-[13px] sm:text-[11px] px-1.5 py-0.5"
            onClick={props.onPrev}
            disabled={!canGoPrev}
          >
            ←
          </button>
          <span className="text-[14px] sm:text-[13px] font-semibold text-ink">
            {props.year} 年 {MONTH_NAMES[props.month]}
          </span>
          <button
            type="button"
            className="btn text-[13px] sm:text-[11px] px-1.5 py-0.5"
            onClick={props.onNext}
          >
            →
          </button>
        </div>
        <button
          type="button"
          className="text-[12px] sm:text-[10px] font-medium px-1.5 py-0.5 rounded border border-[#43a047]/20 bg-[#43a047]/5 hover:bg-[#43a047]/10 active:opacity-70 transition-all"
          style={{ color: "#43a047" }}
          onClick={props.onReset}
        >
          本月打卡 {doneCount}/{totalDue} 天
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center">
        {WEEKDAYS.map((w) => (
          <div key={w} className="text-[12px] sm:text-[11px] font-semibold text-muted-light py-1">
            {w}
          </div>
        ))}
        {cells.map((cell, i) => {
          if (cell.day === 0) return <div key={i} className="h-7 sm:h-6" />;
          const style = CELL_STYLES[cell.status];
          const isToday = cell.date === todayStr;
          const isClickable = cell.status !== "future" && props.onDateClick;
          return (
            <div
              key={i}
              className={`h-7 sm:h-6 flex items-center justify-center rounded-md text-[13px] sm:text-[12px] font-semibold transition${isClickable ? " cursor-pointer hover:opacity-70" : ""}`}
              style={{
                background: style.bg,
                color: isToday ? "#7e57c2" : style.text,
                border: style.border ? `1px solid ${style.border}` : undefined,
                fontWeight: isToday ? "800" : undefined,
              }}
              title={
                cell.status === "done"
                  ? "已打卡"
                  : cell.status === "push"
                    ? "推迟后打卡"
                    : cell.status === "skip"
                      ? "已跳过"
                      : cell.status === "overdue"
                        ? "逾期"
                        : cell.status === "nextDue"
                          ? "下次到期日"
                          : cell.date
              }
              onClick={() => handleClick(cell)}
            >
              {cell.day}
            </div>
          );
        })}
      </div>

      <div className="mt-1.5 flex flex-wrap gap-2 text-[12px] sm:text-[10px] text-muted-light">
        <span className="flex items-center gap-0.5">
          <span className="inline-block h-1.5 w-1.5 rounded-sm" style={{ background: "#a5d6a7" }} />{" "}
          按时打卡
        </span>
        <span className="flex items-center gap-0.5">
          <span className="inline-block h-1.5 w-1.5 rounded-sm" style={{ background: "#c5e1a5" }} />{" "}
          推迟后打卡
        </span>
        <span className="flex items-center gap-0.5">
          <span className="inline-block h-1.5 w-1.5 rounded-sm" style={{ background: "#e1bee7" }} />{" "}
          跳过
        </span>
        <span className="flex items-center gap-0.5">
          <span
            className="inline-block h-1.5 w-1.5 rounded-sm border"
            style={{ background: "#fce4ec", borderColor: "#f8bbd0" }}
          />{" "}
          逾期
        </span>
        <span className="flex items-center gap-0.5">
          <span
            className="inline-block h-1.5 w-1.5 rounded-sm border"
            style={{ background: "#f5f5f5", borderColor: "#b39ddb" }}
          />{" "}
          下次到期
        </span>
      </div>
    </div>
  );
}
