# MyHabitsCheck 重构设计

## 目标

将 MyHabitsCheck 习惯打卡应用从 SQLite + Express + React SPA 迁移到 Supabase + React Router 7 的全托管架构，功能完全保持不变，同时重构 UI 为 Lovable 温暖风格。

## 技术栈

| 组件 | 方案 |
|------|------|
| 前端框架 | React 19 + TypeScript + React Router 7 (SPA 模式) |
| 构建工具 | Vite 8 |
| UI 组件库 | shadcn/ui + Radix UI |
| 样式 | Tailwind CSS v4 |
| 字体 | Inter (Google Fonts) |
| 数据获取 | @tanstack/react-query |
| 数据库 | Supabase PostgreSQL |
| 认证 | Supabase Auth (邮箱密码) |
| 业务逻辑 | PostgreSQL Functions (RPC) |
| 前端数据库访问 | @supabase/supabase-js |
| 部署 | Cloudflare Pages |

## 设计系统

基于 Lovable 设计风格，增强温暖感。

### 颜色

| 角色 | 色值 | 说明 |
|------|------|------|
| 背景 | `#f7f4ed` → `#ece5d8` 渐变 | 奶油色渐变背景，非纯色 |
| 卡片背景 | `rgba(255,255,255,0.6)` + backdrop-filter: blur(10px) | 毛玻璃效果 |
| 主按钮 | `#8b6f5e` | 赤陶色，暖调深色 |
| 主按钮文字 | `#fcfbf8` | 暖白 |
| Ghost 按钮 | `rgba(139,111,94,0.15)` 背景 + `rgba(139,111,94,0.3)` 边框 | 赤陶色淡化 |
| 主文字 | `#1c1c1c` | 暖炭色 |
| 次要文字 | `#8a7e6d` | 暖灰 |
| 标签/元数据 | `#a89a8a` | 更浅暖灰 |
| 边框 | `rgba(236,234,228,0.9)` | 暖奶油色边框 |
| Hover 背景 | `rgba(139,111,94,0.06)` | 赤陶色微 tint |
| 危险色 | `#c0392b` | Overdue / 删除 |

### 字体

| 角色 | 大小 | 字重 | 行高 | 字间距 |
|------|------|------|------|--------|
| Display | 32px | 600 | 1.10 | -0.8px |
| Heading | 24px | 600 | 1.20 | -0.5px |
| Subheading | 18px | 600 | 1.30 | normal |
| Body | 16px | 400 | 1.50 | normal |
| Caption | 14px | 400 | 1.50 | normal |
| Small | 12px | 400 | 1.50 | normal |

### 圆角

| 用途 | 值 |
|------|------|
| 按钮 | 8px |
| 卡片 | 14px |
| 容器 | 16px |
| 图标底块 | 10px |
| Pill | 9999px |

### 阴影

| 用途 | 值 |
|------|------|
| 卡片 | `0 1px 3px rgba(28,28,28,0.04)` |
| 主按钮内凹 | `rgba(255,255,255,0.2) 0px 0.5px 0px inset, rgba(0,0,0,0.2) 0px 0px 0px 0.5px inset` |
| Focus | `rgba(0,0,0,0.08) 0px 4px 12px` |

### 间距

基础单位 8px。页面间距 56-80px，卡片内部 12-24px，按钮内边距 8px 16px。

## 项目结构

```
app/
├── root.tsx                    # 根布局（SPA 模式）
├── routes.ts                   # 路由配置
├── app.css                     # 设计 token + Tailwind v4
├── lib/
│   ├── supabase.ts             # Supabase 客户端初始化
│   ├── habit-actions.ts        # 打卡操作 → RPC
│   └── stats.ts                # 统计数据 → RPC
├── contexts/
│   ├── AuthContext.tsx          # Supabase Auth 状态管理
│   └── LayoutContext.tsx        # 侧边栏/面板收起状态
├── hooks/
│   ├── use-habits.ts           # 习惯 CRUD + react-query
│   ├── use-tags.ts             # 标签 CRUD
│   └── use-stats.ts            # 统计数据
├── components/
│   ├── ui/                     # shadcn/ui 基础组件
│   ├── layout/
│   │   ├── AppShell.tsx        # 整体外壳
│   │   ├── Sidebar.tsx         # 可收起侧边栏
│   │   ├── DetailPanel.tsx     # 可收起详情面板
│   │   ├── MobileNav.tsx       # 底部 Tab 导航
│   │   └── TopNav.tsx          # 顶部导航栏
│   └── habits/
│       ├── HabitCard.tsx       # 习惯卡片
│       ├── HabitList.tsx       # 习惯列表
│       ├── HabitDetail.tsx     # 习惯详情
│       ├── HabitStatsGrid.tsx  # 统计数字网格
│       ├── Heatmap.tsx         # 热力图
│       └── ActionButtons.tsx   # Done/Push/Skip 按钮组
├── pages/
│   ├── login.tsx               # 登录/注册
│   ├── today.tsx               # 今日概览
│   ├── week.tsx                # 周视图
│   ├── habits.tsx              # 全部习惯
│   ├── habit.$id.tsx           # 单个习惯详情
│   ├── stats.tsx               # 统计
│   ├── archived.tsx            # 已归档
│   ├── profile.tsx             # 个人设置
│   └── more.tsx                # 更多功能
└── types/
    └── habit.ts                # TypeScript 类型定义
```

## Supabase 集成

### 认证

- 注册：`supabase.auth.signUp({ email, password, options: { data: { name } } })`
- 登录：`supabase.auth.signInWithPassword({ email, password })`
- 登出：`supabase.auth.signOut()`
- AuthContext 监听 `onAuthStateChange`，维护用户状态
- 未登录自动跳转 `/login`

### 数据操作

| 操作 | 方式 |
|------|------|
| CRUD habits/tags | `supabase.from('habits').select()...` 直连 |
| 打卡/跳过/推送 | `supabase.rpc('apply_habit_action', { p_habit_id, p_action })` |
| 统计 | `supabase.rpc('get_stats_summary')` |

### Hooks

所有数据操作封装为 hooks，内部使用 `@tanstack/react-query`：

- `useHabits()` — 习惯列表 CRUD
- `useHabit(id)` — 单个习惯 + applyAction
- `useHabitEvents(habitId)` — 事件历史
- `useTags()` — 标签管理
- `useStats()` — 统计数据

组件不直接调用 Supabase client，全部通过 hooks。

## 路由 & 布局

### 路由

| 路径 | 页面 | 认证 |
|------|------|------|
| `/login` | LoginPage | 否 |
| `/` | TodayPage | 是 |
| `/week` | WeekPage | 是 |
| `/habits` | HabitsPage | 是 |
| `/habits/:id` | HabitDetailPage | 是 |
| `/stats` | StatsPage | 是 |
| `/archived` | ArchivedPage | 是 |
| `/profile` | ProfilePage | 是 |
| `/more` | MorePage | 是 |

### 布局嵌套

```
root.tsx
├── /login → LoginPage（无外壳）
└── AppShell.tsx（认证外壳）
    ├── TopNav（桌面端顶部导航栏）
    ├── Sidebar（可收起侧边栏，桌面端显示）
    ├── DetailPanel（可收起详情面板，桌面端显示）
    ├── MobileNav（移动端底部 Tab）
    └── <Outlet /> → 各页面
```

### 可折叠布局

- **侧边栏**：点击 ☰ 按钮收起为图标栏（52px 宽），展开为 220px
- **详情面板**：点击 ✕ 按钮关闭，列表切换为全宽行布局
- 状态持久化到 localStorage
- 移动端侧边栏不显示，详情用底部 Sheet

### 响应式

| 断点 | 布局 |
|------|------|
| <768px | 移动端：顶部标题 + 全宽内容 + 底部 Tab |
| ≥768px | 桌面端：TopNav + Sidebar + 内容 + DetailPanel |

## 组件设计

### HabitCard

- 渐变色图标底块 (`#e8dfd3` → `#d4c9b8`)
- 标题 + 间隔描述 + 状态标签
- Streak 标签（连续打卡天数）
- 操作按钮组：Done（赤陶色主按钮）/ Push / Skip（Ghost 按钮）

### ActionButtons

- Done：`#8b6f5e` 背景 + 内凹阴影 + `#fcfbf8` 文字
- Push/Skip：`rgba(139,111,94,0.15)` 背景 + `rgba(139,111,94,0.3)` 边框
- 加载状态 spinner、成功反馈动画

### Heatmap

- 赤陶色透明度渐变：`rgba(139,111,94,0.05)` → `#8b6f5e`
- 52 周网格，鼠标悬停显示日期和状态

### StatsPage

- 大数字展示（48px font-weight 600）
- 按标签分组统计
- 赤陶色热力图

## 不在范围内

- 不做功能新增
- 不做国际化
- 不做实时订阅（Supabase Realtime）
- 不做离线支持
- 不做 SSR（SPA 模式）
- 数据迁移单独处理（不在本设计范围内）
