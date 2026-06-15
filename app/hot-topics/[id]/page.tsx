"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { ArrowLeft, Clipboard, ExternalLink, Sparkles } from "lucide-react";

import type { HotTopic } from "@/lib/hot/types";
import {
  buildWhyCare,
  generateHotTopicPackage,
  HOT_RADAR_CACHE_KEY,
  packageLabel,
  type HotRadarCache
} from "@/lib/hot/hotTopicWorkflow";
import { formatBeijingDateTime } from "@/lib/time/beijingTime";

export default function HotTopicDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const rawId = Array.isArray(params.id) ? params.id[0] : params.id;
  const topicId = rawId ? decodeURIComponent(rawId) : "";
  const [topic, setTopic] = useState<HotTopic | null>(null);
  const [cacheMeta, setCacheMeta] = useState<{ lastUpdatedAt?: string; message?: string }>({});
  const [loaded, setLoaded] = useState(false);
  const [showPackage, setShowPackage] = useState(searchParams.get("mode") === "generate");
  const [copied, setCopied] = useState("");

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

  const packageData = useMemo(() => {
    if (!topic || !showPackage) return null;
    return generateHotTopicPackage(topic, topic.relatedMatches?.[0] ?? "今日世界杯比赛");
  }, [showPackage, topic]);

  async function copyText(text: string, key: string) {
    await navigator.clipboard.writeText(text);
    setCopied(key);
    window.setTimeout(() => setCopied(""), 1200);
  }

  if (!loaded) {
    return (
      <div className="mx-auto max-w-5xl rounded-[32px] border border-slate-200 bg-white p-10 text-slate-600 shadow-sm">
        正在读取热点缓存...
      </div>
    );
  }

  if (!topic) {
    return (
      <div className="mx-auto max-w-5xl rounded-[32px] border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm">
        <div className="text-2xl font-black text-slate-950">暂无该热点缓存</div>
        <p className="mt-3 text-sm leading-6 text-slate-500">请回到首页点击“更新热点”获取最新内容，再进入热点分析与生产页面。</p>
        <Link href="/" className="mt-6 inline-flex h-11 items-center justify-center rounded-full bg-emerald-600 px-5 text-sm font-semibold text-white transition hover:-translate-y-0.5">
          返回首页
        </Link>
      </div>
    );
  }

  const whyCare = buildWhyCare(topic);
  const relatedMatches = topic.relatedMatches?.length ? topic.relatedMatches : ["暂无强关联赛事，可作为泛体育热点观察"];
  const contentAngles = topic.contentAngles?.length ? topic.contentAngles : ["先核实来源，再判断是否适合转化为赛事复盘、平台话题或短视频钩子。"];

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
            <div className="text-xs font-black uppercase tracking-[0.22em] text-emerald-700">HOT TOPIC WORKFLOW</div>
            <h1 className="mt-4 text-3xl font-black leading-tight text-slate-950 lg:text-5xl">{topic.title}</h1>
            <p className="mt-4 text-base leading-8 text-slate-600">{topic.summary || "该热点暂无摘要，建议结合来源链接人工确认背景后再生产内容。"}</p>
          </div>
          <div className="min-w-[240px] rounded-[28px] border border-white/80 bg-white/85 p-5 shadow-lg shadow-slate-900/5">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <MetaItem label="来源" value={topic.source} />
              <MetaItem label="平台" value={topic.platform ?? "全网"} />
              <MetaItem label="热度" value={String(topic.heat ?? topic.relevanceScore ?? "-")} />
              <MetaItem label="价值" value={topic.leverageValue ?? "待判断"} />
            </div>
            {topic.url ? (
              <a href={topic.url} target="_blank" rel="noreferrer" className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-full border border-emerald-200 bg-white text-sm font-semibold text-emerald-700 transition hover:-translate-y-0.5">
                查看来源
                <ExternalLink className="h-4 w-4" />
              </a>
            ) : null}
          </div>
        </div>
        <div className="mt-6 flex flex-wrap gap-2">
          {topic.category ? <Badge>{topic.category}</Badge> : null}
          {(topic.tags ?? []).map((tag) => <Badge key={tag}>{tag}</Badge>)}
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
        <Panel title="热点分析">
          <DetailBlock title="为什么值得关注" items={whyCare} />
          <DetailBlock title="与世界杯/体育内容的关联方式" items={[
            topic.category === "世界杯" || topic.category === "体育"
              ? "它和赛事语境直接相关，可以作为选题判断的主素材。"
              : "它属于泛热点，需要先找到和球队、球员、赛事情绪或传播场景的连接点。",
            "建议把热点当作内容入口，正文仍回到比赛事实、数据或公开来源。"
          ]} />
          <DetailBlock title="可借势内容方向" items={contentAngles} />
        </Panel>

        <Panel title="生产入口">
          <DetailBlock title="推荐关联赛事" items={relatedMatches} />
          <DetailBlock title="适合平台" items={["微博：承接即时讨论", "B站：做事件复盘和观点解释", "小红书：做新手看球卡片", "短视频：用前三秒热点钩子切入"]} />
          <button
            type="button"
            onClick={() => setShowPackage(true)}
            className="mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-emerald-600 px-5 text-sm font-semibold text-white shadow-lg shadow-emerald-200 transition hover:-translate-y-0.5"
          >
            <Sparkles className="h-4 w-4" />
            生成热点内容方案
          </button>
          {cacheMeta.message ? <p className="mt-3 text-xs leading-5 text-slate-500">{cacheMeta.message}</p> : null}
        </Panel>
      </section>

      {packageData ? (
        <section className="rounded-[34px] border border-emerald-100 bg-white p-6 shadow-[0_20px_70px_rgba(15,23,42,0.06)]">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">CONTENT PACKAGE</div>
              <h2 className="mt-2 text-3xl font-black text-slate-950">热点选题与平台生产包</h2>
            </div>
            <button
              type="button"
              onClick={() => copyText(Object.entries(packageData).map(([key, lines]) => `## ${packageLabel(key)}\n${lines.map((line) => `- ${line}`).join("\n")}`).join("\n\n"), "all")}
              className="inline-flex h-10 items-center gap-2 rounded-full border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:-translate-y-0.5"
            >
              <Clipboard className="h-4 w-4" />
              {copied === "all" ? "已复制" : "复制全部"}
            </button>
          </div>
          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            {Object.entries(packageData).map(([key, lines]) => (
              <div key={key} className="rounded-[26px] border border-slate-200 bg-slate-50 p-5">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-base font-black text-slate-950">{packageLabel(key)}</div>
                  <button
                    type="button"
                    onClick={() => copyText(lines.join("\n"), key)}
                    className="text-xs font-semibold text-emerald-700"
                  >
                    {copied === key ? "已复制" : "复制"}
                  </button>
                </div>
                <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
                  {lines.map((line) => <li key={line}>· {line}</li>)}
                </ul>
              </div>
            ))}
          </div>
        </section>
      ) : null}
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

function DetailBlock({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div className="mt-5">
      <div className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">{title}</div>
      <ul className="mt-2 space-y-2 text-sm leading-6 text-slate-600">
        {items.map((item) => <li key={item}>· {item}</li>)}
      </ul>
    </div>
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

function Badge({ children }: { children: string | number }) {
  return (
    <span className="rounded-full bg-white/85 px-3 py-1.5 text-xs font-semibold text-emerald-800 ring-1 ring-emerald-100">
      {children}
    </span>
  );
}
