import { Outlet } from "react-router";
import Sidebar from "../components/desktop/Sidebar";
import MobileTabBar from "../components/mobile/MobileTabBar";
import { TodayFilterProvider } from "../contexts/TodayFilterContext";
import { useSidebarCollapsed } from "../hooks/useSidebarCollapsed";

export default function AppShell() {
  const { collapsed, toggle } = useSidebarCollapsed();

  return (
    <TodayFilterProvider>
      <div className="flex min-h-full">
        <Sidebar collapsed={collapsed} toggle={toggle} />
        <main className="flex-1 min-w-0 px-3 pt-3 pb-4 sm:px-5 sm:pt-4">
          <Outlet />
        </main>
        <MobileTabBar />
      </div>
    </TodayFilterProvider>
  );
}
