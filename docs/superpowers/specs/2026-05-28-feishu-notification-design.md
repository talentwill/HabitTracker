# 飞书机器人通知功能设计

## 概述

为习惯追踪应用添加飞书机器人通知功能，支持每日习惯提醒和每周/月统计报告，通过 Supabase Edge Functions + pg_cron 实现服务端定时发送。

## 需求

- **每日习惯提醒**：用户可配置发送时间，推送今日待完成习惯列表
- **每周统计报告**：每周发送上周完成率、连续打卡天数等数据
- **每月统计报告**：每月发送上月统计数据
- **每用户独立 Webhook**：每个用户配置自己的飞书群 Webhook URL
- **配置 UI**：在现有 ProfilePage 中添加通知设置区域
- **测试按钮**：配置后可发送测试通知验证 Webhook 是否有效
- **消息格式**：使用飞书消息卡片（Interactive Card）

## 技术方案

### 1. 数据库层

在 `profiles` 表添加 `notification_settings` JSONB 字段：

```sql
ALTER TABLE profiles ADD COLUMN notification_settings JSONB DEFAULT '{}'::jsonb;
```

结构：

```json
{
  "feishu_webhook": "https://open.feishu.cn/open-apis/bot/v2/hook/xxx",
  "daily_reminder": {
    "enabled": true,
    "time": "08:00",
    "timezone": "Asia/Shanghai"
  },
  "weekly_report": {
    "enabled": true,
    "day": 1,
    "time": "09:00"
  },
  "monthly_report": {
    "enabled": true,
    "day": 1,
    "time": "09:00"
  }
}
```

- 默认值为空对象 `{}`，表示未配置通知
- 不需要修改 RLS 策略（用户已有自己的 profile 读写权限）

### 2. Supabase Edge Function

创建 `send-notifications` Edge Function：

**触发方式**：pg_cron 每小时调用一次

**执行逻辑**：

1. 获取当前 UTC+8 时间
2. 查询所有 `notification_settings` 非空的用户
3. 根据当前时间匹配需要发送的通知类型：
   - 当前小时 == 用户配置的 daily_reminder.time 的小时部分 → 发送每日提醒
   - 当前是周一且时间匹配 weekly_report → 发送周报
   - 当前是每月1号且时间匹配 monthly_report → 发送月报
4. 对匹配的用户：
   - 从数据库获取用户的习惯数据
   - 构建飞书消息卡片 JSON
   - POST 到用户的 webhook URL

**飞书消息卡片格式**：

每日提醒卡片：

- 标题：📋 今日习惯提醒
- 内容：列出今日待完成的习惯（emoji + 标题 + 逾期标记）
- 颜色：蓝色主题

统计报告卡片：

- 标题：📊 本周/月习惯报告
- 内容：完成率、连续打卡天数、各习惯完成情况
- 颜色：绿色主题

**错误处理**：

- webhook 无效或返回错误 → 跳过该用户，记录到 Edge Function 日志
- 用户无习惯 → 跳过不发送

### 3. pg_cron 定时调度

```sql
-- 每小时触发一次 Edge Function
SELECT cron.schedule(
  'send-habit-notifications',
  '0 * * * *',
  $$ SELECT net.http_post(
    'https://<project-ref>.supabase.co/functions/v1/send-notifications',
    '{}',
    'application/json',
    ARRAY[http_header('Authorization', 'Bearer <service-role-key>')]
  ) $$
);
```

### 4. 前端 UI

在 ProfilePage 中添加「通知设置」区域，包含：

- **飞书 Webhook URL** 输入框 + 保存按钮
- **每日提醒**开关 + 时间选择器
- **每周报告**开关 + 星期选择 + 时间选择器
- **每月报告**开关 + 日期选择 + 时间选择器
- **发送测试通知**按钮

API 函数添加到 `api.ts`：

- `getNotificationSettings()` - 读取设置
- `updateNotificationSettings(settings)` - 保存设置
- `sendTestNotification()` - 发送测试通知（调用 Edge Function）

### 5. 测试通知

创建单独的 `test-notification` Edge Function，接收 webhook URL 和用户 ID，立即发送一条测试卡片消息，返回成功/失败结果。前端调用后显示结果。

## 文件清单

### 新增文件

- `supabase/functions/send-notifications/index.ts` - 定时通知 Edge Function
- `supabase/functions/test-notification/index.ts` - 测试通知 Edge Function

### 修改文件

- `supabase-schema.sql` - 添加 notification_settings 字段
- `app/lib/api.ts` - 添加通知相关 API 函数
- `app/pages/ProfilePage.tsx` - 添加通知设置 UI

## 实现顺序

1. 数据库 migration（添加字段）
2. Edge Function：test-notification（先做测试通知，便于验证）
3. Edge Function：send-notifications（定时通知）
4. 前端 API 层
5. 前端 UI
6. pg_cron 配置
