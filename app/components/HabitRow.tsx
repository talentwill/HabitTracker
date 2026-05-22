import clsx from "clsx";
import { Link } from "react-router";

import type { Habit } from "../lib/api";
import { diffDays, statusForDue } from "../lib/date";
import { getFirstTextChar } from "../lib/utils";
import { tagColor } from "./TagInput";

export default function HabitRow(props: {
  habit: Habit;
  today: string;
  busy?: boolean;
  onDone: () => void;
  onPush: () => void;
  onSkip: () => void;
  onEdit: () => void;
  variant?: "default" | "archived";
}) {
  const h = props.habit;
  const status = statusForDue(h.nextDueDate, props.today);
  const disabled = props.busy || h.archived;
  const isArchived = props.variant === "archived";
  const overdueDays = status === "overdue" ? diffDays(h.nextDueDate, props.today) : 0;

  const statusPill = (() => {
    if (isArchived) return null;
    if (status === "overdue")
      return (
        <span
          className="inline-flex items-center rounded-full px-2 py-0.5 text-[13px] font-semibold"
          style={{ background: "#fce4ec", color: "#e91e63" }}
        >
          逾期{overdueDays}天
        </span>
      );
    if (status === "today")
      return (
        <span
          className="inline-flex items-center rounded-full px-2 py-0.5 text-[13px] font-semibold"
          style={{ background: "#fff3e0", color: "#f57c00" }}
        >
          今天
        </span>
      );
    if (status === "upcoming") {
      const days = diffDays(props.today, h.nextDueDate);
      return <span className="pill">{days}天后</span>;
    }
    return null;
  })();

  const circleCls = (() => {
    if (status === "overdue") return "border-[2px]";
    if (status === "today") return "border-[2px] border-[#ffb74d]";
    return "border-[2px] border-[#d1c4e9]";
  })();

  const circleStyle = status === "overdue" ? { borderColor: "#f48fb1" } : undefined;

  const doneToday = h.lastDoneDate === props.today;

  return (
    <>
      <Link
        to={`/habits/${h.id}`}
        className="paper sm:hidden flex items-center gap-2 px-3 py-3 active:bg-warm-white transition-colors"
      >
        <div
          className={clsx(
            "h-4 w-4 shrink-0 rounded-full",
            doneToday ? "flex items-center justify-center" : circleCls
          )}
          style={doneToday ? { background: "#a5d6a7" } : circleStyle}
        >
          {doneToday && <span className="text-[11px] text-white">✓</span>}
        </div>
        <div className="w-7 h-7 rounded-full bg-[#ede7f6] flex items-center justify-center text-[13px] shrink-0">
          {h.icon || getFirstTextChar(h.title)}
        </div>
        <div className="min-w-0 flex-1">
          <div
            className={clsx("flex items-center justify-between gap-2", doneToday && "opacity-50")}
          >
            <span
              className={clsx(
                "text-[15px] font-semibold text-ink truncate min-w-0",
                doneToday && "line-through"
              )}
            >
              {h.title}
            </span>
            <div className="flex items-center gap-1.5 shrink-0">
              {h.tag ? (
                <span
                  className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[13px] font-semibold"
                  style={tagColor(h.tag)}
                >
                  {h.tag}
                </span>
              ) : null}
              {statusPill}
            </div>
          </div>
          <div className="mt-0.5 text-[13px] text-muted-light">
            每{h.intervalDays}天 · 到期 {h.nextDueDate}
          </div>
        </div>
        {(status === "overdue" || status === "today") && !doneToday ? (
          <button
            type="button"
            className="btn btn-primary text-[13px] px-2.5 py-1.5 shrink-0"
            onClick={(e) => {
              e.preventDefault();
              props.onDone();
            }}
            disabled={disabled}
          >
            打卡
          </button>
        ) : (
          <svg
            className="h-4 w-4 shrink-0 text-muted-light"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        )}
      </Link>

      <div
        className={clsx(
          "hidden sm:flex items-center gap-2.5 rounded-lg border px-3.5 py-2.5 transition",
          doneToday && "opacity-40"
        )}
        style={{
          background: "#ffffff",
          borderColor: status === "overdue" && !doneToday ? "#f8bbd0" : undefined,
          borderLeftWidth: status === "overdue" && !doneToday ? "3px" : undefined,
          borderLeftColor: status === "overdue" && !doneToday ? "#f48fb1" : undefined,
        }}
      >
        <div
          className={clsx(
            "h-[18px] w-[18px] shrink-0 rounded-full",
            doneToday ? "flex items-center justify-center" : circleCls
          )}
          style={doneToday ? { background: "#a5d6a7" } : circleStyle}
        >
          {doneToday && <span className="text-[9px] text-white">✓</span>}
        </div>
        <div className="w-6 h-6 rounded-full bg-[#ede7f6] flex items-center justify-center text-[12px] shrink-0">
          {h.icon || getFirstTextChar(h.title)}
        </div>
        <Link
          to={`/habits/${h.id}`}
          className={clsx(
            "min-w-0 flex-1 text-[13px] font-semibold text-ink hover:underline truncate",
            doneToday && "line-through"
          )}
        >
          {h.title}
        </Link>
        <div className="flex items-center gap-1.5 shrink-0">
          {h.tag ? (
            <span
              className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold"
              style={tagColor(h.tag)}
            >
              {h.tag}
            </span>
          ) : null}
          {statusPill}
        </div>
        <span className="text-[11px] text-muted-light shrink-0">
          每{h.intervalDays}天 · 到期 {h.nextDueDate}
        </span>

        {isArchived ? (
          <div className="flex flex-wrap items-center justify-end gap-1.5 shrink-0">
            <button
              type="button"
              className="btn text-[11px] px-2 sm:px-3 py-1"
              style={{ color: "#43a047" }}
              onClick={props.onEdit}
              disabled={props.busy}
            >
              <span>♻️</span>
              <span className="hidden sm:inline">恢复</span>
            </button>
            <button
              type="button"
              className="btn text-[11px] px-2 sm:px-3 py-1"
              style={{ color: "#e91e63" }}
              onClick={props.onSkip}
              disabled={props.busy}
            >
              <span>🗑️</span>
              <span className="hidden sm:inline">删除</span>
            </button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-end gap-1.5 shrink-0">
            {(status === "overdue" || status === "today") && !doneToday && (
              <button
                type="button"
                className="btn btn-primary text-[11px] px-2 sm:px-3 py-1"
                onClick={props.onDone}
                disabled={disabled}
              >
                <span>✅</span>
                <span className="hidden sm:inline">打卡</span>
              </button>
            )}
            {status === "overdue" && !doneToday && (
              <button
                type="button"
                className="btn text-[11px] px-2 sm:px-3 py-1"
                onClick={props.onPush}
                disabled={disabled}
              >
                <span>⏰</span>
                <span className="hidden sm:inline">明天</span>
              </button>
            )}
            {!doneToday && (status === "overdue" || status === "today") && (
              <button
                type="button"
                className="btn text-[11px] px-2 sm:px-3 py-1"
                onClick={props.onSkip}
                disabled={disabled}
              >
                <span>⏭</span>
                <span className="hidden sm:inline">跳过</span>
              </button>
            )}
            <button
              type="button"
              className="btn text-[11px] px-2 py-1"
              onClick={props.onEdit}
              disabled={disabled}
            >
              <span>⚙️</span>
            </button>
          </div>
        )}
      </div>
    </>
  );
}
