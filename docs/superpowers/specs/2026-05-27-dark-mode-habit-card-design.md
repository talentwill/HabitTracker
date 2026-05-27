# Dark Mode Habit Card Styling

**Date:** 2026-05-27
**Status:** Approved

## Problem

HabitCard.tsx uses hardcoded Tailwind color classes (`bg-white`, `bg-[#faf5ff]`, `bg-gray-100`, etc.) that don't respond to the dark mode CSS variable overrides defined in `app.css`. After enabling dark mode, habit cards remain white against the dark background.

## Design Decision

**Chosen approach:** Semi-transparent dark cards — `rgba(42, 37, 32, 0.8)` background with `backdrop-filter: blur(8px)`, letting the page gradient bleed through for depth.

Alternatives considered:
- Solid dark cards (`#2a2520`) — unified but flat
- Slightly lighter dark cards (`#3a3530`) — more contrast but less cohesive

## Solution

Add Tailwind `dark:` variant classes to HabitCard.tsx. No CSS file changes, no new components.

### Color Mapping

| Element | Light | Dark |
|---------|-------|------|
| Card background | `bg-white` | `dark:bg-[rgba(42,37,32,0.8)] dark:backdrop-blur-sm` |
| Card border | existing | `dark:border-[rgba(200,180,160,0.12)]` |
| Selected bg | `bg-[#faf5ff]` | `dark:bg-[rgba(58,50,40,0.85)]` |
| Avatar (not done) | `bg-[#ede7f6] text-[#7e57c2]` | `dark:bg-[rgba(58,50,40,0.9)] dark:text-[#c5a3e3]` |
| Avatar (done) | `bg-[#e8f5e9] text-[#43a047]` | `dark:bg-[rgba(45,74,46,0.9)] dark:text-[#66bb6a]` |
| Title text | default | `dark:text-[#e8ddd0]` |
| Meta text | `text-gray-400` | `dark:text-[#8a7e72]` |
| Tag badge | `bg-[#e8f5e9] text-[#2e7d32]` | `dark:bg-[rgba(58,50,40,0.9)] dark:text-[#c5a3e3]` |
| Interval badge | `bg-[#ede7f6] text-[#7e57c2]` | `dark:bg-[rgba(58,50,40,0.9)] dark:text-[#c5a3e3]` |
| Action buttons | `bg-gray-100` | `dark:bg-[rgba(58,50,40,0.9)]` |
| Done button | `bg-[#e8f5e9]` | `dark:bg-[rgba(45,74,46,0.9)]` |
| Cancel button | `bg-[#ede7f6]` | `dark:bg-[rgba(58,50,40,0.9)]` |
| Button text (skip/push) | `text-gray-500` | `dark:text-[#8a7e72]` |
| Button text (done) | `text-[#43a047]` | `dark:text-[#66bb6a]` |
| Button text (cancel) | `text-[#7e57c2]` | `dark:text-[#c5a3e3]` |

### Scope

- **File changed:** `app/components/HabitCard.tsx` only
- **No changes to:** `app.css`, ThemeContext, or any other component

### Notes

- Hover states on buttons also need `dark:` variants for consistency
- The `backdrop-filter: blur` effect is visual polish; browsers that don't support it will fall back to the opaque rgba background gracefully
