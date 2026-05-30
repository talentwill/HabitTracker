# HabitTracker

## 长期记忆（Obsidian）

本项目使用 Obsidian 作为长期记忆库。
记忆路径：/Users/willwu/Library/Mobile Documents/iCloud~md~obsidian/Documents/Ob.AI-Dev/Projects/HabitTracker/

### 读取记忆

开始重要工作前，先调用 `/init-memory` 读取：
overview.md → decisions.md → errors.md → todo.md

### 保存记忆

会话结束前，调用 `/save-memory`：

- 更新会话日志 sessions/YYYY-MM-DD.md
- 同步 decisions.md / errors.md / todo.md

### 行为规则

- 不要重做已完成的模块
- 发现重复 bug → 追加到 errors.md
- 做了架构选择 → 追加到 decisions.md
- 完成模块 → 更新 todo.md

## Supabase 工作流

- Schema 变更通过 `supabase/migrations/` 管理，不要手动编辑远程数据库
- 本地不运行 Supabase（不需要 Docker），仅通过 CLI 推送 migration
- 远程数据库操作可使用 Supabase MCP（需要 OAuth 认证）
