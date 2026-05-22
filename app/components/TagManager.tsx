import { useState } from "react";
import Modal from "./Modal";
import * as api from "../lib/api";

type TagItem = { id: string; name: string; habit_count: number };

type Props = {
  open: boolean;
  onClose: () => void;
  tags: TagItem[];
  onRefresh: () => void;
};

export default function TagManager({ open, onClose, tags, onRefresh }: Props) {
  const [newTag, setNewTag] = useState("");
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleCreate() {
    const name = newTag.trim();
    if (!name || busy) return;
    setBusy(true);
    try {
      await api.createTag({ name });
      setNewTag("");
      onRefresh();
    } finally {
      setBusy(false);
    }
  }

  async function handleRename(id: string) {
    const name = renameValue.trim();
    if (!name || busy) return;
    setBusy(true);
    try {
      await api.renameTag(id, name);
      setRenaming(null);
      onRefresh();
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id: string) {
    setBusy(true);
    try {
      await api.deleteTag(id);
      setConfirmDelete(null);
      onRefresh();
    } finally {
      setBusy(false);
    }
  }

  function startRename(tag: TagItem) {
    setRenaming(tag.id);
    setRenameValue(tag.name);
  }

  return (
    <Modal
      open={open}
      title="标签管理"
      onClose={onClose}
      footer={
        <div className="flex w-full justify-end">
          <button type="button" className="btn" onClick={onClose}>
            关闭
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="flex gap-2">
          <input
            className="input flex-1 text-[12px]"
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void handleCreate()}
            placeholder="新标签名称"
            maxLength={30}
          />
          <button
            type="button"
            className="btn btn-primary text-[12px]"
            onClick={() => void handleCreate()}
            disabled={!newTag.trim() || busy}
          >
            创建
          </button>
        </div>

        <div className="space-y-1 max-h-64 overflow-y-auto">
          {tags.length === 0 ? (
            <div className="text-[13px] text-muted text-center py-4">暂无标签</div>
          ) : (
            tags.map((t) => (
              <div
                key={t.id}
                className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-warm-white"
              >
                {renaming === t.id ? (
                  <input
                    className="input flex-1 text-[12px]"
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void handleRename(t.id);
                      if (e.key === "Escape") setRenaming(null);
                    }}
                    autoFocus
                    maxLength={30}
                  />
                ) : (
                  <>
                    <span className="flex-1 text-[13px] font-medium text-ink truncate">
                      {t.name}
                    </span>
                    <button
                      type="button"
                      className="text-[11px] text-muted hover:text-accent shrink-0"
                      onClick={() => startRename(t)}
                      title="重命名"
                    >
                      ✏️
                    </button>
                    <button
                      type="button"
                      className="text-[11px] text-muted hover:text-red-500 shrink-0"
                      onClick={() => setConfirmDelete(t.id)}
                      title="删除"
                    >
                      🗑
                    </button>
                  </>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {confirmDelete && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/30">
          <div className="bg-paper rounded-lg border border-line p-4 w-[280px] space-y-3">
            <div className="text-[14px] font-semibold text-ink">确认删除标签</div>
            <div className="text-[13px] text-muted">将清除所有习惯中的此标签，是否继续？</div>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                className="btn text-[12px]"
                onClick={() => setConfirmDelete(null)}
              >
                取消
              </button>
              <button
                type="button"
                className="btn bg-[#ef5350] text-white hover:bg-[#d32f2f] text-[12px] border-none"
                onClick={() => void handleDelete(confirmDelete)}
                disabled={busy}
              >
                删除
              </button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
