import { useState, useEffect } from "react";
import { Link } from "react-router";
import { useAuth } from "../auth/AuthContext";
import TagManager from "../components/TagManager";
import * as api from "../lib/api";

export default function MorePage() {
  const { user, logout } = useAuth();
  const [tags, setTags] = useState<{ id: string; name: string; habit_count: number }[]>([]);
  const [managerOpen, setManagerOpen] = useState(false);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    api
      .listTags()
      .then((res) => setTags(res.tags))
      .catch(() => {});
  }, []);

  const refreshTags = () => {
    api
      .listTags()
      .then((res) => setTags(res.tags))
      .catch(() => {});
  };

  const handleExport = async () => {
    try {
      const blob = await api.exportHabits();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const date = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `habits-backup-${date}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert("导出失败");
    }
  };

  const handleImport = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;

      if (!confirm("此操作将替换所有现有习惯和打卡记录，确定继续？")) {
        return;
      }

      setImporting(true);
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        const result = await api.importHabits(data);
        alert(
          `导入成功！共导入 ${result.imported.habits} 个习惯，${result.imported.events} 条记录`
        );
        window.location.reload();
      } catch (err: any) {
        alert(`导入失败：${err?.message || "格式错误"}`);
      } finally {
        setImporting(false);
      }
    };
    input.click();
  };

  return (
    <div className="pb-20">
      <h1 className="section-title mb-4">🔧 更多</h1>

      {/* 用户信息卡片 */}
      <Link to="/profile" className="paper px-4 py-3 mb-3 block">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-warm-white text-[14px] font-bold text-muted">
            {(user?.name || user?.email || "U")[0]?.toUpperCase()}
          </div>
          <div>
            <div className="text-[16px] font-semibold text-ink">{user?.name || user?.email}</div>
          </div>
        </div>
      </Link>

      {/* 功能菜单 */}
      <div className="rounded-lg border border-line bg-paper overflow-hidden mb-3">
        <Link
          to="/week"
          className="flex items-center justify-between px-4 py-3 border-b border-line text-[16px] font-medium text-ink"
        >
          📅 本周概览
          <span className="text-muted-light">›</span>
        </Link>
        <Link
          to="/archived"
          className="flex items-center justify-between px-4 py-3 border-b border-line text-[16px] font-medium text-ink"
        >
          📦 归档习惯
          <span className="text-muted-light">›</span>
        </Link>
        <Link
          to="/profile"
          className="flex items-center justify-between px-4 py-3 border-b border-line text-[16px] font-medium text-ink"
        >
          👤 个人资料
          <span className="text-muted-light">›</span>
        </Link>
        <button
          type="button"
          className="w-full flex items-center justify-between px-4 py-3 text-[16px] font-medium text-ink"
          onClick={() => setManagerOpen(true)}
        >
          <span>🏷 管理标签</span>
          <span className="flex items-center gap-1">
            {tags.length > 0 && (
              <span className="text-muted-light text-[16px] sm:text-[12px]">{tags.length}个</span>
            )}
            <span className="text-muted-light">›</span>
          </span>
        </button>
      </div>

      {/* 数据管理 */}
      <div className="rounded-lg border border-line bg-paper overflow-hidden mb-3">
        <button
          type="button"
          className="w-full flex items-center justify-between px-4 py-3 border-b border-line text-[16px] font-medium text-ink"
          onClick={handleExport}
        >
          <span>📤 导出习惯数据</span>
          <span className="text-muted-light">›</span>
        </button>
        <button
          type="button"
          className="w-full flex items-center justify-between px-4 py-3 text-[16px] font-medium text-ink disabled:opacity-50"
          onClick={handleImport}
          disabled={importing}
        >
          <span>{importing ? "导入中..." : "📥 导入习惯数据"}</span>
          <span className="text-muted-light">›</span>
        </button>
      </div>

      {/* 退出登录 */}
      <div className="rounded-lg border border-line bg-paper overflow-hidden">
        <button
          type="button"
          className="w-full flex items-center justify-between px-4 py-3 text-[16px] font-medium"
          style={{ color: "#e91e63" }}
          onClick={() => void logout()}
        >
          退出登录
          <span className="text-red-400">›</span>
        </button>
      </div>

      <TagManager
        open={managerOpen}
        onClose={() => setManagerOpen(false)}
        tags={tags}
        onRefresh={refreshTags}
      />
    </div>
  );
}
