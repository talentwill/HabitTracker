# 侧边栏收起功能实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为桌面端侧边栏添加收起/展开功能，收起后变为 56px 图标栏，展开恢复 220px 完整侧边栏。

**Architecture:** 在现有 Sidebar 组件上添加 collapsed 状态，通过 CSS transition 平滑改变宽度。新建 useSidebarCollapsed hook 管理状态和 localStorage 持久化，由 AppShell 调用并将状态传给 Sidebar。

**Tech Stack:** React, TypeScript, Tailwind CSS, Vitest, localStorage

---

## 文件结构

| 文件                                    | 操作 | 职责                                     |
| --------------------------------------- | ---- | ---------------------------------------- |
| `app/hooks/useSidebarCollapsed.ts`      | 新建 | 管理侧边栏收起状态 + localStorage 持久化 |
| `app/hooks/useSidebarCollapsed.test.ts` | 新建 | hook 单元测试                            |
| `app/layouts/AppShell.tsx`              | 修改 | 调用 hook，传递 props 给 Sidebar         |
| `app/components/desktop/Sidebar.tsx`    | 修改 | 接收 props，条件渲染展开/收起内容        |

---

### Task 1: 创建 useSidebarCollapsed hook

**Files:**

- Create: `app/hooks/useSidebarCollapsed.ts`
- Create: `app/hooks/useSidebarCollapsed.test.ts`

- [ ] **Step 1: 编写 hook 测试**

```ts
// app/hooks/useSidebarCollapsed.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useSidebarCollapsed } from "./useSidebarCollapsed";

describe("useSidebarCollapsed", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("默认展开（collapsed = false）", () => {
    const { result } = renderHook(() => useSidebarCollapsed());
    expect(result.current.collapsed).toBe(false);
  });

  it("toggle 切换 collapsed 状态", () => {
    const { result } = renderHook(() => useSidebarCollapsed());
    act(() => result.current.toggle());
    expect(result.current.collapsed).toBe(true);
    act(() => result.current.toggle());
    expect(result.current.collapsed).toBe(false);
  });

  it("toggle 后状态持久化到 localStorage", () => {
    const { result } = renderHook(() => useSidebarCollapsed());
    act(() => result.current.toggle());
    expect(localStorage.getItem("sidebarCollapsed")).toBe("true");
    act(() => result.current.toggle());
    expect(localStorage.getItem("sidebarCollapsed")).toBe("false");
  });

  it("从 localStorage 读取已保存的收起状态", () => {
    localStorage.setItem("sidebarCollapsed", "true");
    const { result } = renderHook(() => useSidebarCollapsed());
    expect(result.current.collapsed).toBe(true);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm vitest run app/hooks/useSidebarCollapsed.test.ts`
Expected: FAIL — "Cannot find module './useSidebarCollapsed'"

- [ ] **Step 3: 实现 hook**

```ts
// app/hooks/useSidebarCollapsed.ts
import { useState, useCallback } from "react";

const STORAGE_KEY = "sidebarCollapsed";

export function useSidebarCollapsed() {
  const [collapsed, setCollapsed] = useState(() => {
    return localStorage.getItem(STORAGE_KEY) === "true";
  });

  const toggle = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(STORAGE_KEY, String(next));
      return next;
    });
  }, []);

  return { collapsed, toggle };
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm vitest run app/hooks/useSidebarCollapsed.test.ts`
Expected: PASS — 4 tests passed

- [ ] **Step 5: 提交**

```bash
git add app/hooks/useSidebarCollapsed.ts app/hooks/useSidebarCollapsed.test.ts
git commit -m "feat: add useSidebarCollapsed hook with localStorage persistence"
```

---

### Task 2: 修改 AppShell 传递 sidebar 状态

**Files:**

- Modify: `app/layouts/AppShell.tsx`

- [ ] **Step 1: 修改 AppShell 调用 hook 并传递 props**

```tsx
// app/layouts/AppShell.tsx
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
```

- [ ] **Step 2: 运行 typecheck 确认无类型错误**

Run: `pnpm typecheck`
Expected: 此时会有类型错误，因为 Sidebar 还不接收 collapsed/toggle props — 这是预期的，下一步修复

- [ ] **Step 3: 提交**

```bash
git add app/layouts/AppShell.tsx
git commit -m "feat: wire useSidebarCollapsed into AppShell"
```

---

### Task 3: 修改 Sidebar 支持收起状态

**Files:**

- Modify: `app/components/desktop/Sidebar.tsx`

- [ ] **Step 1: 添加 props 类型和 collapsed/toggle 参数**

在 Sidebar 组件顶部修改函数签名：

```tsx
interface SidebarProps {
  collapsed: boolean;
  toggle: () => void;
}

export default function Sidebar({ collapsed, toggle }: SidebarProps) {
```

- [ ] **Step 2: 修改侧边栏根元素 — 添加 transition 和条件宽度**

将：

```tsx
<aside className="hidden sm:flex w-[220px] flex-shrink-0 flex-col border-r border-line bg-paper h-screen sticky top-0">
```

改为：

```tsx
<aside
  className={clsx(
    "hidden sm:flex flex-shrink-0 flex-col border-r border-line bg-paper h-screen sticky top-0 transition-all duration-300 ease-in-out",
    collapsed ? "w-[56px]" : "w-[220px]"
  )}
>
```

- [ ] **Step 3: 修改标题区域 — 点击切换，收起时只显示 H**

将标题区域（第 105-109 行）：

```tsx
<div className="px-4 pt-5 pb-2">
  <div className="text-[16px] font-bold tracking-[-0.25px] text-ink">Habit Tracker</div>
  <div className="mt-1 text-[12px] text-muted">
    {todayDateOnly()} {clock}
  </div>
</div>
```

改为：

```tsx
<div
  className={clsx("pt-5 pb-2 cursor-pointer", collapsed ? "px-0 text-center" : "px-4")}
  onClick={toggle}
  title={collapsed ? "展开侧边栏" : "收起侧边栏"}
>
  {collapsed ? (
    <div className="text-[18px] font-bold text-ink">H</div>
  ) : (
    <>
      <div className="text-[16px] font-bold tracking-[-0.25px] text-ink">Habit Tracker</div>
      <div className="mt-1 text-[12px] text-muted">
        {todayDateOnly()} {clock}
      </div>
    </>
  )}
</div>
```

- [ ] **Step 4: 修改导航区域 — 收起时只显示图标**

将 nav 区域（第 112 行开始）的视图导航项渲染改为：

```tsx
<nav className={clsx("mt-4 flex-1 overflow-y-auto", collapsed ? "px-1 flex flex-col items-center gap-1" : "px-2")}>
  {!collapsed && <div className="label mb-1 px-2">视图</div>}
  {viewItems.map((item) =>
    collapsed ? (
      <Link
        key={item.to}
        to={item.to}
        title={item.label}
        className={clsx(
          "flex items-center justify-center w-10 h-9 rounded-lg transition",
          isActive(item.to)
            ? "bg-badge-bg text-accent"
            : "text-muted hover:text-ink hover:bg-warm-white"
        )}
      >
        <span className="text-[18px]">{item.icon}</span>
      </Link>
    ) : (
      <Link
        key={item.to}
        to={item.to}
        className={clsx(
          "flex items-center gap-2 rounded-lg px-3 py-[7px] text-[14px] font-medium transition",
          isActive(item.to)
            ? "bg-badge-bg text-accent font-semibold"
            : "text-muted hover:text-ink hover:bg-warm-white"
        )}
      >
        <span className="text-[15px]">{item.icon}</span>
        {item.label}
      </Link>
    )
  )}

  {!collapsed && <div className="label mt-5 mb-1 px-2">分析</div>}
  {analyticsItems.map((item) =>
    collapsed ? (
      <Link
        key={item.to}
        to={item.to}
        title={item.label}
        className={clsx(
          "flex items-center justify-center w-10 h-9 rounded-lg transition",
          isActive(item.to)
            ? "bg-badge-bg text-accent"
            : "text-muted hover:text-ink hover:bg-warm-white"
        )}
      >
        <span className="text-[18px]">{item.icon}</span>
      </Link>
    ) : (
      <Link
        key={item.to}
        to={item.to}
        className={clsx(
          "flex items-center gap-2 rounded-lg px-3 py-[7px] text-[14px] font-medium transition",
          isActive(item.to)
            ? "bg-badge-bg text-accent font-semibold"
            : "text-muted hover:text-ink hover:bg-warm-white"
        )}
      >
        <span className="text-[15px]">{item.icon}</span>
        {item.label}
      </Link>
    )
  )}
```

- [ ] **Step 5: 标签区域 — 收起时隐藏**

将标签区域包裹在 `{!collapsed && ...}` 中：

```tsx
{
  !collapsed && tags.length > 0 && (
    <>
      <div className="label mt-5 mb-1 px-2">标签</div>
      {/* ... 标签按钮保持不变 ... */}
    </>
  );
}
{
  !collapsed && (
    <button
      type="button"
      className="mt-1 mx-2 flex items-center gap-1 text-[12px] text-muted hover:text-accent transition"
      onClick={() => setManagerOpen(true)}
      title="管理标签"
    >
      <span>+</span>
      <span>管理标签</span>
    </button>
  );
}
```

- [ ] **Step 6: "更多" 区域 — 收起时只显示图标**

将更多区域（第 209-223 行）改为：

```tsx
<div className={clsx("pb-2", collapsed ? "px-1" : "px-2")}>
  {!collapsed && <div className="label mb-1 px-2">更多</div>}
  <Link
    to="/more"
    title="更多"
    className={clsx(
      "flex items-center rounded-lg transition",
      collapsed ? "justify-center w-10 h-9" : "gap-2 px-3 py-[7px] text-[14px] font-medium",
      isActive("/more")
        ? "bg-badge-bg text-accent font-semibold"
        : "text-muted hover:text-ink hover:bg-warm-white"
    )}
  >
    <span className={collapsed ? "text-[18px]" : "text-[15px]"}>⚙️</span>
    {!collapsed && "更多"}
  </Link>
</div>
```

- [ ] **Step 7: 用户头像区域 — 收起时居中显示**

将用户头像区域（第 225-237 行）改为：

```tsx
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
      <div className="truncate text-[13px] font-semibold text-ink">{user?.name || user?.email}</div>
    </div>
  )}
</Link>
```

- [ ] **Step 8: 运行 typecheck 确认无错误**

Run: `pnpm typecheck`
Expected: PASS

- [ ] **Step 9: 运行全部测试确认无回归**

Run: `pnpm test`
Expected: PASS

- [ ] **Step 10: 手动验证**

1. `pnpm dev` 启动开发服务器
2. 桌面端打开，确认侧边栏默认展开
3. 点击 "Habit Tracker" 标题，确认侧边栏平滑收起到 56px
4. 确认收起后只显示图标，hover 显示 tooltip
5. 点击 "H" logo，确认侧边栏平滑展开
6. 确认标签、时钟在收起时隐藏
7. 确认用户头像在两种状态下都显示
8. 刷新页面，确认状态保持（localStorage 生效）
9. 确认移动端不受影响（底部 TabBar 正常）

- [ ] **Step 11: 提交**

```bash
git add app/components/desktop/Sidebar.tsx
git commit -m "feat: implement sidebar collapse with icon-only mode and CSS transition"
```
