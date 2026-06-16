"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { ArrowLeft, CheckCircle2, Clipboard, ExternalLink, Save, ShieldCheck, Sparkles } from "lucide-react";

import type { HotTopic } from "@/lib/hot/types";
import {
  auditHotDraft,
  buildHotAnalysis,
  buildTopicIntro,
  generateHotDraft,
  HOT_RADAR_CACHE_KEY,
  type HotAnalysisResult,
  type HotAuditResult,
  type HotGenerationConfig,
  type HotRadarCache
} from "@/lib/hot/hotTopicWorkflow";
import { formatBeijingDateTime } from "@/lib/time/beijingTime";

const defaultConfig: HotGenerationConfig = {
  platform: "B站",
  contentType: "选题",
  tone: "客观资讯",
  length: "中",
  useMatchFacts: false,
  includeRiskReminder: true
};

const platforms: HotGenerationConfig["platform"][] = ["B站", "微博", "小红书", "抖音", "通用"];
const contentTypes: HotGenerationConfig["contentType"][] = ["选题", "标题", "短文案", "视频脚本", "评论区互动问题", "图文卡片结构"];
const tones: HotGenerationConfig["tone"][] = ["客观资讯", "球迷讨论", "轻松整活", "专业分析"];
const lengths: HotGenerationConfig["length"][] = ["短", "中", "长"];
const SETTINGS_STORAGE_KEY = "worldcup.datasource.settings";

export default function HotTopicDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const rawId = Array.isArray(params.id) ? params.id[0] : params.id;
  const topicId = rawId ? decodeURIComponent(rawId) : "";
  const [topic, setTopic] = useState<HotTopic | null>(null);
  const [cacheMeta, setCacheMeta] = useState<{ lastUpdatedAt?: string; message?: string }>({});
  const [loaded, setLoaded] = useState(false);
  const [config, setConfig] = useState<HotGenerationConfig>(() => ({
    ...defaultConfig,
    contentType: searchParams.get("mode") === "generate" ? "选题" : "选题"
  }));
  const [draft, setDraft] = useState("");
  const [audit, setAudit] = useState<HotAuditResult | null>(null);
  const [copied, setCopied] = useState("");
  const [saved, setSaved] = useState(false);
  const [analysis, setAnalysis] = useState<HotAnalysisResult | null>(null);
  const [topicIntro, setTopicIntro] = useState("");
  const [analysisStatus, setAnalysisStatus] = useState<"idle" | "loading" | "live" | "fallback" | "error">("idle");
  const [analysisMessage, setAnalysisMessage] = useState("");
  const [contentStatus, setContentStatus] = useState<"idle" | "loading" | "live" | "fallback" | "error">("idle");
  const [contentMessage, setContentMessage] = useState("");
  const [auditStatus, setAuditStatus] = useState<"idle" | "loading" | "live" | "fallback" | "error">("idle");
  const [auditMessage, setAuditMessage] = useState("");
  const [deepseekKey, setDeepseekKey] = useState("");

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(HOT_RADAR_CACHE_KEY);
      const cache = raw ? (JSON.parse(raw) as HotRadarCache) : null;
      const found = cache?.topics.find((item) => item.id === topicId) ?? null;
      setTopic(found);
      setCacheMeta({ lastUpdatedAt: cache?.lastUpdatedAt, message: cache?.message });
    } catch {
      setTopic(null);
      setCacheMeta({});
    } finally {
      setLoaded(true);
    }
  }, [topicId]);

  useEffect(() => {
    refreshDeepseekKey(setDeepseekKey);

    function syncKey() {
      refreshDeepseekKey(setDeepseekKey);
    }

    window.addEventListener("focus", syncKey);
    window.addEventListener("storage", syncKey);
    document.addEventListener("visibilitychange", syncKey);

    return () => {
      window.removeEventListener("focus", syncKey);
      window.removeEventListener("storage", syncKey);
      document.removeEventListener("visibilitychange", syncKey);
    };
  }, []);

  const fallbackAnalysis = useMemo(() => (topic ? buildHotAnalysis(topic) : null), [topic]);
  const fallbackIntro = useMemo(() => (topic ? buildTopicIntro(topic) : ""), [topic]);

  useEffect(() => {
    let active = true;
    if (!topic) {
      setAnalysis(null);
      setTopicIntro("");
      setAnalysisStatus("idle");
      setAnalysisMessage("");
      return;
    }

    setAnalysis(fallbackAnalysis);
    setTopicIntro(fallbackIntro);
    setAnalysisStatus("loading");
    setAnalysisMessage("");

    void fetch("/api/ai/hot-topic", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic, apiKey: deepseekKey || undefined })
    })
      .then(async (response) => {
        const payload = (await response.json()) as {
          sourceStatus?: "live" | "fallback" | "error";
          intro?: string;
          analysis?: HotAnalysisResult;
          message?: string;
        };
        if (!active) return;
        setTopicIntro(payload.intro || fallbackIntro);
        setAnalysis(payload.analysis || fallbackAnalysis);
        setAnalysisStatus(payload.sourceStatus === "live" ? "live" : payload.sourceStatus === "fallback" ? "fallback" : "error");
        setAnalysisMessage(payload.message || "");
      })
      .catch((error) => {
        if (!active) return;
        setAnalysis(fallbackAnalysis);
        setTopicIntro(fallbackIntro);
        setAnalysisStatus("error");
        setAnalysisMessage(error instanceof Error ? error.message : "热点分析请求失败。");
      });

    return () => {
      active = false;
    };
  }, [topic, fallbackAnalysis, fallbackIntro, deepseekKey]);

  function updateConfig<Key extends keyof HotGenerationConfig>(key: Key, value: HotGenerationConfig[Key]) {
    setConfig((current) => ({ ...current, [key]: value }));
  }

  async function generateDraft() {
    if (!topic) return;
    const currentDeepseekKey = getStoredDeepseekKey();
    setDeepseekKey(currentDeepseekKey);
    setContentStatus("loading");
    setContentMessage("");
    setAudit(null);
    setAuditStatus("idle");
    setAuditMessage("");
    setAudit(null);
    setSaved(false);
    try {
      const response = await fetch("/api/ai/hot-topic-workflow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "generate",
          topic,
          config,
          apiKey: currentDeepseekKey || undefined
        })
      });
      const payload = (await response.json()) as {
        sourceStatus?: "live" | "fallback" | "error";
        draft?: string;
        message?: string;
      };
      setDraft(payload.draft || generateHotDraft(topic, config));
      setContentStatus(payload.sourceStatus === "live" ? "live" : payload.sourceStatus === "fallback" ? "fallback" : "error");
      setContentMessage(payload.message || "");
    } catch (error) {
      setDraft(generateHotDraft(topic, config));
      setContentStatus("error");
      setContentMessage(error instanceof Error ? error.message : "内容生成失败。");
    }
  }

  async function reviewDraft() {
    if (!topic || !draft.trim()) return;
    const currentDeepseekKey = getStoredDeepseekKey();
    setDeepseekKey(currentDeepseekKey);
    setAuditStatus("loading");
    setAuditMessage("");
    try {
      const response = await fetch("/api/ai/hot-topic-workflow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "audit",
          topic,
          config,
          draft,
          apiKey: currentDeepseekKey || undefined
        })
      });
      const payload = (await response.json()) as {
        sourceStatus?: "live" | "fallback" | "error";
        audit?: HotAuditResult;
        message?: string;
      };
      setAudit(payload.audit || auditHotDraft(draft, topic, config.platform));
      setAuditStatus(payload.sourceStatus === "live" ? "live" : payload.sourceStatus === "fallback" ? "fallback" : "error");
      setAuditMessage(payload.message || "");
    } catch (error) {
      setAudit(auditHotDraft(draft, topic, config.platform));
      setAuditStatus("error");
      setAuditMessage(error instanceof Error ? error.message : "内容审核失败。");
    }
  }

  async function copyText(text: string, key: string) {
    await navigator.clipboard.writeText(text);
    setCopied(key);
    window.setTimeout(() => setCopied(""), 1200);
  }

  function saveDraft() {
    if (!topic || !draft.trim()) return;
    const key = "worldcup.hot-topic-drafts.v1";
    const raw = window.localStorage.getItem(key);
    const list = raw ? JSON.parse(raw) : [];
    list.unshift({
      topicId: topic.id,
      title: topic.title,
      config,
      draft,
      savedAt: new Date().toISOString()
    });
    window.localStorage.setItem(key, JSON.stringify(list.slice(0, 20)));
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1500);
  }

  if (!loaded) {
    return <EmptyCard>正在读取热点缓存...</EmptyCard>;
  }

  if (!topic) {
    return (
      <EmptyCard>
        <div className="text-2xl font-black text-slate-950">暂无该热点缓存</div>
        <p className="mt-3 text-sm leading-6 text-slate-500">请回到首页点击“更新热点”获取最新内容，再进入热点分析与生产页面。</p>
        <Link href="/" className="mt-6 inline-flex h-11 items-center justify-center rounded-full bg-emerald-600 px-5 text-sm font-semibold text-white transition hover:-translate-y-0.5">
          返回首页
        </Link>
      </EmptyCard>
    );
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 pb-16">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/" className="inline-flex h-10 items-center gap-2 rounded-full border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:-translate-y-0.5">
          <ArrowLeft className="h-4 w-4" />
          返回今日机会池
        </Link>
        <div className="text-xs font-semibold text-slate-500">
          {cacheMeta.lastUpdatedAt ? `热点缓存更新时间：${formatBeijingDateTime(cacheMeta.lastUpdatedAt, { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}` : "暂无更新时间"}
        </div>
      </div>

      <section className="overflow-hidden rounded-[36px] border border-emerald-100 bg-gradient-to-br from-emerald-50 via-white to-sky-50 p-7 shadow-[0_24px_80px_rgba(15,23,42,0.08)] lg:p-9">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="max-w-3xl">
            <div className="text-xs font-black tracking-[0.22em] text-emerald-700">热点概览</div>
            <h1 className="mt-4 text-3xl font-black leading-tight text-slate-950 lg:text-5xl">{topic.title}</h1>
            <div className="mt-4 rounded-[24px] border border-emerald-100 bg-white/75 p-4">
              <div className="text-xs font-black tracking-[0.14em] text-slate-400">基本介绍</div>
              <p className="mt-2 max-w-3xl text-base leading-8 text-slate-700">{topicIntro || fallbackIntro}</p>
            </div>
            <div className="mt-6 flex flex-wrap gap-2">
              {topic.category ? <Badge>{topic.category}</Badge> : null}
              {topic.leverageValue ? <Badge strong={topic.valueLevel === "high"}>{topic.leverageValue}</Badge> : null}
              {typeof topic.valueScore === "number" ? <Badge>{`价值分 ${topic.valueScore}`}</Badge> : null}
              {(topic.tags ?? []).slice(0, 6).map((tag) => <Badge key={tag}>{tag}</Badge>)}
            </div>
          </div>
          <div className="min-w-[260px] rounded-[28px] border border-white/80 bg-white/85 p-5 shadow-lg shadow-slate-900/5">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <MetaItem label="来源" value={topic.source} />
              <MetaItem label="平台" value={topic.platform ?? "全网"} />
              <MetaItem label="热度" value={String(topic.heat ?? "-")} />
              <MetaItem label="价值" value={topic.leverageValue ?? "待判断"} />
            </div>
            <div className="mt-4 rounded-2xl bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-500">
              {analysisStatus === "loading" ? "分析引擎：正在生成精炼判断" : analysisStatus === "live" ? "分析引擎：DeepSeek" : "分析引擎：本地规则兜底"}
            </div>
            {topic.url ? (
              <a href={topic.url} target="_blank" rel="noreferrer" className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-full border border-emerald-200 bg-white text-sm font-semibold text-emerald-700 transition hover:-translate-y-0.5">
                查看来源
                <ExternalLink className="h-4 w-4" />
              </a>
            ) : null}
          </div>
        </div>
      </section>

      {analysis ? (
        <section className="grid gap-5 lg:grid-cols-2">
          <Panel title="热点分析">
            <InsightGrid items={analysis.overview} accent="emerald" />
            <DetailBlock title="价值说明" items={analysis.whyCare} compact />
            <DetailBlock title="内容切入" items={analysis.angles} compact />
          </Panel>
          <Panel title="生产判断">
            <InsightGrid items={analysis.production} accent="sky" />
            <DetailBlock title="核验边界" items={analysis.factsToVerify} compact />
            <DetailBlock title="风险提醒" items={analysis.risks} compact />
          </Panel>
        </section>
      ) : null}

      <section className="rounded-[34px] border border-emerald-100 bg-white p-6 shadow-[0_20px_70px_rgba(15,23,42,0.06)]">
        <div className="text-xs font-black tracking-[0.18em] text-emerald-700">选择生产目标</div>
        <h2 className="mt-2 text-3xl font-black text-slate-950">内容生成配置</h2>
        <div className="mt-5 grid gap-4 lg:grid-cols-3">
          <SelectField label="平台" value={config.platform} options={platforms} onChange={(value) => updateConfig("platform", value as HotGenerationConfig["platform"])} />
          <SelectField label="内容类型" value={config.contentType} options={contentTypes} onChange={(value) => updateConfig("contentType", value as HotGenerationConfig["contentType"])} />
          <SelectField label="语气" value={config.tone} options={tones} onChange={(value) => updateConfig("tone", value as HotGenerationConfig["tone"])} />
          <SelectField label="长度" value={config.length} options={lengths} onChange={(value) => updateConfig("length", value as HotGenerationConfig["length"])} />
          <ToggleField label="引用比赛事实" checked={config.useMatchFacts} onChange={(value) => updateConfig("useMatchFacts", value)} />
          <ToggleField label="加入风险提醒" checked={config.includeRiskReminder} onChange={(value) => updateConfig("includeRiskReminder", value)} />
        </div>
        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs leading-6 text-slate-600">
          <div className="font-semibold text-slate-800">AI 调用诊断</div>
          <div>本页检测到的 DeepSeek Key：{deepseekKey ? "已读取" : "未读取"}</div>
          <div>分析状态：{toStatusLabel(analysisStatus)}</div>
          <div>内容生成状态：{toStatusLabel(contentStatus)}</div>
          <div>审核状态：{toStatusLabel(auditStatus)}</div>
        </div>
        <button
          type="button"
          onClick={generateDraft}
          disabled={contentStatus === "loading"}
          className="mt-5 inline-flex h-12 items-center justify-center gap-2 rounded-full bg-emerald-600 px-6 text-sm font-semibold text-white shadow-lg shadow-emerald-200 transition hover:-translate-y-0.5"
        >
          <Sparkles className="h-4 w-4" />
          {contentStatus === "loading" ? "生成中..." : "生成内容"}
        </button>
        <p className="mt-3 text-xs leading-5 text-slate-500">
          {contentStatus === "loading"
            ? "内容引擎正在处理当前热点。"
            : contentStatus === "live"
              ? "内容引擎：DeepSeek 已参与生成。"
              : contentStatus === "fallback"
                ? "内容引擎：当前使用本地兜底模板。"
                : contentStatus === "error"
                  ? `内容引擎异常：${contentMessage || "已改用本地兜底。"}`
                  : "生成前可先调整平台、类型、语气和长度。"}
        </p>
      </section>

      <section className="grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
        <Panel title="生成结果编辑区">
          <textarea
            value={draft}
            onChange={(event) => {
              setDraft(event.target.value);
              setAudit(null);
            }}
            placeholder="点击“生成内容”后，结果会出现在这里。你也可以直接粘贴或手动编辑文案，再一键审核。"
            className="mt-5 min-h-[320px] w-full rounded-[24px] border border-slate-200 bg-slate-50 p-4 text-sm leading-7 text-slate-700 outline-none transition focus:border-emerald-300 focus:bg-white"
          />
          <div className="mt-4 flex flex-wrap gap-3">
            <ActionButton onClick={() => draft && copyText(draft, "draft")} icon={<Clipboard className="h-4 w-4" />}>{copied === "draft" ? "已复制" : "复制"}</ActionButton>
            <ActionButton onClick={generateDraft} icon={<Sparkles className="h-4 w-4" />}>重新生成</ActionButton>
            <ActionButton onClick={saveDraft} icon={<Save className="h-4 w-4" />}>{saved ? "已保存" : "保存草稿"}</ActionButton>
            <ActionButton onClick={reviewDraft} icon={<ShieldCheck className="h-4 w-4" />} primary>{auditStatus === "loading" ? "审核中..." : "一键审核"}</ActionButton>
          </div>
          {contentMessage && contentStatus !== "error" ? <p className="mt-3 text-xs leading-5 text-slate-500">{contentMessage}</p> : null}
        </Panel>

        <Panel title="审核结果">
          {audit ? (
            <div className="mt-5 space-y-5">
              <div className={`inline-flex rounded-full px-4 py-2 text-sm font-black ${audit.level === "pass" ? "bg-emerald-50 text-emerald-700" : audit.level === "revise" ? "bg-amber-50 text-amber-700" : "bg-rose-50 text-rose-700"}`}>
                {audit.level === "pass" ? "可发布" : audit.level === "revise" ? "建议修改" : "不建议发布"}
              </div>
              <DetailBlock title="真实性审核" items={audit.authenticity} />
              <DetailBlock title="风险审核" items={audit.risk} />
              <DetailBlock title="传播伦理审核" items={audit.ethics} />
              <DetailBlock title="平台适配审核" items={audit.platformFit} />
              <DetailBlock title="修改建议" items={audit.suggestions} />
              <div className="rounded-[22px] border border-emerald-100 bg-emerald-50 p-4">
                <div className="text-xs font-black tracking-[0.14em] text-emerald-700">可应用改写</div>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-slate-700">{audit.rewriteSuggestion}</p>
                <button
                  type="button"
                  onClick={() => {
                    setDraft(audit.rewriteSuggestion);
                    setAudit(null);
                  }}
                  className="mt-3 inline-flex h-10 items-center gap-2 rounded-full bg-emerald-600 px-4 text-sm font-semibold text-white transition hover:-translate-y-0.5"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  应用建议
                </button>
              </div>
            </div>
          ) : (
            <p className="mt-5 rounded-[22px] border border-dashed border-slate-200 bg-slate-50 p-6 text-sm leading-7 text-slate-500">
              生成或编辑内容后，点击“一键审核”。系统会检查真实性、表达风险、传播伦理和平台适配，并给出可回填的改写建议。
            </p>
          )}
          <p className="mt-4 text-xs leading-5 text-slate-500">
            {auditStatus === "loading"
              ? "审核引擎正在校验真实性、风险和平台适配。"
              : auditStatus === "live"
                ? "审核引擎：DeepSeek 已参与分析。"
                : auditStatus === "fallback"
                  ? "审核引擎：当前使用本地规则兜底。"
                  : auditStatus === "error"
                    ? `审核引擎异常：${auditMessage || "已改用本地规则。"}`
                    : "未触发审核。"}
          </p>
          {analysisMessage ? <p className="mt-4 text-xs leading-5 text-slate-500">{analysisMessage}</p> : null}
          {auditMessage && auditStatus !== "error" ? <p className="mt-2 text-xs leading-5 text-slate-500">{auditMessage}</p> : null}
          {cacheMeta.message ? <p className="mt-2 text-xs leading-5 text-slate-500">{cacheMeta.message}</p> : null}
        </Panel>
      </section>
    </div>
  );
}

function EmptyCard({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto max-w-5xl rounded-[32px] border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm">
      {children}
    </div>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-[0_18px_60px_rgba(15,23,42,0.05)]">
      <h2 className="text-xl font-black text-slate-950">{title}</h2>
      {children}
    </section>
  );
}

function DetailBlock({ title, items, compact }: { title: string; items: string[]; compact?: boolean }) {
  if (!items.length) return null;
  return (
    <div className="mt-5">
      <div className="text-xs font-black tracking-[0.14em] text-slate-400">{title}</div>
      <ul className={`mt-2 text-sm text-slate-600 ${compact ? "space-y-1.5 leading-6" : "space-y-2 leading-6"}`}>
        {items.map((item) => <li key={item}>· {item}</li>)}
      </ul>
    </div>
  );
}

function InsightGrid({ items, accent }: { items: HotAnalysisResult["overview"]; accent: "emerald" | "sky" }) {
  const styles =
    accent === "emerald"
      ? "border-emerald-100 bg-emerald-50/60 text-emerald-700"
      : "border-sky-100 bg-sky-50/60 text-sky-700";
  return (
    <div className="mt-5 grid gap-3 sm:grid-cols-3">
      {items.map((item) => (
        <div key={`${item.label}-${item.value}`} className={`rounded-[22px] border p-4 ${styles}`}>
          <div className="text-[11px] font-black tracking-[0.14em] text-slate-400">{item.label}</div>
          <div className="mt-2 text-lg font-black text-slate-950">{item.value}</div>
          <p className="mt-2 text-sm leading-6 text-slate-600">{item.note}</p>
        </div>
      ))}
    </div>
  );
}

function SelectField({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="text-xs font-black tracking-[0.12em] text-slate-400">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-700 outline-none transition focus:border-emerald-300 focus:bg-white"
      >
        {options.map((option) => <option key={option}>{option}</option>)}
      </select>
    </label>
  );
}

function ToggleField({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className="flex h-full min-h-12 items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4">
      <span className="text-sm font-semibold text-slate-700">{label}</span>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="h-4 w-4 accent-emerald-600" />
    </label>
  );
}

function ActionButton({ children, icon, primary, onClick }: { children: ReactNode; icon: ReactNode; primary?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm font-semibold transition hover:-translate-y-0.5 ${primary ? "bg-emerald-600 text-white shadow-lg shadow-emerald-100" : "border border-slate-200 bg-white text-slate-700"}`}
    >
      {icon}
      {children}
    </button>
  );
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-3">
      <div className="text-xs font-semibold text-slate-400">{label}</div>
      <div className="mt-1 font-black text-slate-950">{value}</div>
    </div>
  );
}

function Badge({ children, strong }: { children: string | number; strong?: boolean }) {
  return (
    <span className={`rounded-full px-3 py-1.5 text-xs font-semibold ring-1 ${strong ? "bg-amber-50 text-amber-700 ring-amber-200" : "bg-white/85 text-emerald-800 ring-emerald-100"}`}>
      {children}
    </span>
  );
}

function getStoredDeepseekKey() {
  try {
    const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    const settings = raw ? (JSON.parse(raw) as { deepseekKey?: string }) : null;
    return settings?.deepseekKey?.trim() ?? "";
  } catch {
    return "";
  }
}

function refreshDeepseekKey(setter: (value: string) => void) {
  setter(getStoredDeepseekKey());
}

function toStatusLabel(status: "idle" | "loading" | "live" | "fallback" | "error") {
  if (status === "idle") return "未触发";
  if (status === "loading") return "处理中";
  if (status === "live") return "DeepSeek 已调用";
  if (status === "fallback") return "本地兜底";
  return "调用异常";
}
