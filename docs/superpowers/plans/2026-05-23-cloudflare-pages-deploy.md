# Cloudflare Pages Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deploy the habit-tracker SPA to Cloudflare Pages with GitHub auto-deploy on push.

**Architecture:** Add a `_redirects` file to `public/` so Cloudflare Pages serves `index.html` for all client-side routes. Then configure Cloudflare Dashboard to connect the GitHub repo, set build command, output directory, and environment variables.

**Tech Stack:** Cloudflare Pages, React Router v7 (SPA mode), Vite, pnpm

---

### Task 1: Add SPA Routing Fallback

**Files:**
- Create: `public/_redirects`

- [ ] **Step 1: Create the `_redirects` file**

```bash
echo '/*  /index.html  200' > public/_redirects
```

This tells Cloudflare Pages to serve `index.html` with a 200 status for any path, enabling client-side routing.

- [ ] **Step 2: Verify the file exists and has correct content**

```bash
cat public/_redirects
```

Expected output:
```
/*  /index.html  200
```

- [ ] **Step 3: Build the project to verify `_redirects` is copied to output**

```bash
pnpm build
cat build/client/_redirects
```

Expected: same content as `public/_redirects`. Cloudflare Pages copies `public/` contents to the build output.

- [ ] **Step 4: Commit**

```bash
git add public/_redirects
git commit -m "feat: add _redirects for Cloudflare Pages SPA routing"
```

### Task 2: Configure Cloudflare Pages (Manual Steps)

These steps cannot be automated from code. Perform them in the Cloudflare Dashboard.

- [ ] **Step 1: Create Cloudflare Pages project**

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/) → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**
2. Select **GitHub** and authorize Cloudflare
3. Choose repository: `talentwill/habit-tracker`
4. Click **Begin setup**

- [ ] **Step 2: Set build configuration**

| Setting | Value |
|---------|-------|
| Production branch | `main` |
| Framework preset | `None` |
| Build command | `pnpm build` |
| Build output directory | `build/client` |

- [ ] **Step 3: Add environment variables**

In the project settings → **Environment variables**, add:

| Variable | Value | Environment |
|----------|-------|-------------|
| `NODE_VERSION` | `20` | Production & Preview |
| `VITE_SUPABASE_URL` | `https://hwuzghysctpnuaowgetb.supabase.co` | Production & Preview |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_1IHCAw2cZ38FRW3xjKc_uA_nVHVtmjE` | Production & Preview |

- [ ] **Step 4: Save and deploy**

Click **Save and Deploy**. Cloudflare will run `pnpm install && pnpm build` and deploy to `<project>.pages.dev`.

- [ ] **Step 5: Verify deployment**

1. Open the deployed URL (shown in Cloudflare dashboard)
2. Navigate to `/login` — should show the login page, not a 404
3. After logging in, navigate between pages — client-side routing should work
4. Check that Supabase connection works (login/signup flow)

- [ ] **Step 6: Configure custom domain (optional)**

1. In Cloudflare Pages project → **Custom domains** → **Set up a custom domain**
2. Enter your domain and follow the DNS configuration steps
