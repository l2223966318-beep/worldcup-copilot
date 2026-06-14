"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, PlugZap, Save, XCircle } from "lucide-react";

type SourceKey = "apiFootball" | "tavily" | "deepseek" | "openai";

type SettingsState = {
  apiFootballKey: string;
  tavilyKey: string;
  deepseekKey: string;
  openaiKey: string;
  manualHotSignals: string;
  useMockData: boolean;
};

const STORAGE_KEY = "worldcup.datasource.settings";

const sourceRows: Array<{ key: SourceKey; label: string; field: keyof SettingsState; hint: string }> = [
  { key: "apiFootball", label: "API-FOOTBALL", field: "apiFootballKey", hint: "用于正式足球赛程、比分、事件和技术统计。" },
  { key: "tavily", label: "Tavily", field: "tavilyKey", hint: "用于全网热点搜索和事件补充。" },
  { key: "deepseek", label: "DeepSeek", field: "deepseekKey", hint: "用于赛事分析、选题和内容生成增强。" },
  { key: "openai", label: "OpenAI", field: "openaiKey", hint: "可作为 DeepSeek 之外的模型配置空间。" }
];

const defaultSettings: SettingsState = {
  apiFootballKey: "",
  tavilyKey: "",
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

  function saveSettings() {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    window.localStorage.setItem("worldcup.manualHotSignals", settings.manualHotSignals);
    window.localStorage.setItem("worldcup.useMockData", String(settings.useMockData));
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1500);
  }

  async function testConnection(row: (typeof sourceRows)[number]) {
    setTesting(row.key);
    const apiKey = String(settings[row.field] ?? "");
    try {
      const response = await fetch("/api/settings/test-source", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: row.key, apiKey })
      });
      const result = (await response.json()) as { ok: boolean; message: string; mode?: string };
      setStatuses((current) => ({ ...current, [row.key]: result }));
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
          API Key 只保存在当前浏览器 localStorage，真实线上调用仍优先读取 Vercel 环境变量。没有 Key 时系统自动进入 demo/mock 模式。
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
                <span className="text-xs font-semibold text-slate-500">API Key</span>
                <input
                  type="password"
                  value={String(settings[row.field] ?? "")}
                  onChange={(event) => updateField(row.field, event.target.value)}
                  placeholder="留空则使用环境变量或 demo 模式"
                  className="mt-2 h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-800 outline-none focus:border-emerald-300 focus:bg-white"
                />
              </label>
              {status ? <p className="mt-3 text-sm text-slate-600">{status.message}</p> : null}
              <button
                type="button"
                onClick={() => void testConnection(row)}
                disabled={testing === row.key}
                className="mt-4 inline-flex h-11 items-center gap-2 rounded-full border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:-translate-y-0.5 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {testing === row.key ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlugZap className="h-4 w-4" />}
                测试连接
              </button>
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
      {status.mode === "demo" ? "demo 模式" : "连接失败"}
    </span>
  );
}
