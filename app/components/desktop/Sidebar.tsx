import clsx from "clsx";
import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";

import { useAuth } from "../../auth/AuthContext";
import { useTodayFilter } from "../../contexts/TodayFilterContext";
import * as api from "../../lib/api";
import type { Habit } from "../../lib/api";
import { nowInLocal, statusForDue, todayDateOnly } from "../../lib/date";
import { tagColor } from "../TagInput";
import TagManager from "../TagManager";

const navItems = [
  { to: "/", label: "今日概览", icon: "📋", section: "views" },
  { to: "/week", label: "本周概览", icon: "📅", section: "views" },
  { to: "/habits", label: "全部习惯", icon: "📑", section: "views" },
  { to: "/archived", label: "归档", icon: "📦", section: "views" },
  { to: "/stats", label: "统计", icon: "📊", section: "analytics" },
];

function filterHabitsByTab(habits: Habit[], tab: string, today: string): Habit[] {
  if (tab === "todo") {
    return habits.filter(
      (h) =>
        statusForDue(h.nextDueDate, today) === "today" ||
        statusForDue(h.nextDueDate, today) === "overdue"
    );
  }
  if (tab === "upcoming") {
    return habits.filter(
      (h) => statusForDue(h.nextDueDate, today) === "upcoming" && h.lastDoneDate !== today
    );
  }
  if (tab === "done") {
    return habits.filter((h) => h.lastDoneDate === today);
  }
  return habits;
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function formatClock(d: Date): string {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}

function SidebarLink({
  to,
  icon,
  label,
  collapsed,
  active,
}: {
  to: string;
  icon: string;
  label: string;
  collapsed: boolean;
  active: boolean;
}) {
  return (
    <Link
      to={to}
      title={collapsed ? label : undefined}
      className={clsx(
        "flex items-center rounded-lg transition",
        collapsed ? "justify-center w-10 h-9" : "gap-2 px-3 py-[7px] text-[14px] font-medium",
        active
          ? collapsed
            ? "bg-badge-bg text-accent"
            : "bg-badge-bg text-accent font-semibold"
          : "text-muted hover:text-ink hover:bg-warm-white"
      )}
    >
      <span className={collapsed ? "text-[18px]" : "text-[15px]"}>{icon}</span>
      {!collapsed && label}
    </Link>
  );
}

interface SidebarProps {
  collapsed: boolean;
  toggle: () => void;
}

export default function Sidebar({ collapsed, toggle }: SidebarProps) {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [tags, setTags] = useState<{ id: string; name: string; habit_count: number }[]>([]);
  const [managerOpen, setManagerOpen] = useState(false);
  const [clock, setClock] = useState(() => formatClock(nowInLocal()));

  useEffect(() => {
    const id = setInterval(() => setClock(formatClock(nowInLocal())), 1000);
    return () => clearInterval(id);
  }, []);

  const viewItems = navItems.filter((n) => n.section === "views");
  const analyticsItems = navItems.filter((n) => n.section === "analytics");

  const tagParams = new URLSearchParams(location.search).get("tag");
  const selectedTag = location.pathname === "/" ? tagParams : null;

  useEffect(() => {
    api
      .listTags()
      .then((res) => setTags(res.tags))
      .catch(() => {});
  }, [location.key]);

  function isActive(to: string) {
    if (to === "/") return location.pathname === "/";
    return location.pathname.startsWith(to);
  }

  function handleTagClick(tag: string | null) {
    if (tag === null) {
      navigate("/");
    } else {
      navigate(`/?tag=${encodeURIComponent(tag)}`);
    }
  }

  const todayFilter = useTodayFilter();

  const tagCounts = useMemo(() => {
    if (!todayFilter || !todayFilter.today || location.pathname !== "/") return null;

    const { filterTab, habits, today } = todayFilter;

    const filtered = filterHabitsByTab(habits, filterTab, today);
    const counts = new Map<string, number>();
    for (const h of filtered) {
      const key = h.tag || "";
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    return counts;
  }, [todayFilter, location.pathname]);

  return (
    <aside
      className={clsx(
        "hidden sm:flex flex-shrink-0 flex-col border-r border-line bg-paper h-screen sticky top-0",
        collapsed ? "w-[56px]" : "w-[220px]"
      )}
    >
      <div
        className={clsx("pt-5 pb-2 cursor-pointer", collapsed ? "px-0 text-center" : "px-4")}
        onClick={toggle}
        title={collapsed ? "展开侧边栏" : "收起侧边栏"}
      >
        {collapsed ? (
          <div className="text-[18px] font-bold text-ink">H</div>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <div className="text-[16px] font-bold tracking-[-0.25px] text-ink">Habit Tracker</div>
              <span className="text-[14px] text-muted hover:text-ink transition" title="收起侧边栏">
                ☰
              </span>
            </div>
            <div className="mt-1 text-[12px] text-muted">
              {todayDateOnly()} {clock}
            </div>
          </>
        )}
      </div>

      <nav
        className={clsx(
          "mt-4 flex-1 overflow-y-auto",
          collapsed ? "px-1 flex flex-col items-center gap-1" : "px-2"
        )}
      >
        {!collapsed && <div className="label mb-1 px-2">视图</div>}
        {viewItems.map((item) => (
          <SidebarLink
            key={item.to}
            to={item.to}
            icon={item.icon}
            label={item.label}
            collapsed={collapsed}
            active={isActive(item.to)}
          />
        ))}

        {!collapsed && <div className="label mt-5 mb-1 px-2">分析</div>}
        {analyticsItems.map((item) => (
          <SidebarLink
            key={item.to}
            to={item.to}
            icon={item.icon}
            label={item.label}
            collapsed={collapsed}
            active={isActive(item.to)}
          />
        ))}

        {!collapsed && tags.length > 0 && (
          <>
            <div className="label mt-5 mb-1 px-2">标签</div>
            <button
              type="button"
              className={clsx(
                "flex items-center gap-2 rounded-lg px-3 py-[7px] text-[13px] font-medium transition w-full text-left",
                selectedTag === null && location.pathname === "/"
                  ? "bg-badge-bg text-accent font-semibold"
                  : "text-muted hover:text-ink hover:bg-warm-white"
              )}
              onClick={() => handleTagClick(null)}
            >
              全部
            </button>
            {tags.map((t) => {
              const c = tagColor(t.name);
              const active = selectedTag === t.name;
              return (
                <button
                  key={t.id}
                  type="button"
                  className={clsx(
                    "flex items-center gap-2 rounded-lg px-3 py-[5px] text-[13px] font-medium transition w-full text-left",
                    active
                      ? "bg-badge-bg text-accent font-semibold"
                      : "text-muted hover:text-ink hover:bg-warm-white"
                  )}
                  onClick={() => handleTagClick(active ? null : t.name)}
                >
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: c.color }} />
                  <span className="flex-1 truncate">{t.name}</span>
                  <span className="text-[11px] text-muted-light">
                    {tagCounts ? tagCounts.get(t.name) || 0 : t.habit_count}
                  </span>
                </button>
              );
            })}
          </>
        )}
        {!collapsed && (
          <button
            type="button"
            className="mt-1 mx-2 flex items-center gap-1 text-[12px] text-muted hover:text-accent transition"
            onClick={() => setManagerOpen(true)}
            title="管理标签"
          >
            <span>+</span>
            <span>管理标签</span>
          </button>
        )}
        <TagManager
          open={managerOpen}
          onClose={() => setManagerOpen(false)}
          tags={tags}
          onRefresh={() => {
            api
              .listTags()
              .then((res) => setTags(res.tags))
              .catch(() => {});
          }}
        />
      </nav>

      <div className={clsx("pb-2", collapsed ? "px-1" : "px-2")}>
        {!collapsed && <div className="label mb-1 px-2">更多</div>}
        <SidebarLink
          to="/more"
          icon="⚙️"
          label="更多"
          collapsed={collapsed}
          active={isActive("/more")}
        />
      </div>

      <Link
        to="/profile"
        className={clsx(
          "border-t border-line transition hover:bg-warm-white",
          collapsed ? "px-0 py-3 flex justify-center" : "px-4 py-3 flex items-center gap-2"
        )}
      >
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-warm-white text-[13px] font-bold text-muted">
          {(user?.name || user?.email || "U")[0]?.toUpperCase()}
        </div>
        {!collapsed && (
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13px] font-semibold text-ink">
              {user?.name || user?.email}
            </div>
          </div>
        )}
      </Link>
    </aside>
  );
}
