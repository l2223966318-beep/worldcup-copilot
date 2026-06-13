"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Check,
  Clipboard,
  Download,
  RefreshCcw,
  ShieldAlert,
  Sparkles,
  TrendingUp
} from "lucide-react";

import { InsightCharts } from "@/components/worldcup/insight-charts";
import type { MatchData } from "@/data/matches";
import { generatePlatformContent, type PlatformContent } from "@/lib/ai/content";
import { reviewRisk } from "@/lib/ai/risk";
import { extractMatchSignals, type MatchSignal } from "@/lib/ai/signals";
import { generateTopics, type TopicIdea } from "@/lib/ai/topics";
import { copyToClipboard, downloadTextFile } from "@/lib/download";
import { analyzeMatch, getMatchDetail } from "@/lib/project-api";
import { worldCupMatchToMatchData } from "@/lib/sports/adapters";
import { useWorldCupQuery } from "@/lib/sports/client";
import type { SourceStatus, WorldCupMatch, WorldCupPayload } from "@/lib/sports/types";
import { getMatchSportType, getSportTheme, type SportTheme } from "@/lib/sport-theme";

const platformLabels = {
  bilibili: "B站",
  weibo: "微博",
  xiaohongshu: "小红书",
  article: "公众号"
} as const;

type PlatformKey = keyof typeof platformLabels;

type OpportunityScores = {
  heat: number;
  emotion: number;
  narrative: number;
  longTail: number;
};

type AiWorkflowEnhancement = {
  workflowVersion?: "platform-content-v1";
  sourceStatus: "live" | "fallback" | "error";
  model?: string;
  message?: string;
  conclusions: Array<{ title: string; body: string; featured?: boolean }>;
  topics: TopicIdea[];
  platformContent?: PlatformContent;
};

const platformMeta: Record<PlatformKey, { title: string; positioning: string; action: string }> = {
  bilibili: { title: "B站", positioning: "深度视频、人物复盘、战术复盘", action: "生成 B站脚本" },
  weibo: { title: "微博", positioning: "热点讨论、话题扩散、情绪传播", action: "生成微博话题" },
  xiaohongshu: { title: "小红书", positioning: "图文收藏、新手看球解释、轻表达", action: "生成小红书图文" },
  article: { title: "公众号", positioning: "深度评论、历史纵深、长文沉淀", action: "生成公众号长文" }
};

export default function MatchAnalysisPage() {
  const params = useParams<{ id: string }>();
  const fixtureId = params.id;
  const { payload, loading, error } = useWorldCupQuery<WorldCupMatch>(
    `/api/worldcup/matches/${fixtureId}`,
    matchRefreshPolicy
  );
  const sourceMatch = payload?.data;
  const fallbackMatch = getMatchDetail(fixtureId);
  const match = useMemo(() => (sourceMatch ? worldCupMatchToMatchData(sourceMatch) : fallbackMatch), [fallbackMatch, sourceMatch]);
  const theme = getSportTheme(getMatchSportType(match.id));
  const analysis = useMemo(() => analyzeMatch(match), [match]);
  const matchSignals = useMemo(() => extractMatchSignals(match), [match]);
  const baselineTopics = useMemo(() => generateTopics(match).slice(0, 3), [match]);
  const [aiEnhancement, setAiEnhancement] = useState<AiWorkflowEnhancement | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const topics = aiEnhancement?.sourceStatus === "live" && aiEnhancement.topics.length ? aiEnhancement.topics : baselineTopics;
  const [selectedTopicId, setSelectedTopicId] = useState(topics[0]?.id);
  const selectedTopic = topics.find((topic) => topic.id === selectedTopicId) ?? topics[0];
  const workflow = useMemo(() => buildMatchWorkflow(match, topics[0], analysis, aiEnhancement), [aiEnhancement, analysis, match, topics]);
  const [activePlatform, setActivePlatform] = useState<PlatformKey>("bilibili");
  const [copied, setCopied] = useState<string | null>(null);
  const [rewriteApplied, setRewriteApplied] = useState<string | null>(null);

  const localContent = useMemo(() => generatePlatformContent(match, selectedTopic), [match, selectedTopic]);
  const content = useMemo(() => {
    const aiPrimaryTopicId = aiEnhancement?.topics[0]?.id;
    if (aiEnhancement?.sourceStatus === "live" && aiEnhancement.platformContent && selectedTopic.id === aiPrimaryTopicId) {
      return aiEnhancement.platformContent;
    }

    return localContent;
  }, [aiEnhancement, localContent, selectedTopic.id]);
  const selectedText = useMemo(() => buildSelectedContent(content, ["bilibili", "weibo", "xiaohongshu", "article"]), [content]);
  const risk = useMemo(() => reviewRisk(selectedText), [selectedText]);
  const markdown = useMemo(() => buildMarkdown(match.name, selectedTopic, content, risk.advice), [content, match.name, risk.advice, selectedTopic]);

  useEffect(() => {
    const controller = new AbortController();
    setAiEnhancement(null);
    setAiLoading(true);

    fetch("/api/ai/match-workflow", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ match, baselineTopics }),
      signal: controller.signal
    })
      .then((response) => response.json())
      .then((payload: AiWorkflowEnhancement) => {
        if (!controller.signal.aborted) setAiEnhancement(payload);
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          setAiEnhancement({
            sourceStatus: "error",
            conclusions: [],
            topics: [],
            message: error instanceof Error ? error.message : "AI workflow request failed."
          });
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setAiLoading(false);
      });

    return () => controller.abort();
  }, [baselineTopics, match]);

  useEffect(() => {
    if (!topics.some((topic) => topic.id === selectedTopicId)) {
      setSelectedTopicId(topics[0]?.id);
    }
  }, [selectedTopicId, topics]);

  async function handleCopy(key: string, value: string) {
    await copyToClipboard(value);
    setCopied(key);
    window.setTimeout(() => setCopied(null), 1600);
  }

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-8 pb-20">
      <Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 transition hover:text-slate-950">
        <ArrowLeft className="h-4 w-4" />
        返回今日赛事机会池
      </Link>

      <MatchHero
        matchName={match.name}
        match={match}
        primaryTopic={topics[0]}
        taskPriority={workflow.priority}
        scores={workflow.scores}
        theme={theme}
        sourceMatch={sourceMatch}
        sourceStatus={payload?.sourceStatus ?? "fallback"}
        lastUpdated={payload?.lastUpdated}
        loading={loading}
        error={error}
      />

      <AiBrainStatus loading={aiLoading} enhancement={aiEnhancement} theme={theme} />

      <section>
        <SectionTitle eyebrow="OPS CONCLUSION" title="运营结论" description="让运营人员 10 秒内知道这场比赛值不值得做、先做什么、要避开什么坑。" />
        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          {workflow.conclusions.map((item) => (
            <ConclusionCard key={item.title} title={item.title} body={item.body} theme={theme} featured={item.featured} />
          ))}
        </div>
      </section>

      <section className="rounded-[32px] border bg-white p-6 shadow-[0_20px_70px_rgba(15,23,42,0.06)]" style={{ borderColor: theme.border }}>
        <SectionTitle eyebrow="DATA TO ANGLE" title="核心数据如何转成内容角度" description="数据不是为了摆出来，而是帮助运营判断这场比赛应该怎么讲。" />
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {workflow.dataAngles.map((item) => (
            <DataAngleCard key={item.label} {...item} theme={theme} />
          ))}
        </div>
      </section>

      <section className="rounded-[32px] border bg-white p-6 shadow-[0_20px_70px_rgba(15,23,42,0.06)]" style={{ borderColor: theme.border }}>
        <SectionTitle eyebrow="CHART INSIGHTS" title="图表服务内容创作" description="每张图表都配运营解释和可复制金句，用来快速变成脚本、标题或长文段落。" />
        <div className="mt-6">
          <InsightCharts match={match} theme={theme} />
        </div>
      </section>

      <section className="rounded-[32px] border bg-white p-6 shadow-[0_20px_70px_rgba(15,23,42,0.06)]" style={{ borderColor: theme.border }}>
        <SectionTitle eyebrow="FIELD SIGNALS" title="场上热点信号" description="选题不只来自比分和技术统计，更优先来自能被观众记住、讨论和转发的场上瞬间。" />
        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          {matchSignals.slice(0, 6).map((signal) => (
            <MatchSignalCard
              key={signal.id}
              signal={signal}
              theme={theme}
              copied={copied === `signal-${signal.id}`}
              onCopy={() => handleCopy(`signal-${signal.id}`, signal.topicSeed)}
            />
          ))}
        </div>
      </section>

      <section>
        <SectionTitle eyebrow="TOPIC ENGINE" title="内容角度推荐" description="先判断这场球值不值得做，再决定优先发到哪里。" />
        <div className="mt-6 grid gap-5 lg:grid-cols-[1.15fr_0.85fr_0.85fr]">
          {topics.map((topic, index) => (
            <TopicRecommendationCard
              key={topic.id}
              topic={topic}
              theme={theme}
              featured={index === 0}
              selected={selectedTopic.id === topic.id}
              onSelect={() => setSelectedTopicId(topic.id)}
              onCopy={() => handleCopy(`topic-${topic.id}`, topic.title)}
              copied={copied === `topic-${topic.id}`}
            />
          ))}
        </div>
      </section>

      <section className="rounded-[32px] border bg-white p-6 shadow-[0_20px_70px_rgba(15,23,42,0.06)]" style={{ borderColor: theme.border }}>
        <SectionTitle eyebrow="PLATFORM OUTPUT" title="多平台分发工作台" description="平台不是换皮，B站、微博、小红书、公众号有不同的内容任务。" />
        <div className="mt-6 grid gap-4 lg:grid-cols-4">
          {(Object.keys(platformLabels) as PlatformKey[]).map((platform) => (
            <PlatformOutputCard
              key={platform}
              platform={platform}
              active={activePlatform === platform}
              theme={theme}
              onClick={() => setActivePlatform(platform)}
            />
          ))}
        </div>
        <PlatformPreview
          className="mt-5"
          platform={activePlatform}
          content={content}
          theme={theme}
          copied={copied}
          onCopy={handleCopy}
          onExport={() => downloadTextFile(`${match.id}-${activePlatform}.md`, buildPlatformMarkdown(activePlatform, content), "text/markdown;charset=utf-8")}
          onRegenerate={() => {
            setCopied("regen");
            window.setTimeout(() => setCopied(null), 1200);
          }}
        />
      </section>

      <section className="rounded-[32px] border bg-white p-6 shadow-[0_20px_70px_rgba(15,23,42,0.06)]" style={{ borderColor: theme.border }}>
        <SectionTitle eyebrow="RISK REVIEW" title="发布风险审稿" description="风险提示清楚但不过度吓人，重点给运营可执行的稳妥表达。" />
        <div className="mt-6 grid gap-4 lg:grid-cols-5">
          {workflow.risks.map(({ title, level, advice }) => (
            <RiskCard
              key={title}
              title={title}
              level={level}
              advice={advice}
              applied={rewriteApplied === title}
              onApply={() => {
                setRewriteApplied(title);
                window.setTimeout(() => setRewriteApplied(null), 1600);
              }}
            />
          ))}
        </div>
      </section>

      <section className="flex flex-wrap items-center justify-between gap-4 rounded-[32px] border bg-white p-6 shadow-[0_20px_70px_rgba(15,23,42,0.06)]" style={{ borderColor: theme.border }}>
        <div>
          <h2 className="text-2xl font-semibold text-slate-950">复制 / 导出</h2>
          <p className="mt-1 text-sm text-slate-500">完成平台预览和风险审稿后，再导出给运营执行。</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <ActionButton onClick={() => handleCopy("all", selectedText)} theme={theme} variant="secondary">
            <Clipboard className="h-4 w-4" />
            {copied === "all" ? "已复制全部" : "复制全部内容"}
          </ActionButton>
          <ActionButton onClick={() => downloadTextFile(`${match.id}-content-report.md`, markdown, "text/markdown;charset=utf-8")} theme={theme}>
            <Download className="h-4 w-4" />
            导出 Markdown 报告
          </ActionButton>
        </div>
      </section>
    </div>
  );
}

function MatchHero({
  matchName,
  match,
  primaryTopic,
  taskPriority,
  scores,
  theme,
  sourceMatch,
  sourceStatus,
  lastUpdated,
  loading,
  error
}: {
  matchName: string;
  match: MatchData;
  primaryTopic: TopicIdea;
  taskPriority: string;
  scores: OpportunityScores;
  theme: SportTheme;
  sourceMatch?: WorldCupMatch;
  sourceStatus: SourceStatus;
  lastUpdated?: string;
  loading?: boolean;
  error?: string;
}) {
  const homeTeam = sourceMatch?.homeTeam.name ?? match.teamA;
  const awayTeam = sourceMatch?.awayTeam.name ?? match.teamB;
  const score = sourceMatch?.score.display ?? match.score;
  const round = sourceMatch?.round ?? match.stage;
  const statusText = sourceMatch?.statusText ?? (match.isExample ? "经典样例" : "真实数据");
  const kickoffTime = sourceMatch?.kickoffTime ?? match.time;
  const venue = [sourceMatch?.venue.name, sourceMatch?.venue.city].filter(Boolean).join("｜");
  const dataTag = sourceMatch ? sourceProviderTag(sourceMatch.source.provider) : match.isExample ? "经典样例" : "运营数据";
  const actionTitle = `优先做${primaryTopic.recommendedFormat}`;
  const actionBody = `先用“${primaryTopic.title}”建立内容主线，再用控球、射门、射正和 xG 做证据层，最后按 B站深度、微博讨论、小红书解释卡分发。`;

  return (
    <section className={`relative overflow-hidden rounded-[40px] border bg-gradient-to-br ${theme.gradient} p-7 shadow-[0_28px_90px_rgba(15,23,42,0.08)] lg:p-10`} style={{ borderColor: theme.border }}>
      <FieldPattern theme={theme} />
      <div className="relative z-10 grid gap-8 lg:grid-cols-[1fr_360px] lg:items-end">
        <div>
          <div className="flex flex-wrap gap-2">
            {[round || "世界杯", dataTag, score === "vs" ? "待赛程分析" : "可拆解内容"].map((tag) => (
              <span key={tag} className="rounded-full bg-white/80 px-3 py-1 text-xs font-semibold shadow-sm" style={{ color: theme.secondary }}>
                {tag}
              </span>
            ))}
          </div>
          <p className="mt-8 text-sm font-semibold uppercase tracking-[0.2em]" style={{ color: theme.secondary }}>{matchName}</p>
          <div className="mt-4 flex flex-wrap items-end gap-4">
            <div className="text-5xl font-black tracking-tight text-slate-950 lg:text-7xl">{homeTeam}</div>
            <div className="rounded-[28px] bg-white px-6 py-4 text-5xl font-black shadow-xl shadow-slate-900/10 lg:text-7xl" style={{ color: theme.primary }}>
              {score}
            </div>
            <div className="text-5xl font-black tracking-tight text-slate-950 lg:text-7xl">{awayTeam}</div>
          </div>
          <p className="mt-5 text-base font-medium text-slate-600">
            {round}｜{statusText}｜{formatSourceDate(kickoffTime)}
            {venue ? `｜${venue}` : ""}
          </p>
          <SourceStatusLine status={sourceStatus} lastUpdated={lastUpdated} loading={loading} error={error} />
          <div className="mt-8 rounded-3xl border bg-white/82 p-5 shadow-sm backdrop-blur" style={{ borderColor: theme.border }}>
            <div className="text-sm font-semibold" style={{ color: theme.secondary }}>推荐动作</div>
            <p className="mt-2 text-2xl font-semibold leading-tight text-slate-950">{actionTitle}</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">{actionBody}</p>
          </div>
        </div>

        <div className="rounded-[32px] border bg-white/88 p-6 shadow-xl shadow-slate-900/10 backdrop-blur" style={{ borderColor: theme.border }}>
          <div className="text-sm font-semibold text-slate-500">内容机会评分</div>
          <div className="mt-3 flex items-end gap-3">
            <span className="text-7xl font-black" style={{ color: theme.primary }}>{taskPriority}</span>
            <span className="mb-3 text-xl font-semibold text-slate-950">级内容机会</span>
          </div>
          <div className="mt-5 space-y-4">
            <ScoreBar label="热度" value={scores.heat} theme={theme} />
            <ScoreBar label="情绪" value={scores.emotion} theme={theme} />
            <ScoreBar label="叙事" value={scores.narrative} theme={theme} />
            <ScoreBar label="长尾价值" value={scores.longTail} theme={theme} />
          </div>
        </div>
      </div>
    </section>
  );
}

function SourceStatusLine({
  status,
  lastUpdated,
  loading,
  error
}: {
  status: SourceStatus;
  lastUpdated?: string;
  loading?: boolean;
  error?: string;
}) {
  return (
    <div className="mt-4 inline-flex flex-wrap items-center gap-2 rounded-full bg-white/80 px-4 py-2 text-xs font-semibold text-slate-600 shadow-sm">
      <span>数据来源：{loading ? "加载中" : sourceLabel(status)}</span>
      {lastUpdated ? <span>最后更新：{formatSourceDate(lastUpdated)}</span> : null}
      {error ? <span className="text-amber-700">请求提示：{error}</span> : null}
    </div>
  );
}

function AiBrainStatus({
  loading,
  enhancement,
  theme
}: {
  loading: boolean;
  enhancement: AiWorkflowEnhancement | null;
  theme: SportTheme;
}) {
  const isLive = enhancement?.sourceStatus === "live";
  const label = loading ? "DeepSeek 增强中" : isLive ? `DeepSeek 已启用${enhancement?.model ? `｜${enhancement.model}` : ""}` : "本地规则引擎兜底";
  const liveModules = [
    enhancement?.conclusions.length ? "运营结论" : null,
    enhancement?.topics.length ? "选题推荐" : null,
    enhancement?.platformContent ? "平台内容预览" : null
  ].filter(Boolean).join("、");
  const description = loading
    ? "正在把真实比赛数据转成运营结论、选题参考、平台内容预览和分发建议。"
    : isLive
      ? `当前页面的${liveModules || "运营分析"}由 DS API 实时生成，硬数据来自项目服务端比赛接口。切换到非主推选题时，平台内容会使用本地规则补齐。`
      : enhancement?.message ?? "未配置 DeepSeek key 或接口暂不可用，页面继续使用本地规则引擎。";

  return (
    <section className="rounded-[24px] border bg-white px-5 py-4 shadow-[0_14px_40px_rgba(15,23,42,0.05)]" style={{ borderColor: theme.border }}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm font-black uppercase tracking-[0.16em]" style={{ color: theme.primary }}>AI BRAIN</div>
          <div className="mt-1 text-lg font-semibold text-slate-950">{label}</div>
          <p className="mt-1 text-sm leading-6 text-slate-500">{description}</p>
        </div>
        <span className="rounded-full px-3 py-1.5 text-xs font-semibold text-white" style={{ backgroundColor: isLive ? theme.primary : "#64748b" }}>
          {isLive ? "AI 增强" : "规则兜底"}
        </span>
      </div>
    </section>
  );
}

function FieldPattern({ theme }: { theme: SportTheme }) {
  return (
    <div className="pointer-events-none absolute inset-0 opacity-70">
      <div className="absolute inset-0" style={{ background: `radial-gradient(circle at 78% 18%, ${theme.heroGlow}, transparent 280px)` }} />
      <div className="absolute left-[8%] top-[14%] h-[72%] w-[84%] rounded-[42px] border-2 border-white/60" />
      <div className="absolute left-1/2 top-[14%] h-[72%] w-px bg-white/55" />
      <div className="absolute left-[43%] top-[33%] h-44 w-44 rounded-full border-2 border-white/55" />
      <div className="absolute -right-20 bottom-12 h-56 w-56 rounded-full border-[18px] border-white/25" />
      <div className="absolute bottom-0 left-0 right-0 h-24 bg-[linear-gradient(135deg,rgba(255,255,255,.28)_25%,transparent_25%,transparent_50%,rgba(255,255,255,.28)_50%,rgba(255,255,255,.28)_75%,transparent_75%)] bg-[length:28px_28px] opacity-20" />
    </div>
  );
}

function SectionTitle({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return (
    <div>
      <div className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">{eyebrow}</div>
      <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">{title}</h2>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">{description}</p>
    </div>
  );
}

function ScoreBar({ label, value, theme }: { label: string; value: number; theme: SportTheme }) {
  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <span className="font-semibold text-slate-700">{label}</span>
        <span className="font-semibold" style={{ color: theme.primary }}>{value}</span>
      </div>
      <div className="mt-2 h-2 rounded-full bg-slate-100">
        <div className="h-2 rounded-full" style={{ width: `${value}%`, background: `linear-gradient(90deg, ${theme.primary}, ${theme.accent})` }} />
      </div>
    </div>
  );
}

function ConclusionCard({ title, body, theme, featured = false }: { title: string; body: string; theme: SportTheme; featured?: boolean }) {
  return (
    <div
      className="rounded-[28px] border bg-white p-5 shadow-[0_18px_50px_rgba(15,23,42,0.06)]"
      style={{ borderColor: featured ? theme.primary : theme.border, boxShadow: featured ? `0 24px 70px ${theme.heroGlow}` : undefined }}
    >
      <div className="text-sm font-semibold" style={{ color: theme.primary }}>{title}</div>
      <p className="mt-3 text-lg font-semibold leading-8 text-slate-950">{body}</p>
    </div>
  );
}

function DataAngleCard({ label, value, compare, explain, angle, theme }: { label: string; value: string; compare: string; explain: string; angle: string; theme: SportTheme }) {
  return (
    <div className="rounded-[28px] border bg-white p-5 shadow-sm transition hover:-translate-y-1" style={{ borderColor: theme.border }}>
      <div className="text-sm font-semibold text-slate-500">{label}</div>
      <div className="mt-3 text-4xl font-black tracking-tight" style={{ color: theme.strongText }}>{value}</div>
      <div className="mt-1 text-sm font-semibold" style={{ color: theme.primary }}>{compare}</div>
      <p className="mt-4 text-sm leading-6 text-slate-600">{explain}</p>
      <div className="mt-4 rounded-2xl p-3 text-sm font-medium leading-6" style={{ backgroundColor: theme.background, color: theme.secondary }}>
        内容转化：{angle}
      </div>
    </div>
  );
}

function MatchSignalCard({
  signal,
  theme,
  copied,
  onCopy
}: {
  signal: MatchSignal;
  theme: SportTheme;
  copied: boolean;
  onCopy: () => void;
}) {
  const riskTone =
    signal.riskLevel === "高"
      ? "bg-rose-100 text-rose-700"
      : signal.riskLevel === "中"
        ? "bg-amber-100 text-amber-700"
        : "bg-emerald-100 text-emerald-700";

  return (
    <article className="rounded-[28px] border bg-white p-5 shadow-sm transition hover:-translate-y-1" style={{ borderColor: signal.priority === "primary" ? theme.primary : theme.border }}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full px-3 py-1 text-xs font-black text-white" style={{ backgroundColor: signal.priority === "primary" ? theme.primary : theme.secondary }}>
          {signal.priority === "primary" ? "优先信号" : signal.priority === "secondary" ? "次级信号" : "观察信号"}
        </span>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${riskTone}`}>风险：{signal.riskLevel}</span>
      </div>
      <h3 className="mt-4 text-xl font-semibold leading-tight text-slate-950">{signal.label}</h3>
      <p className="mt-2 text-sm font-semibold" style={{ color: theme.primary }}>
        {signal.minute}｜{signal.team}｜传播价值 {signal.contentValue}
      </p>
      <p className="mt-3 min-h-20 text-sm leading-6 text-slate-600">{signal.evidence}</p>
      <div className="mt-4 rounded-2xl p-4 text-sm leading-6" style={{ backgroundColor: theme.background }}>
        <div className="font-semibold" style={{ color: theme.secondary }}>可转化选题</div>
        <p className="mt-1 text-slate-700">{signal.topicSeed}</p>
      </div>
      <div className="mt-4 text-sm leading-6 text-slate-600">
        <div>推荐平台：{signal.recommendedPlatforms.join(" / ")}</div>
        <div>内容形式：{signal.contentFormats.join(" / ")}</div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <ActionButton onClick={onCopy} theme={theme} variant="secondary">
          <Clipboard className="h-4 w-4" />
          {copied ? "已复制" : "复制选题"}
        </ActionButton>
      </div>
    </article>
  );
}

function TopicRecommendationCard({ topic, theme, featured, selected, copied, onSelect, onCopy }: { topic: TopicIdea; theme: SportTheme; featured?: boolean; selected: boolean; copied: boolean; onSelect: () => void; onCopy: () => void }) {
  return (
    <article
      className={`rounded-[30px] border bg-white p-5 shadow-[0_18px_50px_rgba(15,23,42,0.06)] transition hover:-translate-y-1 ${featured ? "lg:p-6" : ""}`}
      style={{ borderColor: selected || featured ? theme.primary : theme.border, boxShadow: featured ? `0 26px 80px ${theme.heroGlow}` : undefined }}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full px-3 py-1 text-xs font-black text-white" style={{ backgroundColor: featured ? theme.primary : theme.secondary }}>
          {featured ? "主推" : "次推"}
        </span>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{topic.category}</span>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">推荐平台：B站 / 微博</span>
      </div>
      <h3 className={`${featured ? "text-3xl" : "text-xl"} mt-5 font-semibold leading-tight text-slate-950`}>{topic.title}</h3>
      <p className="mt-3 text-sm leading-7 text-slate-600">{topic.businessExplanation}</p>
      <div className="mt-5 rounded-2xl border p-4 text-sm leading-6" style={{ borderColor: theme.border, backgroundColor: theme.background }}>
        <div className="font-semibold" style={{ color: theme.secondary }}>数据依据</div>
        <p className="mt-1 text-slate-600">{topic.reason}</p>
      </div>
      <div className="mt-5 grid gap-2 text-sm text-slate-600">
        <div>可生成产物：B站脚本 / 微博话题 / 小红书图文 / 公众号段落</div>
        <div>制作成本：{topic.productionCost}｜风险等级：{topic.riskLevel}</div>
      </div>
      <div className="mt-5 flex flex-wrap gap-2">
        <ActionButton onClick={onSelect} theme={theme}>{selected ? "已选择" : "选择角度"}</ActionButton>
        <ActionButton onClick={onCopy} theme={theme} variant="secondary">{copied ? "已复制" : "复制选题"}</ActionButton>
      </div>
    </article>
  );
}

function PlatformOutputCard({ platform, active, theme, onClick }: { platform: PlatformKey; active: boolean; theme: SportTheme; onClick: () => void }) {
  const meta = platformMeta[platform];
  return (
    <button
      onClick={onClick}
      className="rounded-[26px] border bg-white p-5 text-left shadow-sm transition hover:-translate-y-1 hover:shadow-[0_20px_56px_rgba(15,23,42,0.08)]"
      style={{ borderColor: active ? theme.primary : theme.border, backgroundColor: active ? theme.background : "#fff" }}
    >
      <div className="text-xl font-semibold text-slate-950">{meta.title}</div>
      <p className="mt-3 min-h-12 text-sm leading-6 text-slate-600">{meta.positioning}</p>
      <div className="mt-5 inline-flex rounded-full px-3 py-1 text-xs font-semibold text-white" style={{ backgroundColor: active ? theme.primary : "#0f172a" }}>
        {meta.action}
      </div>
    </button>
  );
}

function PlatformPreview({ className, platform, content, theme, copied, onCopy, onExport, onRegenerate }: { className?: string; platform: PlatformKey; content: PlatformContent; theme: SportTheme; copied: string | null; onCopy: (key: string, value: string) => void; onExport: () => void; onRegenerate: () => void }) {
  const preview = getPlatformPreview(platform, content);
  return (
    <div className={`rounded-[28px] border bg-white p-5 ${className ?? ""}`} style={{ borderColor: theme.border }}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-sm font-semibold" style={{ color: theme.primary }}>{platformMeta[platform].title} 生成预览</div>
          <h3 className="mt-2 text-2xl font-semibold text-slate-950">{preview.title}</h3>
        </div>
        <div className="flex flex-wrap gap-2">
          <ActionButton onClick={() => onCopy(`platform-${platform}`, preview.fullText)} theme={theme} variant="secondary">
            <Clipboard className="h-4 w-4" />
            {copied === `platform-${platform}` ? "已复制" : "复制"}
          </ActionButton>
          <ActionButton onClick={onExport} theme={theme} variant="secondary">
            <Download className="h-4 w-4" />
            导出
          </ActionButton>
          <ActionButton onClick={onRegenerate} theme={theme} variant="secondary">
            <RefreshCcw className="h-4 w-4" />
            {copied === "regen" ? "已重新生成" : "重新生成"}
          </ActionButton>
        </div>
      </div>
      <div className="mt-5 grid gap-3 lg:grid-cols-2">
        {preview.items.map((item) => (
          <div key={item.label} className="rounded-2xl bg-slate-50 p-4">
            <div className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">{item.label}</div>
            <p className="mt-2 text-sm leading-7 text-slate-700">{item.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function RiskCard({ title, level, advice, applied, onApply }: { title: string; level: string; advice: string; applied: boolean; onApply: () => void }) {
  const tone =
    level === "高"
      ? "bg-rose-100 text-rose-700"
      : level === "中"
        ? "bg-amber-100 text-amber-700"
        : "bg-emerald-100 text-emerald-700";
  return (
    <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="font-semibold text-slate-950">{title}</div>
        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${tone}`}>{level}</span>
      </div>
      <p className="mt-3 min-h-24 text-sm leading-6 text-slate-600">{advice}</p>
      <button onClick={onApply} className="mt-3 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100">
        {applied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <ShieldAlert className="h-3.5 w-3.5" />}
        {applied ? "已应用" : "稳妥改写"}
      </button>
    </div>
  );
}

function ActionButton({ children, onClick, theme, variant = "primary" }: { children: ReactNode; onClick: () => void; theme: SportTheme; variant?: "primary" | "secondary" }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex h-11 items-center justify-center gap-2 rounded-full px-4 text-sm font-semibold transition hover:-translate-y-0.5"
      style={{
        backgroundColor: variant === "primary" ? theme.primary : "#ffffff",
        color: variant === "primary" ? "#ffffff" : theme.strongText,
        border: `1px solid ${variant === "primary" ? theme.primary : theme.border}`,
        boxShadow: variant === "primary" ? `0 14px 32px ${theme.heroGlow}` : "none"
      }}
    >
      {children}
    </button>
  );
}

function buildMatchWorkflow(
  match: MatchData,
  primaryTopic: TopicIdea,
  analysis: ReturnType<typeof analyzeMatch>,
  aiEnhancement: AiWorkflowEnhancement | null
) {
  const scores = buildOpportunityScores(match, primaryTopic);
  const possessionLeader = leaderBy(match, "possession");
  const shotLeader = leaderBy(match, "shotsOnTarget");
  const xgLeader = leaderBy(match, "xg");
  const possessionGap = Math.abs(match.stats.teamA.possession - match.stats.teamB.possession);
  const shotTotal = match.stats.teamA.shots + match.stats.teamB.shots;
  const onTargetTotal = match.stats.teamA.shotsOnTarget + match.stats.teamB.shotsOnTarget;
  const hasXg = match.stats.teamA.xg > 0 || match.stats.teamB.xg > 0;
  const scoreText = match.score === "vs" ? "当前赛程还没有比分" : `比分已经定格为 ${match.score}`;
  const priority = scores.heat >= 90 && scores.narrative >= 88 ? "S" : scores.heat >= 78 ? "A" : "B";

  return {
    priority,
    scores,
    conclusions: aiEnhancement?.sourceStatus === "live" && aiEnhancement.conclusions.length ? aiEnhancement.conclusions : [
      {
        title: "为什么值得做",
        body: `${scoreText}，并且已经有${possessionGap}%控球差、${onTargetTotal}次射正等可解释数据。内容不应只报赛果，而要拆成“${primaryTopic.title}”这样的运营主线。`
      },
      {
        title: "先做什么",
        body: `先做${primaryTopic.recommendedFormat}。B站负责把${primaryTopic.category}讲深，微博承接赛后讨论，小红书把关键数据做成可收藏解释卡。`,
        featured: true
      },
      {
        title: "注意什么风险",
        body: `${analysis.contentValue} 但真实 API 只提供结构化数据，缺少画面、采访和未公开信息时，不要写“确认伤退”“黑幕”“全网都在骂”等定性说法。`
      }
    ],
    dataAngles: [
      {
        label: "控球率",
        value: `${match.stats.teamA.possession}% / ${match.stats.teamB.possession}%`,
        compare: `${possessionLeader.name}控球更高`,
        explain: possessionGap <= 3
          ? "双方控球接近，运营表达应重点转向射正、xG 和关键事件，不要硬写谁完全控制比赛。"
          : `${possessionLeader.name}控球多出 ${possessionGap}%，但控球是否形成威胁，还要继续看射正和 xG。`,
        angle: "适合做“控球是否等于控制比赛”的战术复盘，也适合给非核心球迷做解释卡。"
      },
      {
        label: "射门 / 射正",
        value: `${match.stats.teamA.shots}-${match.stats.teamA.shotsOnTarget} / ${match.stats.teamB.shots}-${match.stats.teamB.shotsOnTarget}`,
        compare: `${shotLeader.name}射正更突出`,
        explain: shotTotal > 0
          ? `双方合计 ${shotTotal} 次射门、${onTargetTotal} 次射正，能支撑“机会质量”和“进攻效率”的内容判断。`
          : "当前接口没有返回射门细项，页面先保留结构，发布时应补充技术统计来源。",
        angle: "适合转成 B站机会质量复盘、微博赛后讨论题和短视频数据钩子。"
      },
      {
        label: "xG",
        value: `${match.stats.teamA.xg} / ${match.stats.teamB.xg}`,
        compare: hasXg ? `${xgLeader.name}机会质量更高` : "xG 暂缺或为 0",
        explain: hasXg
          ? `${xgLeader.name}的 xG 更高，可以解释比分之外的机会质量差异。`
          : "如果 API 没有返回 xG，不要强行写预期进球结论，应改用射门、射正和事件时间线补证据。",
        angle: hasXg ? "适合支撑战术复盘和胜负原因分析。" : "适合做“数据缺失时如何稳妥表达”的风险审稿样例。"
      }
    ],
    risks: [
      { title: "舆情风险", level: "中", advice: `围绕 ${match.teamA} vs ${match.teamB} 做讨论时，避免制造球迷对立，把重点放在数据、赛程和公开事实。` },
      { title: "表达风险", level: "低", advice: "当前内容可以发布为运营建议，但涉及判罚、伤病、内部矛盾时必须写“需核实”或“建议补充来源”。" },
      { title: "版权风险", level: "低", advice: "优先使用自制比分卡、图表和 API 数据说明；如使用比赛画面，需要确认平台版权边界。" },
      { title: "标题党风险", level: "中", advice: "标题可以有冲突感，但不要使用黑幕、保送、确认伤退、彻底废了等高风险定性词。" },
      { title: "平台适配风险", level: "低", advice: "微博适合短讨论，B站适合深复盘，小红书适合解释型卡片；不要把同一段文案机械复制到所有平台。" }
    ] as Array<{ title: string; level: string; advice: string }>
  };
}

function buildOpportunityScores(match: MatchData, topic: TopicIdea): OpportunityScores {
  const totalGoals = scoreTotal(match.score);
  const shotVolume = match.stats.teamA.shots + match.stats.teamB.shots;
  const hasStats = shotVolume > 0 || match.stats.teamA.possession !== 50 || match.stats.teamB.possession !== 50;

  return {
    heat: clampScore(72 + totalGoals * 4 + (match.penaltyScore ? 8 : 0) + (match.isExample ? 8 : 0)),
    emotion: clampScore(68 + totalGoals * 5 + (match.keyEvents.length >= 3 ? 7 : 0)),
    narrative: clampScore(Math.round((topic.newsValue + topic.spreadPotential) / 2)),
    longTail: clampScore(70 + (hasStats ? 12 : 0) + (topic.category === "历史对照" ? 8 : 0))
  };
}

function leaderBy(match: MatchData, key: keyof MatchData["stats"]["teamA"]) {
  const a = match.stats.teamA[key];
  const b = match.stats.teamB[key];
  if (a === b) return { name: "双方", value: a };
  return a > b ? { name: match.teamA, value: a } : { name: match.teamB, value: b };
}

function scoreTotal(score: string) {
  const [home, away] = score.split("-").map((value) => Number(value));
  if (!Number.isFinite(home) || !Number.isFinite(away)) return 0;
  return home + away;
}

function clampScore(value: number) {
  return Math.max(60, Math.min(99, value));
}

function getPlatformPreview(platform: PlatformKey, content: PlatformContent) {
  if (platform === "bilibili") {
    const items = [
      { label: "标题", value: content.bilibili.titles[0] },
      { label: "封面文案", value: content.bilibili.coverCopy },
      { label: "视频结构", value: content.bilibili.outline.join(" / ") },
      { label: "开头 15 秒口播", value: content.bilibili.openingScript },
      { label: "弹幕互动问题", value: content.bilibili.danmakuPoints.join(" / ") }
    ];
    return { title: "深度视频脚本包", items, fullText: items.map((item) => `${item.label}：${item.value}`).join("\n") };
  }
  if (platform === "weibo") {
    const items = [
      { label: "话题", value: content.weibo.hashtags.join(" ") },
      { label: "短帖", value: content.weibo.fiveMinuteComment },
      { label: "评论区引导", value: content.weibo.debateQuestion },
      { label: "风险提醒", value: content.weibo.riskTip }
    ];
    return { title: "热点讨论扩散包", items, fullText: items.map((item) => `${item.label}：${item.value}`).join("\n") };
  }
  if (platform === "xiaohongshu") {
    const items = [
      { label: "封面标题", value: content.xiaohongshu.coverTitle },
      { label: "图文分页结构", value: content.xiaohongshu.cardTitles.join(" / ") },
      { label: "收藏理由", value: content.xiaohongshu.collectReason },
      { label: "口语化正文", value: content.xiaohongshu.cards.map((card) => `${card.title}：${card.body}`).join(" / ") }
    ];
    return { title: "图文收藏解释包", items, fullText: items.map((item) => `${item.label}：${item.value}`).join("\n") };
  }
  const items = [
    { label: "深度标题", value: content.article.title },
    { label: "导语", value: content.article.intro },
    { label: "段落大纲", value: content.article.fullOutline.join(" / ") },
    { label: "金句结尾", value: content.article.ending }
  ];
  return { title: "长文沉淀写作包", items, fullText: items.map((item) => `${item.label}：${item.value}`).join("\n") };
}

function buildSelectedContent(content: PlatformContent, platforms: PlatformKey[]) {
  return platforms.map((platform) => getPlatformPreview(platform, content).fullText).join("\n\n");
}

function buildPlatformMarkdown(platform: PlatformKey, content: PlatformContent) {
  const preview = getPlatformPreview(platform, content);
  return [`# ${platformMeta[platform].title} 内容预览`, "", preview.fullText].join("\n");
}

function buildMarkdown(title: string, topic: TopicIdea, content: PlatformContent, advice: string) {
  return [
    `# ${title} 内容处理报告`,
    "",
    "## 核心选题",
    topic.title,
    "",
    "## 平台内容",
    buildSelectedContent(content, ["bilibili", "weibo", "xiaohongshu", "article"]),
    "",
    "## 风险审稿",
    `发布建议：${advice}`,
    "",
    "## 合规说明",
    "当前内容基于示例数据生成，仅作为运营创作辅助，发布前需人工核实事实、数据来源和平台规则。"
  ].join("\n");
}

function getMatchRefreshMs(match: WorldCupMatch) {
  if (match.status === "live") return 20_000;
  if (match.status === "finished") return undefined;
  if (match.status === "scheduled") return 120_000;
  return 60_000;
}

function matchRefreshPolicy(payload: WorldCupPayload<WorldCupMatch>) {
  return getMatchRefreshMs(payload.data);
}

function sourceLabel(status: SourceStatus) {
  const labels: Record<SourceStatus, string> = {
    live: "真实 API 数据",
    fallback: "示例数据",
    cache: "缓存数据",
    error: "请求失败"
  };
  return labels[status];
}

function sourceProviderTag(provider: WorldCupMatch["source"]["provider"]) {
  const labels: Record<WorldCupMatch["source"]["provider"], string> = {
    "api-football": "真实 API 数据",
    "worldcup26-free": "WorldCup26 免费 API",
    "thestatsapi-fixtures": "TheStatsAPI 免费赛程",
    mock: "经典样例"
  };
  return labels[provider];
}

function formatSourceDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}
