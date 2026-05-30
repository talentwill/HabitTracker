# Habit Tracker

A full-stack habit tracking app built with React Router v7, Supabase, and Tailwind CSS. Track daily habits, view stats, and manage your routines with a clean, responsive UI featuring light and dark themes.

## Tech Stack

- **Framework**: React Router v7 (SSR)
- **Database & Auth**: Supabase (PostgreSQL)
- **Styling**: Tailwind CSS v4, shadcn/ui
- **Language**: TypeScript
- **Package Manager**: pnpm

## Features

- **Today Overview** — see habits due today at a glance
- **Week View** — weekly calendar with habit status per day
- **Habit Management** — create, edit, archive, and delete habits with custom icons and tags
- **Event Tracking** — mark habits as done, pushed, or skipped
- **Stats Dashboard** — heatmap and summary stats
- **Tag System** — organize habits with tags and filter views
- **Dark Mode** — toggle between light and dark themes
- **Responsive Layout** — collapsible sidebar on desktop, mobile-friendly navigation

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm
- A [Supabase](https://supabase.com/) project

### Installation

```bash
pnpm install
```

### Environment Setup

Create a `.env` file in the project root:

```env
VITE_SUPABASE_URL=your-supabase-url
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

### Database Setup

Apply migrations to your Supabase project:

```bash
supabase link --project-ref <your-project-ref>
supabase db push
```

### Development

```bash
pnpm dev
```

The app will be available at `http://localhost:5173`.

### Build

```bash
pnpm build
pnpm start
```

## Project Structure

```
app/
├── auth/            # Auth context and providers
├── components/      # Reusable UI components
├── contexts/        # React contexts (theme, filters)
├── hooks/           # Custom hooks
├── layouts/         # App shell and layout components
├── lib/             # Utilities, API client, Supabase config
├── pages/           # Route pages
└── routes.ts        # Route definitions
```

## Scripts

| Command          | Description             |
| ---------------- | ----------------------- |
| `pnpm dev`       | Start dev server        |
| `pnpm build`     | Production build        |
| `pnpm start`     | Start production server |
| `pnpm typecheck` | Run type checking       |
| `pnpm lint`      | Run ESLint              |
| `pnpm format`    | Format with Prettier    |
| `pnpm test`      | Run tests               |

---

Built with React Router.
