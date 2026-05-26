# Dark Theme Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a warm dark theme toggled from the sidebar, with localStorage persistence.

**Architecture:** CSS class-based switching — `html.dark` overrides CSS custom properties. A React context manages state. An inline `<head>` script prevents flash of wrong theme.

**Tech Stack:** React 19, Tailwind CSS v4, CSS custom properties, localStorage

---

## File Structure

| File                                 | Action | Responsibility                              |
| ------------------------------------ | ------ | ------------------------------------------- |
| `app/app.css`                        | Modify | Add `html.dark` variable overrides          |
| `app/contexts/ThemeContext.tsx`      | Create | Theme state, toggle, localStorage sync      |
| `app/root.tsx`                       | Modify | Inline init script, wrap with ThemeProvider |
| `app/components/desktop/Sidebar.tsx` | Modify | Add theme toggle button                     |
| `app/pages/MorePage.tsx`             | Modify | Add theme toggle for mobile                 |

---

### Task 1: CSS Dark Theme Variables

**Files:**

- Modify: `app/app.css`

- [ ] **Step 1: Add `html.dark` overrides at the end of `app.css`**

Append after the existing `@media (max-width: 640px)` block:

```css
html.dark {
  --color-ink: #e8ddd0;
  --color-paper: #2a2520;
  --color-warm-white: #1f1b18;
  --color-muted: #8a7e72;
  --color-muted-light: #6a5f55;
  --color-line: rgba(200, 180, 160, 0.12);
  --color-badge-bg: #3a3228;
  --color-badge-text: #c5a3e3;
  --shadow-card:
    rgba(0, 0, 0, 0.2) 0px 4px 18px, rgba(0, 0, 0, 0.12) 0px 2px 7px,
    rgba(0, 0, 0, 0.08) 0px 0.5px 2px;
  --shadow-deep:
    rgba(0, 0, 0, 0.1) 0px 1px 3px, rgba(0, 0, 0, 0.15) 0px 3px 7px,
    rgba(0, 0, 0, 0.15) 0px 7px 15px, rgba(0, 0, 0, 0.2) 0px 14px 28px,
    rgba(0, 0, 0, 0.25) 0px 23px 52px;
}

html.dark body {
  color: #e8ddd0;
  background: #1f1b18;
}

html.dark .input {
  background: #2a2520;
  border-color: rgba(200, 180, 160, 0.12);
}

html.dark .input::placeholder {
  color: #6a5f55;
}

html.dark a {
  color: #c5a3e3;
}

html.dark ::selection {
  background: rgba(197, 163, 227, 0.35);
}
```

- [ ] **Step 2: Verify CSS compiles**

Run: `pnpm dev` and check the terminal for no CSS errors. Open the browser devtools, manually add `dark` class to `<html>`, and confirm colors change.

- [ ] **Step 3: Commit**

```bash
git add app/app.css
git commit -m "feat: add dark theme CSS variable overrides"
```

---

### Task 2: Theme Context

**Files:**

- Create: `app/contexts/ThemeContext.tsx`

- [ ] **Step 1: Create ThemeContext**

```tsx
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useCallback,
  type ReactNode,
} from "react";

type Theme = "light" | "dark";

type ThemeContextValue = {
  theme: Theme;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window === "undefined") return "light";
    return (localStorage.getItem("theme") as Theme) || "light";
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    localStorage.setItem("theme", theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  }, []);

  const value = useMemo(() => ({ theme, toggleTheme }), [theme, toggleTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within <ThemeProvider>");
  return ctx;
}
```

- [ ] **Step 2: Commit**

```bash
git add app/contexts/ThemeContext.tsx
git commit -m "feat: add ThemeContext with localStorage persistence"
```

---

### Task 3: Theme Init Script in root.tsx

**Files:**

- Modify: `app/root.tsx`

- [ ] **Step 1: Add inline script in `<head>` and wrap with ThemeProvider**

In `app/root.tsx`, make these changes:

1. Import `ThemeProvider` from `./contexts/ThemeContext`
2. Add the inline script as the first child of `<head>` (before `<meta>`)
3. Wrap children inside `AuthProvider` with `<ThemeProvider>`

The `Layout` function should look like:

```tsx
import { ThemeProvider } from "./contexts/ThemeContext";

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html:
              '(function(){var t=localStorage.getItem("theme");if(t==="dark")document.documentElement.classList.add("dark")})();',
          }}
        />
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        <AuthProvider>
          <ThemeProvider>{children}</ThemeProvider>
        </AuthProvider>
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}
```

- [ ] **Step 2: Verify no flash**

Run `pnpm dev`. Open the browser, set `localStorage.setItem('theme', 'dark')` in console, refresh the page. The page should load dark immediately without flashing white.

- [ ] **Step 3: Commit**

```bash
git add app/root.tsx
git commit -m "feat: add theme init script and ThemeProvider in root"
```

---

### Task 4: Sidebar Theme Toggle

**Files:**

- Modify: `app/components/desktop/Sidebar.tsx`

- [ ] **Step 1: Add import and toggle button**

1. Add import at top:

```tsx
import { useTheme } from "../../contexts/ThemeContext";
```

2. Inside the `Sidebar` component, get theme state:

```tsx
const { theme, toggleTheme } = useTheme();
```

3. Add the toggle button above the "更多" section (before line 264 `<div className={clsx("pb-2", ...`). Insert:

```tsx
<div className={clsx("pb-1", collapsed ? "px-1" : "px-2")}>
  <button
    type="button"
    className={clsx(
      "flex items-center rounded-lg transition w-full",
      collapsed
        ? "justify-center w-10 h-9"
        : "gap-2 px-3 py-[7px] text-[14px] font-medium text-muted hover:text-ink hover:bg-warm-white"
    )}
    onClick={toggleTheme}
    title={theme === "dark" ? "切换浅色模式" : "切换深色模式"}
  >
    <span className={collapsed ? "text-[18px]" : "text-[15px]"}>
      {theme === "dark" ? "☀️" : "🌙"}
    </span>
    {!collapsed && (theme === "dark" ? "浅色模式" : "深色模式")}
  </button>
</div>
```

- [ ] **Step 2: Verify in browser**

Run `pnpm dev`. Open the browser, click the theme toggle in the sidebar. The entire app should switch between light and dark. Click again to switch back. Collapse the sidebar and verify the icon-only mode works.

- [ ] **Step 3: Commit**

```bash
git add app/components/desktop/Sidebar.tsx
git commit -m "feat: add theme toggle button in sidebar"
```

---

### Task 5: MorePage Theme Toggle (Mobile)

**Files:**

- Modify: `app/pages/MorePage.tsx`

- [ ] **Step 1: Add import and toggle row**

1. Add import at top:

```tsx
import { useTheme } from "../contexts/ThemeContext";
```

2. Inside the `MorePage` component, get theme state:

```tsx
const { theme, toggleTheme } = useTheme();
```

3. Add a new section after the "数据管理" block and before the "退出登录" block (around line 147). Insert:

```tsx
{
  /* 主题设置 */
}
<div className="rounded-lg border border-line bg-paper overflow-hidden mb-3">
  <button
    type="button"
    className="w-full flex items-center justify-between px-4 py-3 text-[16px] font-medium text-ink"
    onClick={toggleTheme}
  >
    <span>{theme === "dark" ? "☀️ 浅色模式" : "🌙 深色模式"}</span>
    <span className="text-muted-light">›</span>
  </button>
</div>;
```

- [ ] **Step 2: Verify on mobile viewport**

Run `pnpm dev`. Open the browser at mobile width (< 640px). Navigate to MorePage. Tap the theme toggle. Confirm the theme switches.

- [ ] **Step 3: Commit**

```bash
git add app/pages/MorePage.tsx
git commit -m "feat: add theme toggle in MorePage for mobile users"
```
