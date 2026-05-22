import { Outlet } from "react-router";
import Sidebar from "../components/desktop/Sidebar";
import MobileTabBar from "../components/mobile/MobileTabBar";
import { TodayFilterProvider } from "../contexts/TodayFilterContext";

export default function AppShell() {
  return (
    <TodayFilterProvider>
      <div className="flex min-h-full">
        <Sidebar />
        <main className="flex-1 min-w-0 px-3 pt-3 pb-4 sm:px-5 sm:pt-4">
          <Outlet />
        </main>
        <MobileTabBar />
      </div>
    </TodayFilterProvider>
  );
}
