-- supabase/migrations/001_add_notification_settings.sql
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS notification_settings JSONB DEFAULT '{}'::jsonb;

-- 添加索引以加速查询有通知配置的用户
CREATE INDEX IF NOT EXISTS idx_profiles_notification_settings
ON profiles USING GIN (notification_settings)
WHERE notification_settings != '{}'::jsonb;
