# Dark Theme Design

## Overview

Add a warm dark theme to HabitTracker, toggled manually via a sidebar icon. The preference persists in localStorage.

## Requirements

- Manual toggle only (no system preference detection)
- Toggle icon in sidebar navigation, between "更多" button and tags section
- Preference stored in localStorage
- Warm dark palette (option C): deep brown backgrounds with lavender accent preserved

## Architecture

Use CSS class-based switching: toggle `dark` class on `<html>`. All colors flow through existing CSS custom properties (`--color-*`), so no component code needs color changes.

### Theme Initialization

An inline `<script>` in `<head>` of `root.tsx` reads `localStorage.getItem('theme')` and sets `document.documentElement.classList` before paint. This prevents flash of wrong theme (FOUT).

```html
<script>
  (function () {
    var t = localStorage.getItem("theme");
    if (t === "dark") document.documentElement.classList.add("dark");
  })();
</script>
```

### CSS Variable Overrides

In `app.css`, add a `html.dark` block that overrides all theme variables:

| Variable               | Light                  | Dark                   | Purpose                           |
| ---------------------- | ---------------------- | ---------------------- | --------------------------------- |
| `--color-ink`          | #4a4458                | #e8ddd0                | Primary text                      |
| `--color-paper`        | #ffffff                | #2a2520                | Card/panel background             |
| `--color-warm-white`   | #f8f4fc                | #1f1b18                | Page background                   |
| `--color-muted`        | #8e7fa8                | #8a7e72                | Secondary text                    |
| `--color-muted-light`  | #b8a9c9                | #6a5f55                | Tertiary text                     |
| `--color-line`         | rgba(180,160,200,0.18) | rgba(200,180,160,0.12) | Dividers                          |
| `--color-accent`       | #c5a3e3                | #c5a3e3                | Accent (unchanged)                |
| `--color-accent-hover` | #b39ddb                | #b39ddb                | Accent hover (unchanged)          |
| `--color-accent-focus` | #9c7cb8                | #9c7cb8                | Accent focus (unchanged)          |
| `--color-badge-bg`     | #f3ecf9                | #3a3228                | Badge/tag background              |
| `--color-badge-text`   | #9575cd                | #c5a3e3                | Badge text (lighter for contrast) |
| `--color-bad`          | #ef9a9a                | #ef9a9a                | Danger color (unchanged)          |

Body background changes from warm-white gradient to solid `#1f1b18`.

Shadows adjust to use darker rgba values for depth on dark backgrounds.

Hardcoded colors in `body` selector (currently `color: #4a4458` and `background` gradient) move to CSS variables or get dark overrides.

### Theme Context

Create a React context `ThemeContext` providing:

- `theme: 'light' | 'dark'`
- `toggleTheme(): void`

The provider reads localStorage on mount, and on toggle writes to both localStorage and `<html>` class list. Wrap in `root.tsx` inside `AuthProvider`.

### Sidebar Toggle Button

In `Sidebar.tsx`, add a button above the "更多" section:

- Icon: `🌙` (when light) / `☀️` (when dark)
- Expanded: icon + "深色模式" / "浅色模式" text
- Collapsed: icon only
- Style matches existing `SidebarLink` pattern

### Mobile Support

- `MobileTabBar`: not adding toggle (keep minimal)
- `MorePage`: add a theme toggle switch for mobile users

## Files to Modify

1. `app/app.css` — add `html.dark` variable overrides
2. `app/root.tsx` — inline theme init script, wrap with ThemeProvider
3. `app/components/desktop/Sidebar.tsx` — add toggle button
4. `app/pages/MorePage.tsx` — add toggle for mobile

## Files to Create

1. `app/contexts/ThemeContext.tsx` — theme state management

## Scope Exclusions

- No SSR theme detection
- No system preference (`prefers-color-scheme`) support
- No per-user sync (localStorage only)
- No theme transition animations
