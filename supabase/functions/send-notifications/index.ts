import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type NotificationType = "daily" | "weekly" | "monthly";

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

function isValidFeishuWebhook(url: string): boolean {
  return url.startsWith("https://open.feishu.cn/open-apis/bot/v2/hook/");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // 获取当前 UTC+8 时间
    const now = new Date();
    const utc8 = new Date(now.getTime() + 8 * 60 * 60 * 1000);
    const currentTime = `${utc8.getUTCHours().toString().padStart(2, "0")}:${utc8.getUTCMinutes().toString().padStart(2, "0")}`;
    const currentDayOfWeek = utc8.getUTCDay();
    const currentDayOfMonth = utc8.getUTCDate();
    const today = utc8.toISOString().split("T")[0];

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

    // 确定需要发送的通知类型
    const userNotifications: Array<{
      userId: string;
      webhookUrl: string;
      types: NotificationType[];
    }> = [];

    for (const profile of profiles) {
      const settings = profile.notification_settings as NotificationSettings;

      if (!settings.feishu_webhook || !isValidFeishuWebhook(settings.feishu_webhook)) continue;

      const types: NotificationType[] = [];

      if (
        settings.daily_reminder?.enabled &&
        settings.daily_reminder.time &&
        currentTime === settings.daily_reminder.time.substring(0, 5)
      ) {
        types.push("daily");
      }

      if (
        settings.weekly_report?.enabled &&
        currentDayOfWeek === 1 &&
        settings.weekly_report.time &&
        currentTime === settings.weekly_report.time.substring(0, 5)
      ) {
        types.push("weekly");
      }

      if (
        settings.monthly_report?.enabled &&
        currentDayOfMonth === (settings.monthly_report.day || 1) &&
        settings.monthly_report.time &&
        currentTime === settings.monthly_report.time.substring(0, 5)
      ) {
        types.push("monthly");
      }

      if (types.length > 0) {
        userNotifications.push({
          userId: profile.id,
          webhookUrl: settings.feishu_webhook,
          types,
        });
      }
    }

    if (userNotifications.length === 0) {
      return new Response(JSON.stringify({ message: "No notifications to send" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 批量查询所有用户的习惯
    const userIds = userNotifications.map((u) => u.userId);
    const { data: allHabits } = await supabaseAdmin
      .from("habits")
      .select("user_id, id, title, icon, next_due_date, interval_days")
      .in("user_id", userIds)
      .eq("archived", false);

    const habitsByUser = new Map<string, typeof allHabits>();
    for (const h of allHabits ?? []) {
      if (!habitsByUser.has(h.user_id)) habitsByUser.set(h.user_id, []);
      habitsByUser.get(h.user_id)!.push(h);
    }

    // 批量查询所有用户的习惯事件（最近 30 天）
    const startDate = new Date(utc8.getTime() - 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];
    const { data: allEvents } = await supabaseAdmin
      .from("habit_events")
      .select("user_id, habit_id, action, action_date")
      .in("user_id", userIds)
      .gte("action_date", startDate)
      .lte("action_date", today);

    const eventsByUser = new Map<string, typeof allEvents>();
    for (const e of allEvents ?? []) {
      if (!eventsByUser.has(e.user_id)) eventsByUser.set(e.user_id, []);
      eventsByUser.get(e.user_id)!.push(e);
    }

    // 构建所有待发送的通知任务
    const tasks: Array<{
      userId: string;
      type: NotificationType;
      webhookUrl: string;
      card: Record<string, unknown>;
    }> = [];

    for (const { userId, webhookUrl, types } of userNotifications) {
      const habits = habitsByUser.get(userId) ?? [];
      if (habits.length === 0) continue;

      const events = eventsByUser.get(userId) ?? [];

      for (const type of types) {
        let card;

        if (type === "daily") {
          const [dueHabits, upcomingHabits] = habits.reduce<[typeof habits, typeof habits]>(
            ([due, upcoming], h) => {
              if (h.next_due_date <= today) {
                due.push(h);
              } else {
                upcoming.push(h);
              }
              return [due, upcoming];
            },
            [[], []]
          );

          if (dueHabits.length === 0) continue;

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
          const daysBack = type === "weekly" ? 7 : 30;
          const reportStart = new Date(utc8.getTime() - daysBack * 24 * 60 * 60 * 1000)
            .toISOString()
            .split("T")[0];

          const periodEvents = events.filter(
            (e) => e.action_date >= reportStart && e.action_date <= today
          );
          const doneEvents = periodEvents.filter((e) => e.action === "done");
          const doneCount = doneEvents.length;

          // 计算期望完成次数（考虑 interval_days）
          let expectedCount = 0;
          for (const habit of habits) {
            const interval = habit.interval_days || 1;
            expectedCount += Math.ceil(daysBack / interval);
          }
          const completionRate =
            expectedCount > 0 ? Math.round((doneCount / expectedCount) * 100) : 0;

          // 计算连续打卡天数
          const doneDates = new Set(doneEvents.map((e) => e.action_date));
          let streak = 0;
          let checkDate = new Date(utc8.getTime() - 24 * 60 * 60 * 1000);
          for (let i = 0; i < daysBack; i++) {
            if (doneDates.has(checkDate.toISOString().split("T")[0])) {
              streak++;
              checkDate = new Date(checkDate.getTime() - 24 * 60 * 60 * 1000);
            } else {
              break;
            }
          }

          const reportTitle = type === "weekly" ? "📊 本周习惯报告" : "📊 本月习惯报告";

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
                      content: `报告周期：${reportStart} ~ ${today}`,
                    },
                  ],
                },
              ],
            },
          };
        }

        tasks.push({ userId, type, webhookUrl, card });
      }
    }

    // 并行发送 webhook（分批，每批 10 个）
    const results = [];
    const BATCH_SIZE = 10;

    for (let i = 0; i < tasks.length; i += BATCH_SIZE) {
      const batch = tasks.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.allSettled(
        batch.map(async (task) => {
          try {
            const response = await fetch(task.webhookUrl, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(task.card),
            });

            let result;
            try {
              result = await response.json();
            } catch {
              result = { code: -1, message: "Invalid JSON response" };
            }

            return {
              user_id: task.userId,
              type: task.type,
              success: result.code === 0 || result.StatusCode === 0,
              error: result.code !== 0 && result.StatusCode !== 0 ? result : null,
            };
          } catch (error) {
            return {
              user_id: task.userId,
              type: task.type,
              success: false,
              error: error.message,
            };
          }
        })
      );

      for (const r of batchResults) {
        results.push(r.status === "fulfilled" ? r.value : r.reason);
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
