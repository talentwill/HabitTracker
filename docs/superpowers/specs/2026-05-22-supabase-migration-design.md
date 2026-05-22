# MyHabitsCheck Supabase 迁移设计

## 目标

将 MyHabitsCheck 习惯打卡应用从 SQLite + Express + ECS 自托管架构迁移到 Supabase + Cloudflare Pages 的全托管架构，功能完全保持不变。

## 现有架构

- 后端：Node.js + Express + SQLite（部署在 ECS 服务器）
- 前端：React + TypeScript + Tailwind CSS
- 认证：自实现 JWT（cookie-based）
- 部署：systemd + nginx，域名 habit.lanbaiwa.com

## 目标架构

- 前端：React + TypeScript + Tailwind CSS → Cloudflare Pages
- 后端：Supabase（PostgreSQL + Auth + PostgreSQL Functions + Edge Functions）
- 数据迁移：从服务器已有的 JSON 导出文件导入

## 技术选型

| 组件 | 方案 |
|------|------|
| 前端框架 | React 19 + TypeScript + Vite |
| UI 样式 | Tailwind CSS |
| 前端部署 | Cloudflare Pages |
| 数据库 | Supabase PostgreSQL |
| 认证 | Supabase Auth（邮箱密码） |
| 业务逻辑 | PostgreSQL Functions（RPC）+ 前端直连 |
| API Key 外部调用 | Supabase Edge Function |
| 数据库安全 | Row Level Security（RLS） |
| 前端数据库访问 | @supabase/supabase-js |

## 数据库设计

### 表结构

**profiles（应用用户表，关联 Supabase auth.users）**
```sql
profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT,
  api_key     TEXT UNIQUE,
  api_key_created_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
)
```

**tags**
```sql
tags (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
)
```

**habits**
```sql
habits (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title          TEXT NOT NULL,
  note           TEXT NOT NULL DEFAULT '',
  interval_days  INTEGER NOT NULL DEFAULT 1,
  next_due_date  DATE NOT NULL,
  start_date     DATE DEFAULT NULL,
  archived       BOOLEAN NOT NULL DEFAULT false,
  tag_id         UUID REFERENCES tags(id) ON DELETE SET NULL,
  icon           TEXT,
  created_at     TIMESTAMPTZ DEFAULT now(),
  updated_at     TIMESTAMPTZ DEFAULT now()
)
```

**habit_events**
```sql
habit_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  habit_id      UUID NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
  action        TEXT NOT NULL CHECK(action IN ('done', 'push', 'skip')),
  action_date   DATE NOT NULL,
  from_due_date DATE,
  to_due_date   DATE,
  created_at    TIMESTAMPTZ DEFAULT now()
)
```

### 索引

```sql
CREATE INDEX idx_habits_user_archived ON habits(user_id, archived);
CREATE INDEX idx_habits_user_due_date ON habits(user_id, next_due_date);
CREATE INDEX idx_habit_events_habit_date ON habit_events(habit_id, action_date);
CREATE INDEX idx_habit_events_user_date ON habit_events(user_id, action_date);
```

### RLS 策略

所有表启用 RLS，策略为：用户只能访问 `user_id = auth.uid()` 的数据。

```sql
-- 示例（每个表都类似）
CREATE POLICY "Users can CRUD own habits"
  ON habits FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
```

profiles 表特殊处理：用户只能读写自己的 profile。

### 触发器

```sql
-- 用户注册时自动创建 profile
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name', ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
```

## PostgreSQL Functions（RPC）

### apply_habit_action

核心打卡逻辑，替代现有 habitService.applyAction：

```sql
CREATE OR REPLACE FUNCTION apply_habit_action(
  p_habit_id UUID,
  p_action TEXT  -- 'done' | 'push' | 'skip'
)
RETURNS habits AS $$
DECLARE
  v_habit habits%ROWTYPE;
  v_today DATE := CURRENT_DATE;
  v_from_due DATE;
  v_to_due DATE;
  v_last_done DATE;
BEGIN
  SELECT * INTO v_habit FROM habits WHERE id = p_habit_id AND user_id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  IF v_habit.archived THEN RAISE EXCEPTION 'HABIT_ARCHIVED'; END IF;

  v_from_due := v_habit.next_due_date;

  CASE p_action
    WHEN 'push' THEN
      v_to_due := v_today + 1;
    WHEN 'skip' THEN
      v_to_due := v_from_due;
      WHILE v_to_due < v_today LOOP
        v_to_due := v_to_due + v_habit.interval_days;
      END LOOP;
    WHEN 'done' THEN
      SELECT MAX(action_date) INTO v_last_done
      FROM habit_events
      WHERE habit_id = p_habit_id AND action = 'done';
      v_to_due := GREATEST(COALESCE(v_last_done, v_today), v_today)
                  + GREATEST(v_habit.interval_days, 1);
  END CASE;

  -- 删除当天已有事件，插入新事件
  DELETE FROM habit_events
  WHERE habit_id = p_habit_id AND action_date = v_today;

  INSERT INTO habit_events (user_id, habit_id, action, action_date, from_due_date, to_due_date)
  VALUES (auth.uid(), p_habit_id, p_action, v_today, v_from_due, v_to_due);

  UPDATE habits SET next_due_date = v_to_due, updated_at = now()
  WHERE id = p_habit_id
  RETURNING * INTO v_habit;

  RETURN v_habit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### get_stats_summary

首页统计数据：

```sql
CREATE OR REPLACE FUNCTION get_stats_summary()
RETURNS JSON AS $$
DECLARE
  v_today DATE := CURRENT_DATE;
  v_result JSON;
BEGIN
  SELECT json_build_object(
    'today', v_today,
    'counts', json_build_object(
      'active', (SELECT count(*) FROM habits WHERE user_id = auth.uid() AND archived = false),
      'archived', (SELECT count(*) FROM habits WHERE user_id = auth.uid() AND archived = true),
      'dueToday', (SELECT count(*) FROM habits WHERE user_id = auth.uid() AND archived = false AND next_due_date <= v_today),
      'overdue', (SELECT count(*) FROM habits WHERE user_id = auth.uid() AND archived = false AND next_due_date < v_today),
      'upcoming', (SELECT count(*) FROM habits WHERE user_id = auth.uid() AND archived = false AND next_due_date > v_today)
    ),
    'recentEvents', (
      SELECT COALESCE(json_agg(json_build_object(
        'id', he.id,
        'action', he.action,
        'actionDate', he.action_date,
        'fromDueDate', he.from_due_date,
        'toDueDate', he.to_due_date,
        'createdAt', he.created_at,
        'habit', json_build_object('id', h.id, 'title', h.title)
      )), '[]'::json)
      FROM habit_events he
      JOIN habits h ON h.id = he.habit_id
      WHERE he.user_id = auth.uid()
      ORDER BY he.created_at DESC LIMIT 20
    )
  ) INTO v_result;
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

## Edge Functions

### api-key-checkin

处理外部 API Key 调用（替代现有 `/api/v1/*`）：

- 从请求头获取 API Key
- 查询 profiles 表验证
- 执行打卡操作（调用 apply_habit_action）
- 返回结果

## 前端设计

### 项目结构

```
web/
├── src/
│   ├── lib/
│   │   └── supabase.ts          # Supabase 客户端初始化
│   ├── contexts/
│   │   └── AuthContext.tsx       # 基于 Supabase Auth 的认证
│   ├── pages/                   # 页面组件（功能不变）
│   ├── components/              # UI 组件（功能不变）
│   └── types/                   # TypeScript 类型
├── public/
└── ...config files
```

### Supabase 客户端

```typescript
import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
```

### 数据操作方式

| 操作 | 方式 |
|------|------|
| CRUD habits/tags | `supabase.from('habits').select()...` 直连 |
| 打卡/跳过/推送 | `supabase.rpc('apply_habit_action', {...})` |
| 统计 | `supabase.rpc('get_stats_summary')` |
| 登录/注册 | `supabase.auth.signInWithPassword()` / `signUp()` |
| API Key 外部调用 | Edge Function |

### 认证流程

- 注册：`supabase.auth.signUp({ email, password, options: { data: { name } } })`
- 登录：`supabase.auth.signInWithPassword({ email, password })`
- 登出：`supabase.auth.signOut()`
- 获取当前用户：`supabase.auth.getUser()`
- 监听状态变化：`supabase.auth.onAuthStateChange()`

### 页面（功能不变）

- LoginPage — 登录/注册
- TodayOverview — 今日概览
- WeekOverview — 周视图
- AllHabitsPage — 全部习惯
- HabitPage — 单个习惯详情
- StatsPage — 统计
- ArchivedPage — 已归档
- ProfilePage — 个人设置
- MorePage — 更多功能

## 数据迁移

**时机：** 开发完成、测试通过后，从服务器已有的 JSON 导出文件导入。

**步骤：**
1. 在 Supabase 中创建用户（通过 Auth API，使用相同邮箱密码）
2. 读取 JSON 文件，按用户映射新的 user_id
3. 导入 tags → habits → habit_events（按依赖顺序）
4. 验证数据完整性

可以写一个一次性 Node.js 脚本完成。

## 部署

### Cloudflare Pages

- 关联 Git 仓库
- 构建命令：`npm run build`
- 输出目录：`dist`
- 环境变量：`VITE_SUPABASE_URL`、`VITE_SUPABASE_ANON_KEY`

### 域名

- 在 Cloudflare Pages 绑定 `habit.lanbaiwa.com`
- 配置 DNS CNAME 指向 Cloudflare Pages

### ECS 服务器

- 迁移完成后可以下线

## Git 仓库

- **新仓库：** https://github.com/talentwill/HabitTracker
- 在新仓库上开发，旧仓库（ECS 自托管）保留作参考

## 项目初始化

用户使用官方 CLI 命令初始化项目，不手动生成脚手架：

```bash
# 前端项目
npm create vite@latest web -- --template react-ts

# Supabase（本地开发）
npx supabase init
npx supabase start
```

## 不在范围内

- 不做功能新增
- 不做 UI 改版
- 不做国际化
- 不做实时订阅（Supabase Realtime）
- 不做离线支持
