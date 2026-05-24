# 侧边栏收起功能设计

## 概述

为桌面端侧边栏添加收起/展开功能。收起后侧边栏变为 56px 宽的图标栏，展开恢复完整的 220px 侧边栏。用户选择通过 localStorage 持久化。

## 需求

- 展开状态：220px 完整侧边栏（当前样式），点击 "Habit Tracker" 标题收起
- 收起状态：56px 图标栏，只显示 emoji 图标 + H logo + 用户头像，点击 H 展开
- 收起时鼠标悬停图标显示原生 tooltip
- 收起时隐藏：标签区域、时钟、文字导航
- 收起时保留：导航图标、用户头像、更多按钮图标
- 状态持久化到 localStorage，默认展开
- CSS transition 300ms 平滑过渡

## 技术方案

### 方案选择

CSS 宽度过渡方案：在现有 Sidebar 组件上添加 collapsed 状态，通过 CSS transition 平滑改变宽度，条件渲染展开/收起内容。

### 文件改动

#### 1. 新建 `app/hooks/useSidebarCollapsed.ts`

自定义 hook，管理侧边栏收起状态和 localStorage 持久化。

```ts
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

#### 2. 修改 `app/components/desktop/Sidebar.tsx`

接收 `collapsed` 和 `toggle` props，根据状态渲染不同内容。

**展开状态改动：**

- 顶部标题区域添加 `cursor: pointer`，点击调用 `toggle()`
- 移除时钟旁的三角箭头（如有）

**收起状态：**

- 宽度 56px，居中布局
- 顶部显示 "H" logo，点击调用 `toggle()`
- 导航项只渲染 emoji 图标，使用原生 `title` 属性显示 tooltip
- 标签区域隐藏
- 时钟隐藏
- 用户头像保留，居中显示
- 更多按钮只显示 ⚙️ 图标

**CSS：**

- 侧边栏添加 `transition-all duration-300 ease-in-out`
- 展开宽度 `w-[220px]`，收起宽度 `w-[56px]`

**导航项结构（收起时）：**

```tsx
<Link
  to={item.to}
  title={item.label}
  className="flex items-center justify-center w-10 h-9 rounded-lg hover:bg-warm-white"
>
  <span className="text-[18px]">{item.icon}</span>
</Link>
```

#### 3. 修改 `app/layouts/AppShell.tsx`

- 调用 `useSidebarCollapsed()` hook
- 将 `collapsed` 和 `toggle` 传给 `<Sidebar />`
- 主内容区不需要改动（flex-1 自动填充剩余空间）

#### 4. 修改 `app/components/desktop/Sidebar.tsx` 的 `isActive` 函数

收起状态下 active 高亮逻辑不变，但样式需要适配居中布局。

## 交互细节

| 操作           | 展开状态           | 收起状态         |
| -------------- | ------------------ | ---------------- |
| 点击 logo/标题 | 收起侧边栏         | 展开侧边栏       |
| 点击导航图标   | 跳转页面           | 跳转页面         |
| 鼠标悬停导航项 | 显示文字（无变化） | 显示原生 tooltip |
| 点击用户头像   | 跳转 /profile      | 跳转 /profile    |

## 不做的事

- 不添加键盘快捷键切换
- 不支持移动端（移动端使用底部 TabBar）
- 不添加过渡动画以外的动画效果
- 不同步到云端（仅 localStorage）
