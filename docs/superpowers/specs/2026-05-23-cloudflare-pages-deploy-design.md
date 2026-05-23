# Cloudflare Pages Deployment Design

## Overview

Deploy the habit-tracker SPA to Cloudflare Pages with GitHub integration for automatic deployment on push.

## Current State

- React Router v7 with `ssr: false` (SPA mode)
- Build output: `build/client/` (static files only)
- Backend: Supabase (external, no server code needed)
- Package manager: pnpm
- Repository: GitHub (`talentwill/habit-tracker`)

## Approach

Use **Cloudflare Pages** with Git integration. On every push to `main`, Cloudflare automatically builds and deploys the site to its global CDN.

### Why Cloudflare Pages (not Workers)

- Project is a pure SPA — no SSR, no edge compute needed
- Pages is purpose-built for static sites with SPA support
- Simpler configuration, generous free tier
- Built-in CDN, custom domains, and preview deployments

## Implementation

### 1. SPA Routing Fallback

Create `public/_redirects` with:

```
/*  /index.html  200
```

This ensures all client-side routes (e.g., `/habits`, `/login`) serve `index.html` instead of returning 404.

### 2. Cloudflare Pages Build Configuration

In Cloudflare Dashboard → Pages → Create project:

| Setting | Value |
|---------|-------|
| Framework preset | None |
| Build command | `pnpm build` |
| Build output directory | `build/client` |
| Node.js version | Set env var `NODE_VERSION=20` |

### 3. Environment Variables

Add these in Cloudflare Pages project settings → Environment variables:

| Variable | Value |
|----------|-------|
| `VITE_SUPABASE_URL` | `https://hwuzghysctpnuaowgetb.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_1IHCAw2cZ38FRW3xjKc_uA_nVHVtmjE` |

These are build-time variables (Vite inlines them at build), so they must be set before the build runs.

### 4. Deployment Flow

```
git push main
  → Cloudflare detects push
  → Runs: pnpm install && pnpm build
  → Deploys build/client/ to CDN
  → Site live at <project>.pages.dev
```

## Scope

- Single PR: add `_redirects` file
- Manual step: configure Cloudflare Pages via dashboard (cannot be automated from code)
- No changes to existing app code, build config, or dependencies
