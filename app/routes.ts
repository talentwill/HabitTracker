import { type RouteConfig, index, route, layout } from "@react-router/dev/routes";

export default [
  route("login", "pages/LoginPage.tsx"),
  layout("layouts/AppShell.tsx", [
    index("pages/TodayOverview.tsx"),
    route("week", "pages/WeekOverview.tsx"),
    route("habits", "pages/AllHabitsPage.tsx"),
    route("habits/:id", "pages/HabitPage.tsx"),
    route("archived", "pages/ArchivedPage.tsx"),
    route("stats", "pages/StatsPage.tsx"),
    route("more", "pages/MorePage.tsx"),
    route("profile", "pages/ProfilePage.tsx"),
  ]),
] satisfies RouteConfig;
