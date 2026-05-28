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
