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
