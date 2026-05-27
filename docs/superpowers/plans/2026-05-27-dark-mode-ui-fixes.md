# Dark Mode UI Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix dark mode styling for habit cards, scrollbars, and sidebar layout.

**Architecture:** Add `@variant dark` directive to enable Tailwind `dark:` prefix with class-based dark mode, then apply `dark:` classes to HabitCard. Add global scrollbar styles for dark mode. Restructure sidebar bottom section.

**Tech Stack:** React 19, Tailwind CSS v4 (class-based dark mode via `html.dark`)

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `app/app.css` | Modify | Add `@variant dark` directive, scrollbar dark styles |
| `app/components/HabitCard.tsx` | Modify | Add `dark:` variant classes to all hardcoded colors |
| `app/components/desktop/Sidebar.tsx` | Modify | Merge theme toggle into "更多" section |

---

### Task 1: Enable Tailwind `dark:` Variant for Class-Based Dark Mode

**Files:**
- Modify: `app/app.css`

The project uses `html.dark` class-based dark mode but Tailwind v4's `dark:` prefix defaults to `prefers-color-scheme` media query. We need to tell Tailwind to use the `.dark` class instead.

- [ ] **Step 1: Add `@variant dark` directive**

At the top of `app/app.css`, after `@import "tailwindcss";` (line 1) and before `@theme {` (line 3), add:

```css
@variant dark (&:where(.dark, .dark *));
```

The top of the file should now read:

```css
@import "tailwindcss";

@variant dark (&:where(.dark, .dark *));

@theme {
  --color-ink: #4a4458;
  ...
```

- [ ] **Step 2: Verify it compiles**

Run: `pnpm dev`
Expected: No errors in terminal.

- [ ] **Step 3: Commit**

```bash
git add app/app.css
git commit -m "feat: enable Tailwind dark: variant for class-based dark mode"
```

---

### Task 2: Add Dark Mode Scrollbar Styles

**Files:**
- Modify: `app/app.css`

- [ ] **Step 1: Add scrollbar styles in `html.dark` block**

At the end of `app/app.css`, after the existing `html.dark .btn:hover` block (line 234), append:

```css
html.dark ::-webkit-scrollbar-track {
  background: transparent;
}

html.dark ::-webkit-scrollbar-thumb {
  background: rgba(200, 180, 160, 0.2);
  border-radius: 4px;
}
```

- [ ] **Step 2: Verify scrollbar appearance**

Run: `pnpm dev`. Open browser, switch to dark mode, scroll the habit list on the today overview page. The scrollbar should have a transparent track with a subtle warm-gray thumb instead of the default white/gray.

- [ ] **Step 3: Commit**

```bash
git add app/app.css
git commit -m "feat: add dark mode scrollbar styles"
```

---

### Task 3: Add Dark Mode Classes to HabitCard

**Files:**
- Modify: `app/components/HabitCard.tsx`

- [ ] **Step 1: Update card container (line 50-55)**

Replace the `className` in the outer `<div>`:

```tsx
className={clsx(
  "rounded-lg border transition text-left cursor-pointer flex flex-col min-w-0 w-full",
  props.selected
    ? "border-[#7e57c2] bg-[#faf5ff] dark:border-[#c5a3e3] dark:bg-[rgba(58,50,40,0.85)]"
    : "border-[rgba(180,160,200,0.15)] bg-white hover:border-[#7e57c2]/30 dark:border-[rgba(200,180,160,0.12)] dark:bg-[rgba(42,37,32,0.8)] dark:hover:border-[#c5a3e3]/30"
)}
```

- [ ] **Step 2: Update avatar span (line 64-68)**

Replace the `className` on the avatar `<span>`:

```tsx
className={clsx(
  "w-8 h-8 rounded-full flex items-center justify-center text-[14px] sm:text-[13px] font-bold shrink-0",
  doneToday
    ? "bg-[#e8f5e9] text-[#43a047] dark:bg-[rgba(45,74,46,0.9)] dark:text-[#66bb6a]"
    : "bg-[#ede7f6] text-[#7e57c2] dark:bg-[rgba(58,50,40,0.9)] dark:text-[#c5a3e3]"
)}
```

- [ ] **Step 3: Update title text (line 74-77)**

Replace the `className` on the title `<span>`:

```tsx
className={clsx(
  "text-[17px] sm:text-[15px] font-semibold leading-tight truncate dark:text-[#e8ddd0]",
  doneToday && "line-through opacity-50"
)}
```

- [ ] **Step 4: Update tag badge (line 82)**

Replace the `className` on the tag `<span>`:

```tsx
className="inline-flex items-center gap-0.5 rounded-full px-1.5 py-0 text-[12px] sm:text-[9px] font-semibold shrink-0 bg-[#e8f5e9] text-[#2e7d32] dark:bg-[rgba(58,50,40,0.9)] dark:text-[#c5a3e3]"
```

- [ ] **Step 5: Update meta info row (line 90)**

Replace the `className` on the meta `<div>`:

```tsx
className="flex items-center gap-2 px-3 pb-2 text-[13px] sm:text-[10px] text-gray-400 dark:text-[#8a7e72]"
```

- [ ] **Step 6: Update interval badge (line 91)**

Replace the `className` on the interval `<span>`:

```tsx
className="inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 bg-[#ede7f6] text-[#7e57c2] dark:bg-[rgba(58,50,40,0.9)] dark:text-[#c5a3e3]"
```

- [ ] **Step 7: Update separator (line 97)**

Replace the `className` on the separator `<span>`:

```tsx
className="text-gray-300 dark:text-[rgba(200,180,160,0.2)]"
```

- [ ] **Step 8: Update push/skip buttons (lines 112, 124)**

Both push and skip buttons have the same className. Replace each:

```tsx
className="flex-1 py-1.5 sm:py-1 text-[13px] sm:text-[11px] font-medium text-gray-500 hover:text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-full transition text-center dark:text-[#8a7e72] dark:hover:text-[#e8ddd0] dark:bg-[rgba(58,50,40,0.9)] dark:hover:bg-[rgba(74,66,56,0.9)]"
```

- [ ] **Step 9: Update done/cancel button (line 135-141)**

Replace the `className` on the main action button:

```tsx
className={clsx(
  "py-1.5 sm:py-1 text-[13px] sm:text-[11px] font-semibold rounded-full transition text-center",
  doneToday
    ? "px-3 text-[#7e57c2] bg-[#ede7f6] hover:bg-[#d1c4e9] ml-auto dark:text-[#c5a3e3] dark:bg-[rgba(58,50,40,0.9)] dark:hover:bg-[rgba(74,66,56,0.9)]"
    : disabled
      ? "flex-1 text-gray-300 bg-gray-50 dark:text-[rgba(200,180,160,0.3)] dark:bg-[rgba(58,50,40,0.5)]"
      : "flex-1 text-[#43a047] bg-[#e8f5e9] hover:bg-[#c8e6c9] dark:text-[#66bb6a] dark:bg-[rgba(45,74,46,0.9)] dark:hover:bg-[rgba(58,90,58,0.9)]"
)}
```

- [ ] **Step 10: Verify in browser**

Run `pnpm dev`. Open browser, switch to dark mode. Confirm:
- Card backgrounds are semi-transparent dark (not white)
- Text is readable (warm white titles, muted meta)
- Badges have dark backgrounds
- Buttons are styled correctly
- Selected state looks correct
- Switch back to light mode — everything should look unchanged

- [ ] **Step 11: Commit**

```bash
git add app/components/HabitCard.tsx
git commit -m "feat: add dark mode styles to HabitCard"
```

---

### Task 4: Merge Sidebar Theme Toggle into "更多" Section

**Files:**
- Modify: `app/components/desktop/Sidebar.tsx`

Current layout (lines 266-294):
```
[Dark mode toggle]  ← separate div (pb-1)
[更多 section]       ← separate div (pb-2)
  └ 更多 link
```

New layout:
```
[更多 section]
  ├ 深色/浅色模式 toggle
  └ 更多 link
```

- [ ] **Step 1: Remove the standalone theme toggle div**

Delete lines 266-283 (the entire `<div className={clsx("pb-1", ...` block containing the theme toggle button).

- [ ] **Step 2: Restructure the "更多" section**

Replace the "更多" section (current lines 285-294) with:

```tsx
<div className={clsx("pb-2", collapsed ? "px-1" : "px-2")}>
  {!collapsed && <div className="label mb-1 px-2">更多</div>}
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
  <SidebarLink
    to="/more"
    icon="⚙️"
    label="更多"
    collapsed={collapsed}
    active={isActive("/more")}
  />
</div>
```

- [ ] **Step 3: Verify in browser**

Run `pnpm dev`. Open browser at desktop width. Confirm:
- Theme toggle and "更多" link are in the same section under "更多" label
- Theme toggle works correctly
- Sidebar collapse/expand still works
- No visual gaps or misalignment

- [ ] **Step 4: Commit**

```bash
git add app/components/desktop/Sidebar.tsx
git commit -m "refactor: merge theme toggle into sidebar 更多 section"
```
