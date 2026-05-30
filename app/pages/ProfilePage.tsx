import { useEffect, useState } from "react";

import { useAuth } from "../auth/AuthContext";
import {
  ApiError,
  updateName,
  updateEmail,
  updatePassword,
  getApiKey,
  generateApiKey,
  getNotificationSettings,
  updateNotificationSettings,
  sendTestNotification,
} from "../lib/api";
import type { NotificationSettings } from "../lib/api";

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

  // 通知设置状态
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>({});
  const [notificationStatus, setNotificationStatus] = useState<
    "idle" | "saving" | "done" | "error"
  >("idle");
  const [testStatus, setTestStatus] = useState<"idle" | "sending" | "success" | "error">("idle");
  const [testError, setTestError] = useState("");

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

  async function loadNotificationSettings() {
    try {
      const settings = await getNotificationSettings();
      setNotificationSettings(settings);
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

  async function handleSaveNotificationSettings() {
    setNotificationStatus("saving");
    try {
      await updateNotificationSettings(notificationSettings);
      setNotificationStatus("done");
      setTimeout(() => setNotificationStatus("idle"), 2000);
    } catch (e) {
      setNotificationStatus("error");
      setErrorMsg(e instanceof ApiError ? e.code : "保存失败，请重试");
    }
  }

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
        e instanceof ApiError ? (e.code === "EMAIL_IN_USE" ? "该邮箱已被占用" : e.code) : "保存失败"
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
    void loadNotificationSettings();
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

      {/* 通知设置 */}
      <div className="paper p-5 mb-3">
        <div className="label mb-4">通知设置</div>

        {/* 飞书 Webhook URL */}
        <div className="mb-4">
          <label className="text-[13px] text-ink mb-1.5 block">飞书 Webhook URL</label>
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
              className="input flex-1"
            />
            <button
              type="button"
              onClick={() => void handleTestNotification()}
              disabled={
                !notificationSettings.feishu_webhook ||
                testStatus === "sending" ||
                testStatus === "success"
              }
              className="btn text-[12px] px-3.5 py-1.5"
            >
              {testStatus === "sending" ? "发送中..." : "测试"}
            </button>
          </div>
          {testStatus === "success" && (
            <p className="text-[12px] text-green-600 mt-1.5">测试通知发送成功！</p>
          )}
          {testStatus === "error" && (
            <p className="text-[12px] text-red-500 mt-1.5">发送失败：{testError}</p>
          )}
        </div>

        {/* 每日提醒 */}
        <div className="mb-4 rounded-lg bg-warm-white p-3.5">
          <div className="flex items-center justify-between mb-2">
            <label className="text-[13px] text-ink">每日习惯提醒</label>
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
            <select
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
              className="input"
            >
              {Array.from({ length: 24 }, (_, i) => (
                <option key={i} value={`${i.toString().padStart(2, "0")}:00`}>
                  {i.toString().padStart(2, "0")}:00
                </option>
              ))}
            </select>
          )}
        </div>

        {/* 每周报告 */}
        <div className="mb-4 rounded-lg bg-warm-white p-3.5">
          <div className="flex items-center justify-between mb-2">
            <label className="text-[13px] text-ink">每周统计报告</label>
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
                className="input"
              >
                <option value={1}>周一</option>
                <option value={2}>周二</option>
                <option value={3}>周三</option>
                <option value={4}>周四</option>
                <option value={5}>周五</option>
                <option value={6}>周六</option>
                <option value={0}>周日</option>
              </select>
              <select
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
                className="input"
              >
                {Array.from({ length: 24 }, (_, i) => (
                  <option key={i} value={`${i.toString().padStart(2, "0")}:00`}>
                    {i.toString().padStart(2, "0")}:00
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* 每月报告 */}
        <div className="mb-4 rounded-lg bg-warm-white p-3.5">
          <div className="flex items-center justify-between mb-2">
            <label className="text-[13px] text-ink">每月统计报告</label>
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
                className="input"
              >
                {Array.from({ length: 31 }, (_, i) => (
                  <option key={i + 1} value={i + 1}>
                    {i + 1} 日
                  </option>
                ))}
              </select>
              <select
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
                className="input"
              >
                {Array.from({ length: 24 }, (_, i) => (
                  <option key={i} value={`${i.toString().padStart(2, "0")}:00`}>
                    {i.toString().padStart(2, "0")}:00
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* 保存按钮 */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void handleSaveNotificationSettings()}
            disabled={notificationStatus === "saving"}
            className="btn btn-primary text-[12px] px-3.5 py-1.5"
          >
            {notificationStatus === "saving" ? "保存中..." : "保存通知设置"}
          </button>
          {notificationStatus === "done" && (
            <span className="text-[12px] text-green-600">保存成功！</span>
          )}
          {notificationStatus === "error" && (
            <span className="text-[12px] text-red-500">保存失败，请重试</span>
          )}
        </div>
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
