"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, PlugZap, Save, XCircle } from "lucide-react";

type SourceKey = "tavily" | "topHubData" | "dailyHot" | "xiaohongshu" | "deepseek" | "openai";

type SettingsState = {
  tavilyKey: string;
  topHubDataKey: string;
  dailyHotBaseUrl: string;
  xhsHotUrl: string;
  xhsHotKey: string;
  redfoxApiKey: string;
  redfoxXhsCategory: string;
  deepseekKey: string;
  openaiKey: string;
  manualHotSignals: string;
  useMockData: boolean;
};

const STORAGE_KEY = "worldcup.datasource.settings";
const redfoxXhsCategories = ["综合全部", "影视娱乐", "数码科技", "新闻资讯", "体育锻炼", "日常生活", "休闲爱好", "时尚穿搭", "旅行度假", "美味佳肴"];

const sourceRows: Array<{ key: SourceKey; label: string; field: keyof SettingsState; hint: string }> = [
  { key: "tavily", label: "Tavily", field: "tavilyKey", hint: "用于全网热点搜索和事件补充。" },
  { key: "topHubData", label: "今日热榜 / 榜眼数据", field: "topHubDataKey", hint: "用于接入微博、抖音、B站等热榜数据源。" },
  { key: "dailyHot", label: "DailyHotApi", field: "dailyHotBaseUrl", hint: "用于接入自部署聚合热榜，支持微博、抖音、B站、知乎等，不包含小红书。" },
  { key: "xiaohongshu", label: "小红书热点源", field: "xhsHotKey", hint: "优先接入 RedFox 小红书每日爆款笔记，也保留自定义小红书热榜接口。" },
  { key: "deepseek", label: "DeepSeek", field: "deepseekKey", hint: "用于赛事分析、选题和内容生成增强。" },
  { key: "openai", label: "OpenAI", field: "openaiKey", hint: "可作为 DeepSeek 之外的模型配置空间。" }
];

const defaultSettings: SettingsState = {
  tavilyKey: "",
  topHubDataKey: "",
  dailyHotBaseUrl: "",
  xhsHotUrl: "",
  xhsHotKey: "",
  redfoxApiKey: "",
  redfoxXhsCategory: "体育锻炼",
  deepseekKey: "",
  openaiKey: "",
  manualHotSignals: "美国队乌龙球\n韩国球员球衣被扯破\nVAR 判罚争议",
  useMockData: true
};

export default function SettingsPage() {
  const [settings, setSettings] = useState<SettingsState>(defaultSettings);
  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState<SourceKey | null>(null);
  const [statuses, setStatuses] = useState<Record<string, { ok: boolean; message: string; mode?: string }>>({});

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) setSettings({ ...defaultSettings, ...(JSON.parse(raw) as Partial<SettingsState>) });
    } catch {
      setStatuses((current) => ({ ...current, local: { ok: false, message: "读取本地设置失败，已使用默认配置。" } }));
    }
  }, []);

  function updateField<K extends keyof SettingsState>(field: K, value: SettingsState[K]) {
    setSettings((current) => ({ ...current, [field]: value }));
    setSaved(false);
  }

  function persistSettings(nextSettings: SettingsState) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextSettings));
    window.localStorage.setItem("worldcup.manualHotSignals", nextSettings.manualHotSignals);
    window.localStorage.setItem("worldcup.useMockData", String(nextSettings.useMockData));
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1500);
  }

  function saveSettings() {
    persistSettings(settings);
  }

  async function testConnection(row: (typeof sourceRows)[number]) {
    setTesting(row.key);
    const apiKey = row.key === "dailyHot" ? "" : String(settings[row.field] ?? "");
    try {
      const response = await fetch("/api/settings/test-source", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: row.key,
          apiKey,
          sourceUrl: row.key === "xiaohongshu" ? settings.xhsHotUrl : row.key === "dailyHot" ? settings.dailyHotBaseUrl : undefined,
          redfoxApiKey: row.key === "xiaohongshu" ? settings.redfoxApiKey : undefined,
          redfoxCategory: row.key === "xiaohongshu" ? settings.redfoxXhsCategory : undefined
        })
      });
      const result = (await response.json()) as { ok: boolean; message: string; mode?: string };
      const savedResult = result.ok ? { ...result, message: `${result.message} 已自动保存，可直接回首页搜索。` } : result;
      setStatuses((current) => ({ ...current, [row.key]: savedResult }));
      if (result.ok) persistSettings(settings);
    } catch (error) {
      setStatuses((current) => ({
        ...current,
        [row.key]: { ok: false, message: error instanceof Error ? error.message : "测试连接失败。" }
      }));
    } finally {
      setTesting(null);
    }
  }

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-3xl font-semibold tracking-normal text-slate-950">数据源设置</h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          API Key 只保存在当前浏览器 localStorage。热点搜索会把 Tavily / 今日热榜 Key 临时发给本站服务端转发请求，不会写入代码；没有 Key 时系统自动进入 demo/mock 模式。
        </p>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        {sourceRows.map((row) => {
          const status = statuses[row.key];
          return (
            <div key={row.key} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold text-slate-950">{row.label}</h2>
                  <p className="mt-1 text-sm leading-6 text-slate-500">{row.hint}</p>
                </div>
                <StatusPill status={status} />
              </div>
              <label className="mt-4 block">
                <span className="text-xs font-semibold text-slate-500">
                  {row.key === "xiaohongshu" ? "自定义接口 Key（可选）" : row.key === "dailyHot" ? "Base URL" : "API Key"}
                </span>
                <input
                  type={row.key === "dailyHot" ? "url" : "password"}
                  value={String(settings[row.field] ?? "")}
                  onChange={(event) => updateField(row.field, event.target.value)}
                  placeholder={row.key === "dailyHot" ? "例如：https://your-dailyhot-api.vercel.app" : "留空则使用环境变量或 demo 模式"}
                  className="mt-2 h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-800 outline-none focus:border-emerald-300 focus:bg-white"
                />
              </label>
              {row.key === "dailyHot" ? (
                <p className="mt-3 rounded-2xl bg-slate-50 px-4 py-3 text-xs leading-6 text-slate-600">
                  这里填 DailyHotApi 根地址，系统会读取 /weibo、/douyin、/bilibili 等接口；它不是小红书热点源。
                </p>
              ) : null}
              {row.key === "xiaohongshu" ? (
                <div className="mt-3 space-y-3">
                  <label className="block">
                    <span className="text-xs font-semibold text-slate-500">RedFox API Key</span>
                    <input
                      type="password"
                      value={settings.redfoxApiKey}
                      onChange={(event) => updateField("redfoxApiKey", event.target.value)}
                      placeholder="ak_xxxxxxxx"
                      className="mt-2 h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-800 outline-none focus:border-emerald-300 focus:bg-white"
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs font-semibold text-slate-500">RedFox 小红书分类</span>
                    <select
                      value={settings.redfoxXhsCategory}
                      onChange={(event) => updateField("redfoxXhsCategory", event.target.value)}
                      className="mt-2 h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-800 outline-none focus:border-emerald-300 focus:bg-white"
                    >
                      {redfoxXhsCategories.map((category) => (
                        <option key={category} value={category}>
                          {category}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className="text-xs font-semibold text-slate-500">小红书热点接口 URL（可选）</span>
                    <input
                      value={settings.xhsHotUrl}
                      onChange={(event) => updateField("xhsHotUrl", event.target.value)}
                      placeholder="例如：https://example.com/xhs-hot"
                      className="mt-2 h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-800 outline-none focus:border-emerald-300 focus:bg-white"
                    />
                  </label>
                  <p className="rounded-2xl bg-slate-50 px-4 py-3 text-xs leading-6 text-slate-600">
                    不填自定义 URL 时，系统会使用 RedFox「小红书每日爆款笔记」。
                  </p>
                </div>
              ) : null}
              {status ? <p className="mt-3 text-sm text-slate-600">{status.message}</p> : null}
              <button
                type="button"
                onClick={() => void testConnection(row)}
                disabled={testing === row.key}
                className="mt-4 inline-flex h-11 items-center gap-2 rounded-full border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:-translate-y-0.5 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {testing === row.key ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlugZap className="h-4 w-4" />}
                {testing === row.key ? "测试中..." : "测试连接"}
              </button>
              <div className="mt-3 rounded-2xl bg-slate-50 px-4 py-3 text-xs leading-6 text-slate-600">
                当前模式：{status?.mode === "live" ? "真实接口" : status?.mode === "demo" ? "Mock / Demo" : status?.mode === "error" ? "请求失败" : "未测试"}
                {status?.message ? ` ｜ ${status.message}` : " ｜ 点击测试连接获取状态。"}
              </div>
            </div>
          );
        })}
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-950">手动热点输入与 demo 模式</h2>
            <p className="mt-1 text-sm leading-6 text-slate-500">当热榜 API 不可用时，这些热点事件会进入选题引擎上下文。</p>
          </div>
          <label className="flex items-center gap-2 rounded-full bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700">
            <input
              type="checkbox"
              checked={settings.useMockData}
              onChange={(event) => updateField("useMockData", event.target.checked)}
            />
            启用本地 mock 数据兜底
          </label>
        </div>
        <textarea
          value={settings.manualHotSignals}
          onChange={(event) => updateField("manualHotSignals", event.target.value)}
          className="mt-4 min-h-[160px] w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-7 text-slate-800 outline-none focus:border-emerald-300 focus:bg-white"
          placeholder="每行一个热点事件，例如：乌龙球、球衣被扯破、VAR争议"
        />
        <button
          type="button"
          onClick={saveSettings}
          className="mt-4 inline-flex h-12 items-center gap-2 rounded-full bg-emerald-600 px-5 text-sm font-semibold text-white transition hover:-translate-y-0.5"
        >
          <Save className="h-4 w-4" />
          {saved ? "已保存" : "保存设置"}
        </button>
      </section>
    </div>
  );
}

function StatusPill({ status }: { status?: { ok: boolean; message: string; mode?: string } }) {
  if (!status) {
    return <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">未测试</span>;
  }
  if (status.ok) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
        <CheckCircle2 className="h-3.5 w-3.5" />
        连接成功
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
      <XCircle className="h-3.5 w-3.5" />
      {status.mode === "demo" ? "demo 模式" : status.mode === "error" ? "请求失败" : "连接失败"}
    </span>
  );
}
