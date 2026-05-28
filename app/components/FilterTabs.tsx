import clsx from "clsx";

const TABS = [
  { key: "todo", label: "已到期" },
  { key: "upcoming", label: "未到期" },
  { key: "done", label: "已完成" },
  { key: "all", label: "全部" },
] as const;

export type FilterTab = (typeof TABS)[number]["key"];

export default function FilterTabs(props: { value: FilterTab; onChange: (v: FilterTab) => void }) {
  return (
    <div
      className="flex items-center gap-1 px-1 py-2 bg-[rgba(180,160,200,0.06)] rounded-xl overflow-x-auto"
      style={{ WebkitOverflowScrolling: "touch" }}
    >
      {TABS.map((t) => (
        <button
          key={t.key}
          type="button"
          className={clsx(
            "flex-1 px-1 py-1.5 sm:py-1 text-[14px] sm:text-[12px] font-medium rounded-full transition whitespace-nowrap text-center",
            props.value === t.key
              ? "bg-[#7e57c2] text-white shadow-sm"
              : "text-gray-500 hover:text-gray-700 hover:bg-white/60 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-white/10"
          )}
          onClick={() => props.onChange(t.key)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
