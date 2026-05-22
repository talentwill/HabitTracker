import { Link, useLocation } from "react-router";

const tabs = [
  { to: "/", label: "概览", icon: "📋" },
  { to: "/habits", label: "全部", icon: "📑" },
  { to: "/stats", label: "统计", icon: "📊" },
  { to: "/more", label: "更多", icon: "🔧" },
];

export default function MobileTabBar() {
  const location = useLocation();

  function isActive(to: string) {
    if (to === "/") return location.pathname === "/";
    return location.pathname.startsWith(to);
  }

  return (
    <nav className="sm:hidden flex border-t border-line bg-paper fixed bottom-0 left-0 right-0 z-40">
      {tabs.map((tab) => (
        <Link
          key={tab.to}
          to={tab.to}
          className="flex flex-1 flex-col items-center py-3 text-[13px] font-medium transition"
          style={{ color: isActive(tab.to) ? "#9575cd" : "#b8a9c9" }}
        >
          <span className="text-[20px] mb-0.5">{tab.icon}</span>
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
