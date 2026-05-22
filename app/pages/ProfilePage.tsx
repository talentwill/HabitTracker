import { useEffect, useState } from "react";

import { useAuth } from "../auth/AuthContext";
import {
  ApiError,
  updateName,
  updateEmail,
  updatePassword,
  getApiKey,
  generateApiKey,
} from "../lib/api";

export default function ProfilePage() {
  const { user, logout, refresh } = useAuth();

  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [nameStatus, setNameStatus] = useState<"idle" | "saving" | "done" | "error">("idle");
  const [emailStatus, setEmailStatus] = useState<"idle" | "saving" | "done" | "error">("idle");
  const [passwordStatus, setPasswordStatus] = useState<"idle" | "saving" | "done" | "error">(
    "idle"
  );
  const [errorMsg, setErrorMsg] = useState("");
  const [apiKeyInfo, setApiKeyInfo] = useState<{
    hasKey: boolean;
    apiKey: string | null;
    createdAt: string | null;
  } | null>(null);
  const [apiKeyLoading, setApiKeyLoading] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  function clearError() {
    setErrorMsg("");
  }

  async function loadApiKey() {
    try {
      const info = await getApiKey();
      setApiKeyInfo(info);
    } catch {
      /* ignore */
    }
  }

  async function handleGenerateApiKey() {
    setApiKeyLoading(true);
    clearError();
    try {
      const result = await generateApiKey();
      setNewKey(result.apiKey);
      setApiKeyInfo({ hasKey: true, apiKey: null, createdAt: result.createdAt });
      setShowConfirm(false);
    } catch (e) {
      setErrorMsg(e instanceof ApiError ? e.code : "生成失败");
    } finally {
      setApiKeyLoading(false);
    }
  }

  function handleCopy() {
    if (newKey) {
      navigator.clipboard.writeText(newKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  async function handleSaveName() {
    clearError();
    if (name.length > 50) {
      setErrorMsg("用户名不能超过 50 个字符");
      return;
    }
    setNameStatus("saving");
    try {
      await updateName(name);
      await refresh();
      setNameStatus("done");
      setTimeout(() => setNameStatus("idle"), 2000);
    } catch (e) {
      setNameStatus("error");
      setErrorMsg(e instanceof ApiError ? e.code : "保存失败");
    }
  }

  async function handleSaveEmail() {
    clearError();
    if (!email.includes("@")) {
      setErrorMsg("请输入有效的邮箱地址");
      return;
    }
    setEmailStatus("saving");
    try {
      await updateEmail(email);
      setEmailStatus("done");
      setTimeout(() => void logout(), 1000);
    } catch (e) {
      setEmailStatus("error");
      setErrorMsg(
        e instanceof ApiError
          ? (e as any).code === "EMAIL_IN_USE"
            ? "该邮箱已被占用"
            : e.code
          : "保存失败"
      );
    }
  }

  async function handleSavePassword() {
    clearError();
    if (password.length < 6) {
      setErrorMsg("密码至少 6 位");
      return;
    }
    if (password !== confirmPassword) {
      setErrorMsg("两次密码输入不一致");
      return;
    }
    setPasswordStatus("saving");
    try {
      await updatePassword(password);
      setPasswordStatus("done");
      setTimeout(() => void logout(), 1000);
    } catch (e) {
      setPasswordStatus("error");
      setErrorMsg(e instanceof ApiError ? e.code : "保存失败");
    }
  }

  useEffect(() => {
    void loadApiKey();
  }, []);

  return (
    <div className="pb-20 max-w-lg mx-auto">
      <h1 className="section-title mb-5">个人信息</h1>

      {errorMsg && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-2.5 text-[13px] text-red-600">
          {errorMsg}
        </div>
      )}

      {/* 用户名 */}
      <div className="paper p-5 mb-3">
        <div className="flex items-center justify-between mb-3">
          <div className="label">用户名</div>
          <button
            type="button"
            disabled={nameStatus === "saving"}
            onClick={() => void handleSaveName()}
            className="btn btn-primary text-[12px] px-3.5 py-1.5"
          >
            {nameStatus === "saving" ? "保存中…" : nameStatus === "done" ? "已保存 ✓" : "保存"}
          </button>
        </div>
        <input
          type="text"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            clearError();
          }}
          placeholder="输入用户名"
          className="input"
        />
      </div>

      {/* 邮箱 */}
      <div className="paper p-5 mb-3">
        <div className="flex items-center justify-between mb-1">
          <div className="label">邮箱</div>
          <button
            type="button"
            disabled={emailStatus === "saving"}
            onClick={() => void handleSaveEmail()}
            className="btn btn-primary text-[12px] px-3.5 py-1.5"
          >
            {emailStatus === "saving" ? "保存中…" : "保存"}
          </button>
        </div>
        <div className="text-[12px] text-muted mb-3">修改后需要重新登录</div>
        <input
          type="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            clearError();
          }}
          className="input"
        />
      </div>

      {/* 密码 */}
      <div className="paper p-5 mb-3">
        <div className="flex items-center justify-between mb-1">
          <div className="label">密码</div>
          <button
            type="button"
            disabled={passwordStatus === "saving"}
            onClick={() => void handleSavePassword()}
            className="btn btn-primary text-[12px] px-3.5 py-1.5"
          >
            {passwordStatus === "saving" ? "保存中…" : "保存"}
          </button>
        </div>
        <div className="text-[12px] text-muted mb-3">修改后需要重新登录</div>
        <div className="space-y-2.5">
          <input
            type="password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              clearError();
            }}
            placeholder="新密码（至少 6 位）"
            className="input"
          />
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => {
              setConfirmPassword(e.target.value);
              clearError();
            }}
            placeholder="确认新密码"
            className="input"
          />
        </div>
      </div>

      {/* API Key */}
      <div className="paper p-5 mb-3">
        <div className="flex items-center justify-between mb-1">
          <div className="label">API Key</div>
          {!showConfirm && (
            <button
              type="button"
              disabled={apiKeyLoading}
              onClick={() => setShowConfirm(true)}
              className="btn text-[12px] px-3.5 py-1.5"
            >
              {apiKeyInfo?.hasKey ? "重新生成" : "生成"}
            </button>
          )}
        </div>
        <div className="text-[12px] text-muted mb-3">用于 iOS 快捷指令等外部工具打卡</div>

        {apiKeyInfo?.hasKey ? (
          <div className="mb-3 rounded-lg bg-warm-white px-3.5 py-2.5">
            <div className="text-[13px] text-ink font-mono">
              {apiKeyInfo.apiKey ?? "••••••••••••"}
            </div>
            {apiKeyInfo.createdAt && (
              <div className="text-[11px] text-muted mt-1">
                创建于 {new Date(apiKeyInfo.createdAt).toLocaleDateString()}
              </div>
            )}
          </div>
        ) : (
          <div className="text-[13px] text-muted mb-3">未生成</div>
        )}

        {showConfirm && (
          <div className="flex items-center gap-2">
            <span className="text-[12px] text-red-500">
              {apiKeyInfo?.hasKey ? "重新生成会使旧 Key 失效，" : ""}确认生成？
            </span>
            <button
              type="button"
              className="btn btn-primary text-[12px] px-3 py-1"
              disabled={apiKeyLoading}
              onClick={() => void handleGenerateApiKey()}
            >
              确认
            </button>
            <button
              type="button"
              className="btn text-[12px] px-3 py-1"
              onClick={() => setShowConfirm(false)}
            >
              取消
            </button>
          </div>
        )}

        {newKey && (
          <div className="mt-3 rounded-lg bg-yellow-50 border border-yellow-200 p-3.5">
            <div className="text-[12px] text-yellow-700 mb-1.5">
              请立即复制，关闭后无法再查看完整 Key
            </div>
            <div className="flex items-center gap-2">
              <code className="text-[12px] text-ink break-all flex-1">{newKey}</code>
              <button
                type="button"
                className="btn text-[11px] px-2.5 py-1 shrink-0"
                onClick={handleCopy}
              >
                {copied ? "已复制 ✓" : "复制"}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 退出登录 */}
      <div className="paper p-5">
        <div className="flex items-center justify-between">
          <div>
            <div className="label mb-0.5">账户</div>
            <div className="text-[12px] text-muted">退出当前登录状态</div>
          </div>
          <button
            type="button"
            className="btn text-[12px] px-3.5 py-1.5 border border-red-200 text-red-500 hover:bg-red-50"
            onClick={() => void logout()}
          >
            退出登录
          </button>
        </div>
      </div>
    </div>
  );
}
