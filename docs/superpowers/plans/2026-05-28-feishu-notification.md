# 飞书机器人通知功能实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为习惯追踪应用添加飞书机器人通知功能，支持每日习惯提醒和每周/月统计报告。

**Architecture:** 使用 Supabase Edge Functions 处理通知发送，pg_cron 定时触发，前端 UI 配置通知设置。每个用户独立配置飞书 Webhook URL。

**Tech Stack:** Supabase Edge Functions (Deno), pg_cron, React, TypeScript, Tailwind CSS

---

## 文件结构

### 新增文件

- `supabase/functions/test-notification/index.ts` - 测试通知 Edge Function
- `supabase/functions/send-notifications/index.ts` - 定时通知 Edge Function
- `supabase/migrations/001_add_notification_settings.sql` - 数据库迁移脚本

### 修改文件

- `app/lib/api.ts` - 添加通知相关 API 函数
- `app/pages/ProfilePage.tsx` - 添加通知设置 UI

---

## Task 1: 数据库迁移 - 添加 notification_settings 字段

**Files:**

- Create: `supabase/migrations/001_add_notification_settings.sql`

- [ ] **Step 1: 创建迁移脚本**

```sql
-- supabase/migrations/001_add_notification_settings.sql
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS notification_settings JSONB DEFAULT '{}'::jsonb;

-- 添加索引以加速查询有通知配置的用户
CREATE INDEX IF NOT EXISTS idx_profiles_notification_settings
ON profiles USING GIN (notification_settings)
WHERE notification_settings != '{}'::jsonb;
```

- [ ] **Step 2: 在 Supabase Dashboard 执行迁移**

登录 Supabase Dashboard → SQL Editor，执行上述 SQL 语句。

- [ ] **Step 3: 验证字段添加成功**

在 SQL Editor 执行：

```sql
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'profiles' AND column_name = 'notification_settings';
```

Expected: 返回 `notification_settings | jsonb | '{}'::jsonb`

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/001_add_notification_settings.sql
git commit -m "feat: add notification_settings column to profiles table"
```

---

## Task 2: 创建 test-notification Edge Function

**Files:**

- Create: `supabase/functions/test-notification/index.ts`

- [ ] **Step 1: 创建 Edge Function 目录结构**

```bash
mkdir -p supabase/functions/test-notification
```

- [ ] **Step 2: 实现 test-notification Edge Function**

```typescript
// supabase/functions/test-notification/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TestNotificationRequest {
  webhook_url: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: req.headers.get("Authorization")! } } }
    );

    // 获取当前用户
    const {
      data: { user },
    } = await supabaseClient.auth.getUser();

    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { webhook_url }: TestNotificationRequest = await req.json();

    if (!webhook_url || !webhook_url.startsWith("https://open.feishu.cn/")) {
      return new Response(JSON.stringify({ error: "Invalid webhook URL" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 构建测试消息卡片
    const testCard = {
      msg_type: "interactive",
      card: {
        config: { wide_screen_mode: true },
        header: {
          title: { tag: "plain_text", content: "🧪 通知测试" },
          template: "blue",
        },
        elements: [
          {
            tag: "div",
            text: {
              tag: "lark_md",
              content:
                "**习惯追踪器通知测试**\n\n如果你看到这条消息，说明飞书机器人配置成功！\n\n发送时间：" +
                new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" }),
            },
          },
        ],
      },
    };

    // 发送测试消息到飞书
    const response = await fetch(webhook_url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(testCard),
    });

    const result = await response.json();

    if (result.code !== 0 && result.StatusCode !== 0) {
      return new Response(
        JSON.stringify({ error: "Failed to send test notification", details: result }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ success: true, message: "Test notification sent" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
```

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/test-notification/index.ts
git commit -m "feat: add test-notification Edge Function"
```

---

## Task 3: 创建 send-notifications Edge Function

**Files:**

- Create: `supabase/functions/send-notifications/index.ts`

- [ ] **Step 1: 创建 Edge Function 目录结构**

```bash
mkdir -p supabase/functions/send-notifications
```

- [ ] **Step 2: 实现 send-notifications Edge Function**

```typescript
// supabase/functions/send-notifications/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NotificationSettings {
  feishu_webhook?: string;
  daily_reminder?: {
    enabled: boolean;
    time: string; // "HH:MM"
    timezone?: string;
  };
  weekly_report?: {
    enabled: boolean;
    day: number; // 0-6, 0 is Sunday
    time: string;
  };
  monthly_report?: {
    enabled: boolean;
    day: number; // 1-31
    time: string;
  };
}

interface Habit {
  id: string;
  title: string;
  icon: string | null;
  next_due_date: string;
  archived: boolean;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 使用 service_role key 查询所有用户
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // 获取当前 UTC+8 时间
    const now = new Date();
    const utc8 = new Date(now.getTime() + 8 * 60 * 60 * 1000);
    const currentHour = utc8.getUTCHours().toString().padStart(2, "0");
    const currentMinute = utc8.getUTCMinutes().toString().padStart(2, "0");
    const currentTime = `${currentHour}:${currentMinute}`;
    const currentDayOfWeek = utc8.getUTCDay(); // 0=Sunday
    const currentDayOfMonth = utc8.getUTCDate();

    console.log(
      `Current time (UTC+8): ${currentTime}, Day of week: ${currentDayOfWeek}, Day of month: ${currentDayOfMonth}`
    );

    // 查询所有有通知配置的用户
    const { data: profiles, error: profilesError } = await supabaseAdmin
      .from("profiles")
      .select("id, email, notification_settings")
      .neq("notification_settings", "{}");

    if (profilesError) {
      throw new Error(`Failed to fetch profiles: ${profilesError.message}`);
    }

    if (!profiles || profiles.length === 0) {
      return new Response(JSON.stringify({ message: "No users with notification settings" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results = [];

    for (const profile of profiles) {
      const settings = profile.notification_settings as NotificationSettings;

      if (!settings.feishu_webhook) continue;

      const notificationsToSend = [];

      // 检查每日提醒
      if (
        settings.daily_reminder?.enabled &&
        settings.daily_reminder.time &&
        currentTime.startsWith(settings.daily_reminder.time.substring(0, 2))
      ) {
        notificationsToSend.push("daily");
      }

      // 检查每周报告（周一 = 1）
      if (
        settings.weekly_report?.enabled &&
        currentDayOfWeek === 1 &&
        settings.weekly_report.time &&
        currentTime.startsWith(settings.weekly_report.time.substring(0, 2))
      ) {
        notificationsToSend.push("weekly");
      }

      // 检查每月报告
      if (
        settings.monthly_report?.enabled &&
        currentDayOfMonth === (settings.monthly_report.day || 1) &&
        settings.monthly_report.time &&
        currentTime.startsWith(settings.monthly_report.time.substring(0, 2))
      ) {
        notificationsToSend.push("monthly");
      }

      if (notificationsToSend.length === 0) continue;

      // 获取用户的习惯数据
      const { data: habits, error: habitsError } = await supabaseAdmin
        .from("habits")
        .select("id, title, icon, next_due_date, archived")
        .eq("user_id", profile.id)
        .eq("archived", false);

      if (habitsError || !habits || habits.length === 0) continue;

      const today = utc8.toISOString().split("T")[0];

      for (const notificationType of notificationsToSend) {
        let card;

        if (notificationType === "daily") {
          const dueHabits = habits.filter((h) => h.next_due_date <= today);
          const upcomingHabits = habits.filter((h) => h.next_due_date > today);

          if (dueHabits.length === 0) continue; // 今日无待办，跳过

          const dueList = dueHabits
            .map((h) => `${h.icon || "📌"} ${h.title}${h.next_due_date < today ? " ⚠️ 逾期" : ""}`)
            .join("\n");

          card = {
            msg_type: "interactive",
            card: {
              config: { wide_screen_mode: true },
              header: {
                title: { tag: "plain_text", content: "📋 今日习惯提醒" },
                template: "blue",
              },
              elements: [
                {
                  tag: "div",
                  text: {
                    tag: "lark_md",
                    content: `**今日待完成习惯 (${dueHabits.length}项)**\n\n${dueList}`,
                  },
                },
                ...(upcomingHabits.length > 0
                  ? [
                      {
                        tag: "div",
                        text: {
                          tag: "lark_md",
                          content: `\n**即将到来 (${upcomingHabits.length}项)**\n${upcomingHabits.map((h) => `${h.icon || "📌"} ${h.title} (${h.next_due_date})`).join("\n")}`,
                        },
                      },
                    ]
                  : []),
                {
                  tag: "note",
                  elements: [
                    {
                      tag: "plain_text",
                      content: `发送时间：${utc8.toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })}`,
                    },
                  ],
                },
              ],
            },
          };
        } else {
          // weekly 或 monthly report
          // 获取过去 7 天或 30 天的完成情况
          const daysBack = notificationType === "weekly" ? 7 : 30;
          const startDate = new Date(utc8.getTime() - daysBack * 24 * 60 * 60 * 1000)
            .toISOString()
            .split("T")[0];

          const { data: events } = await supabaseAdmin
            .from("habit_events")
            .select("habit_id, action, action_date")
            .eq("user_id", profile.id)
            .gte("action_date", startDate)
            .lte("action_date", today);

          const totalDue = habits.length * daysBack;
          const doneCount = events?.filter((e) => e.action === "done").length || 0;
          const completionRate = totalDue > 0 ? Math.round((doneCount / totalDue) * 100) : 0;

          // 计算连续打卡天数
          let streak = 0;
          const doneDates = new Set(
            events?.filter((e) => e.action === "done").map((e) => e.action_date)
          );
          let checkDate = new Date(utc8.getTime() - 24 * 60 * 60 * 1000);
          while (doneDates.has(checkDate.toISOString().split("T")[0])) {
            streak++;
            checkDate = new Date(checkDate.getTime() - 24 * 60 * 60 * 1000);
          }

          const reportTitle = notificationType === "weekly" ? "📊 本周习惯报告" : "📊 本月习惯报告";

          card = {
            msg_type: "interactive",
            card: {
              config: { wide_screen_mode: true },
              header: {
                title: { tag: "plain_text", content: reportTitle },
                template: "green",
              },
              elements: [
                {
                  tag: "div",
                  fields: [
                    {
                      is_short: true,
                      text: { tag: "lark_md", content: `**完成率**\n${completionRate}%` },
                    },
                    {
                      is_short: true,
                      text: { tag: "lark_md", content: `**连续打卡**\n${streak} 天` },
                    },
                    {
                      is_short: true,
                      text: { tag: "lark_md", content: `**完成次数**\n${doneCount} 次` },
                    },
                    {
                      is_short: true,
                      text: { tag: "lark_md", content: `**活跃习惯**\n${habits.length} 个` },
                    },
                  ],
                },
                {
                  tag: "note",
                  elements: [
                    {
                      tag: "plain_text",
                      content: `报告周期：${startDate} ~ ${today}`,
                    },
                  ],
                },
              ],
            },
          };
        }

        // 发送通知
        try {
          const response = await fetch(settings.feishu_webhook, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(card),
          });

          const result = await response.json();
          results.push({
            user_id: profile.id,
            type: notificationType,
            success: result.code === 0 || result.StatusCode === 0,
            error: result.code !== 0 && result.StatusCode !== 0 ? result : null,
          });
        } catch (error) {
          results.push({
            user_id: profile.id,
            type: notificationType,
            success: false,
            error: error.message,
          });
        }
      }
    }

    return new Response(JSON.stringify({ results, processed: profiles.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
```

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/send-notifications/index.ts
git commit -m "feat: add send-notifications Edge Function"
```

---

## Task 4: 添加前端 API 函数

**Files:**

- Modify: `app/lib/api.ts`

- [ ] **Step 1: 在 api.ts 末尾添加通知相关类型和函数**

在 `app/lib/api.ts` 文件末尾（`importHabits` 函数之后）添加：

```typescript
// --- Notification Settings ---

export type NotificationSettings = {
  feishu_webhook?: string;
  daily_reminder?: {
    enabled: boolean;
    time: string;
    timezone?: string;
  };
  weekly_report?: {
    enabled: boolean;
    day: number;
    time: string;
  };
  monthly_report?: {
    enabled: boolean;
    day: number;
    time: string;
  };
};

export async function getNotificationSettings(): Promise<NotificationSettings> {
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser) throw new ApiError({ status: 401, code: "UNAUTHORIZED" });

  const { data, error } = await supabase
    .from("profiles")
    .select("notification_settings")
    .eq("id", authUser.id)
    .single();

  if (error) throw new ApiError({ status: 500, code: error.message });
  return (data.notification_settings as NotificationSettings) ?? {};
}

export async function updateNotificationSettings(
  settings: NotificationSettings
): Promise<{ ok: boolean }> {
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser) throw new ApiError({ status: 401, code: "UNAUTHORIZED" });

  const { error } = await supabase
    .from("profiles")
    .update({
      notification_settings: settings,
      updated_at: new Date().toISOString(),
    })
    .eq("id", authUser.id);

  if (error) throw new ApiError({ status: 500, code: error.message });
  return { ok: true };
}

export async function sendTestNotification(webhookUrl: string): Promise<{ success: boolean }> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new ApiError({ status: 401, code: "UNAUTHORIZED" });

  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/test-notification`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ webhook_url: webhookUrl }),
    }
  );

  const result = await response.json();
  if (!response.ok) {
    throw new ApiError({ status: response.status, code: result.error || "TEST_FAILED" });
  }
  return { success: true };
}
```

- [ ] **Step 2: Commit**

```bash
git add app/lib/api.ts
git commit -m "feat: add notification API functions"
```

---

## Task 5: 添加通知设置 UI

**Files:**

- Modify: `app/pages/ProfilePage.tsx`

- [ ] **Step 1: 在 ProfilePage.tsx 中导入新的 API 函数**

在文件顶部的 import 语句中添加：

```typescript
import {
  // ... 现有导入
  getNotificationSettings,
  updateNotificationSettings,
  sendTestNotification,
  NotificationSettings,
} from "../lib/api";
```

- [ ] **Step 2: 添加通知设置状态**

在 `ProfilePage` 组件中，现有的 state 声明之后添加：

```typescript
// 通知设置状态
const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>({});
const [notificationLoading, setNotificationLoading] = useState(false);
const [notificationStatus, setNotificationStatus] = useState<"idle" | "saving" | "done" | "error">(
  "idle"
);
const [testStatus, setTestStatus] = useState<"idle" | "sending" | "success" | "error">("idle");
const [testError, setTestError] = useState("");
```

- [ ] **Step 3: 添加加载通知设置的函数**

```typescript
async function loadNotificationSettings() {
  try {
    const settings = await getNotificationSettings();
    setNotificationSettings(settings);
  } catch {
    /* ignore */
  }
}
```

- [ ] **Step 4: 在 useEffect 中调用加载通知设置**

在现有的 `useEffect` 中添加 `loadNotificationSettings()` 调用。

- [ ] **Step 5: 添加保存通知设置的函数**

```typescript
async function handleSaveNotificationSettings() {
  setNotificationStatus("saving");
  setNotificationLoading(true);
  try {
    await updateNotificationSettings(notificationSettings);
    setNotificationStatus("done");
    setTimeout(() => setNotificationStatus("idle"), 2000);
  } catch {
    setNotificationStatus("error");
  } finally {
    setNotificationLoading(false);
  }
}
```

- [ ] **Step 6: 添加发送测试通知的函数**

```typescript
async function handleTestNotification() {
  if (!notificationSettings.feishu_webhook) return;

  setTestStatus("sending");
  setTestError("");
  try {
    await sendTestNotification(notificationSettings.feishu_webhook);
    setTestStatus("success");
    setTimeout(() => setTestStatus("idle"), 3000);
  } catch (e) {
    setTestStatus("error");
    setTestError(e instanceof Error ? e.message : "发送失败");
  }
}
```

- [ ] **Step 7: 添加通知设置 UI 组件**

在 ProfilePage 的 return 语句中，在现有设置区域之后添加通知设置区域：

```tsx
{
  /* 通知设置 */
}
<div className="border-t pt-6 mt-6">
  <h3 className="text-lg font-semibold mb-4">通知设置</h3>

  {/* 飞书 Webhook URL */}
  <div className="mb-4">
    <label className="block text-sm font-medium mb-1">飞书 Webhook URL</label>
    <div className="flex gap-2">
      <input
        type="text"
        value={notificationSettings.feishu_webhook || ""}
        onChange={(e) =>
          setNotificationSettings({
            ...notificationSettings,
            feishu_webhook: e.target.value,
          })
        }
        placeholder="https://open.feishu.cn/open-apis/bot/v2/hook/xxx"
        className="flex-1 px-3 py-2 border rounded-md dark:bg-gray-800 dark:border-gray-700"
      />
      <button
        onClick={handleTestNotification}
        disabled={!notificationSettings.feishu_webhook || testStatus === "sending"}
        className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50"
      >
        {testStatus === "sending" ? "发送中..." : "测试"}
      </button>
    </div>
    {testStatus === "success" && <p className="text-sm text-green-600 mt-1">测试通知发送成功！</p>}
    {testStatus === "error" && <p className="text-sm text-red-600 mt-1">发送失败：{testError}</p>}
  </div>

  {/* 每日提醒 */}
  <div className="mb-4 p-4 border rounded-md dark:border-gray-700">
    <div className="flex items-center justify-between mb-2">
      <label className="font-medium">每日习惯提醒</label>
      <input
        type="checkbox"
        checked={notificationSettings.daily_reminder?.enabled || false}
        onChange={(e) =>
          setNotificationSettings({
            ...notificationSettings,
            daily_reminder: {
              ...notificationSettings.daily_reminder,
              enabled: e.target.checked,
              time: notificationSettings.daily_reminder?.time || "08:00",
            },
          })
        }
        className="h-4 w-4"
      />
    </div>
    {notificationSettings.daily_reminder?.enabled && (
      <input
        type="time"
        value={notificationSettings.daily_reminder?.time || "08:00"}
        onChange={(e) =>
          setNotificationSettings({
            ...notificationSettings,
            daily_reminder: {
              ...notificationSettings.daily_reminder!,
              time: e.target.value,
            },
          })
        }
        className="px-3 py-2 border rounded-md dark:bg-gray-800 dark:border-gray-700"
      />
    )}
  </div>

  {/* 每周报告 */}
  <div className="mb-4 p-4 border rounded-md dark:border-gray-700">
    <div className="flex items-center justify-between mb-2">
      <label className="font-medium">每周统计报告</label>
      <input
        type="checkbox"
        checked={notificationSettings.weekly_report?.enabled || false}
        onChange={(e) =>
          setNotificationSettings({
            ...notificationSettings,
            weekly_report: {
              ...notificationSettings.weekly_report,
              enabled: e.target.checked,
              day: 1,
              time: notificationSettings.weekly_report?.time || "09:00",
            },
          })
        }
        className="h-4 w-4"
      />
    </div>
    {notificationSettings.weekly_report?.enabled && (
      <div className="flex gap-2">
        <select
          value={notificationSettings.weekly_report?.day || 1}
          onChange={(e) =>
            setNotificationSettings({
              ...notificationSettings,
              weekly_report: {
                ...notificationSettings.weekly_report!,
                day: parseInt(e.target.value),
              },
            })
          }
          className="px-3 py-2 border rounded-md dark:bg-gray-800 dark:border-gray-700"
        >
          <option value={1}>周一</option>
          <option value={2}>周二</option>
          <option value={3}>周三</option>
          <option value={4}>周四</option>
          <option value={5}>周五</option>
          <option value={6}>周六</option>
          <option value={0}>周日</option>
        </select>
        <input
          type="time"
          value={notificationSettings.weekly_report?.time || "09:00"}
          onChange={(e) =>
            setNotificationSettings({
              ...notificationSettings,
              weekly_report: {
                ...notificationSettings.weekly_report!,
                time: e.target.value,
              },
            })
          }
          className="px-3 py-2 border rounded-md dark:bg-gray-800 dark:border-gray-700"
        />
      </div>
    )}
  </div>

  {/* 每月报告 */}
  <div className="mb-4 p-4 border rounded-md dark:border-gray-700">
    <div className="flex items-center justify-between mb-2">
      <label className="font-medium">每月统计报告</label>
      <input
        type="checkbox"
        checked={notificationSettings.monthly_report?.enabled || false}
        onChange={(e) =>
          setNotificationSettings({
            ...notificationSettings,
            monthly_report: {
              ...notificationSettings.monthly_report,
              enabled: e.target.checked,
              day: 1,
              time: notificationSettings.monthly_report?.time || "09:00",
            },
          })
        }
        className="h-4 w-4"
      />
    </div>
    {notificationSettings.monthly_report?.enabled && (
      <div className="flex gap-2">
        <select
          value={notificationSettings.monthly_report?.day || 1}
          onChange={(e) =>
            setNotificationSettings({
              ...notificationSettings,
              monthly_report: {
                ...notificationSettings.monthly_report!,
                day: parseInt(e.target.value),
              },
            })
          }
          className="px-3 py-2 border rounded-md dark:bg-gray-800 dark:border-gray-700"
        >
          {Array.from({ length: 28 }, (_, i) => (
            <option key={i + 1} value={i + 1}>
              {i + 1} 日
            </option>
          ))}
        </select>
        <input
          type="time"
          value={notificationSettings.monthly_report?.time || "09:00"}
          onChange={(e) =>
            setNotificationSettings({
              ...notificationSettings,
              monthly_report: {
                ...notificationSettings.monthly_report!,
                time: e.target.value,
              },
            })
          }
          className="px-3 py-2 border rounded-md dark:bg-gray-800 dark:border-gray-700"
        />
      </div>
    )}
  </div>

  {/* 保存按钮 */}
  <button
    onClick={handleSaveNotificationSettings}
    disabled={notificationLoading}
    className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 disabled:opacity-50"
  >
    {notificationStatus === "saving" ? "保存中..." : "保存通知设置"}
  </button>
  {notificationStatus === "done" && <p className="text-sm text-green-600 mt-2">保存成功！</p>}
  {notificationStatus === "error" && <p className="text-sm text-red-600 mt-2">保存失败，请重试</p>}
</div>;
```

- [ ] **Step 8: Commit**

```bash
git add app/pages/ProfilePage.tsx
git commit -m "feat: add notification settings UI to ProfilePage"
```

---

## Task 6: 部署 Edge Functions 和配置 pg_cron

**Files:**

- None (手动操作)

- [ ] **Step 1: 安装 Supabase CLI**

```bash
brew install supabase/tap/supabase
```

- [ ] **Step 2: 登录 Supabase**

```bash
supabase login
```

- [ ] **Step 3: 链接到项目**

```bash
supabase link --project-ref <your-project-ref>
```

- [ ] **Step 4: 部署 Edge Functions**

```bash
supabase functions deploy test-notification
supabase functions deploy send-notifications
```

- [ ] **Step 5: 设置环境变量**

在 Supabase Dashboard → Edge Functions → Settings 中设置：

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

- [ ] **Step 6: 配置 pg_cron**

在 Supabase SQL Editor 执行：

```sql
-- 启用 pg_cron 扩展
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 每小时触发一次通知 Edge Function
SELECT cron.schedule(
  'send-habit-notifications',
  '0 * * * *',
  $$ SELECT net.http_post(
    'https://<your-project-ref>.supabase.co/functions/v1/send-notifications',
    '{}',
    'application/json',
    ARRAY[http_header('Authorization', 'Bearer <your-service-role-key>')]
  ) $$
);
```

- [ ] **Step 7: Commit 文档更新**

```bash
git add docs/
git commit -m "docs: add deployment instructions for notification functions"
```

---

## 验证清单

完成所有任务后，按以下顺序验证：

1. [ ] 数据库字段添加成功
2. [ ] 前端通知设置 UI 正常显示
3. [ ] 保存通知设置成功
4. [ ] 测试通知发送成功
5. [ ] Edge Functions 部署成功
6. [ ] pg_cron 定时任务配置成功
7. [ ] 每日提醒正常发送（等待整点验证）

---

## 注意事项

1. **Webhook URL 验证**：确保用户输入的飞书 Webhook URL 格式正确
2. **时区处理**：所有时间计算基于 UTC+8（北京时间）
3. **错误处理**：Edge Function 中的错误不应影响其他用户
4. **安全性**：使用 service_role key 访问所有用户数据，仅在 Edge Function 中使用
