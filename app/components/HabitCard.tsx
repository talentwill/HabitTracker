import clsx from "clsx";

import type { Habit } from "../lib/api";
import { diffDays, statusForDue } from "../lib/date";
import { getFirstTextChar } from "../lib/utils";

function dueLabel(
  status: "overdue" | "today" | "upcoming",
  today: string,
  nextDueDate: string
): string {
  if (status === "overdue") {
    const d = diffDays(nextDueDate, today);
    return `逾期${d}天`;
  }
  if (status === "today") return "今天到期";
  const d = diffDays(today, nextDueDate);
  if (d === 1) return "明天到期";
  if (d === 2) return "后天到期";
  return `${d}天后到期`;
}

function daysAgoLabel(date: string, today: string): string {
  const d = diffDays(date, today);
  if (d === 0) return "今天";
  if (d === 1) return "昨天";
  return `${d}天前`;
}

export default function HabitCard(props: {
  habit: Habit;
  today: string;
  selected?: boolean;
  busy?: boolean;
  onSelect?: () => void;
  onDone: () => void;
  onPush?: () => void;
  onSkip?: () => void;
}) {
  const h = props.habit;
  const disabled = props.busy || h.archived;
  const doneToday = h.lastDoneDate === props.today;
  const firstChar = getFirstTextChar(h.title);
  const status = statusForDue(h.nextDueDate, props.today);

  return (
    <div
      role="button"
      tabIndex={0}
      className={clsx(
        "rounded-lg border transition text-left cursor-pointer flex flex-col min-w-0 w-full",
        props.selected
          ? "border-[#7e57c2] bg-[#faf5ff] dark:border-[#c5a3e3] dark:bg-[rgba(58,50,40,0.85)]"
          : "border-[rgba(180,160,200,0.15)] bg-white hover:border-[#7e57c2]/30 dark:border-[rgba(200,180,160,0.12)] dark:bg-[rgba(42,37,32,0.8)] dark:hover:border-[#c5a3e3]/30"
      )}
      onClick={() => props.onSelect?.()}
      onKeyDown={(e) => {
        if (e.key === "Enter") props.onSelect?.();
      }}
    >
      {/* Upper: Avatar + title/meta */}
      <div className="flex items-center gap-3 px-3 pt-3 pb-1">
        <span
          className={clsx(
            "w-8 h-8 rounded-full flex items-center justify-center text-[14px] sm:text-[13px] font-bold shrink-0",
            doneToday
              ? "bg-[#e8f5e9] text-[#43a047] dark:bg-[rgba(45,74,46,0.9)] dark:text-[#66bb6a]"
              : "bg-[#ede7f6] text-[#7e57c2] dark:bg-[rgba(58,50,40,0.9)] dark:text-[#c5a3e3]"
          )}
        >
          {h.icon || firstChar}
        </span>

        <div className="min-w-0 flex-1 flex items-center justify-between gap-2">
          <span
            className={clsx(
              "text-[17px] sm:text-[15px] font-semibold leading-tight truncate dark:text-[#e8ddd0]",
              doneToday && "line-through opacity-50"
            )}
          >
            {h.title}
          </span>
          {h.tag ? (
            <span className="inline-flex items-center gap-0.5 rounded-full px-1.5 py-0 text-[12px] sm:text-[9px] font-semibold shrink-0 bg-[#e8f5e9] text-[#2e7d32] dark:bg-[rgba(58,50,40,0.9)] dark:text-[#c5a3e3]">
              🏷 {h.tag}
            </span>
          ) : null}
        </div>
      </div>

      {/* Meta info row */}
      <div className="flex items-center gap-2 px-3 pb-2 text-[13px] sm:text-[10px] text-gray-400 dark:text-[#8a7e72]">
        <span className="inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 bg-[#ede7f6] text-[#7e57c2] dark:bg-[rgba(58,50,40,0.9)] dark:text-[#c5a3e3]">
          🔄 每{h.intervalDays}天
        </span>
        <span>
          {h.lastDoneDate ? `上次 ${daysAgoLabel(h.lastDoneDate, props.today)}` : "从未打卡"}
        </span>
        <span className="text-gray-300 dark:text-[rgba(200,180,160,0.2)]">|</span>
        <span
          className={
            status === "overdue" ? "text-[#ef5350]" : status === "today" ? "text-[#f57c00]" : ""
          }
        >
          {dueLabel(status, props.today, h.nextDueDate)}
        </span>
      </div>

      {/* Lower: Action buttons row (pill style) */}
      <div className="flex gap-1.5 px-3 pb-3 pt-0">
        {!doneToday && !disabled && props.onPush ? (
          <button
            type="button"
            className="flex-1 py-1.5 sm:py-1 text-[13px] sm:text-[11px] font-medium text-gray-500 hover:text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-full transition text-center dark:text-[#8a7e72] dark:hover:text-[#e8ddd0] dark:bg-[rgba(58,50,40,0.9)] dark:hover:bg-[rgba(74,66,56,0.9)]"
            onClick={(e) => {
              e.stopPropagation();
              props.onPush?.();
            }}
          >
            ⏰ 明天
          </button>
        ) : null}
        {!doneToday && !disabled && props.onSkip ? (
          <button
            type="button"
            className="flex-1 py-1.5 sm:py-1 text-[13px] sm:text-[11px] font-medium text-gray-500 hover:text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-full transition text-center dark:text-[#8a7e72] dark:hover:text-[#e8ddd0] dark:bg-[rgba(58,50,40,0.9)] dark:hover:bg-[rgba(74,66,56,0.9)]"
            onClick={(e) => {
              e.stopPropagation();
              props.onSkip?.();
            }}
          >
            ⏭ 跳过
          </button>
        ) : null}
        <button
          type="button"
          className={clsx(
            "py-1.5 sm:py-1 text-[13px] sm:text-[11px] font-semibold rounded-full transition text-center",
            doneToday
              ? "px-3 text-[#7e57c2] bg-[#ede7f6] hover:bg-[#d1c4e9] ml-auto dark:text-[#c5a3e3] dark:bg-[rgba(58,50,40,0.9)] dark:hover:bg-[rgba(74,66,56,0.9)]"
              : disabled
                ? "flex-1 text-gray-300 bg-gray-50 dark:text-[rgba(200,180,160,0.3)] dark:bg-[rgba(58,50,40,0.5)]"
                : "flex-1 text-[#43a047] bg-[#e8f5e9] hover:bg-[#c8e6c9] dark:text-[#66bb6a] dark:bg-[rgba(45,74,46,0.9)] dark:hover:bg-[rgba(58,90,58,0.9)]"
          )}
          onClick={(e) => {
            e.stopPropagation();
            if (!disabled) props.onDone();
          }}
          disabled={disabled}
        >
          {doneToday ? "✅ 取消打卡" : "✅ 打卡"}
        </button>
      </div>
    </div>
  );
}
