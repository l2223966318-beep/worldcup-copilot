"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Check,
  Clipboard,
  Download,
  RefreshCcw
} from "lucide-react";

import { HighlightedText, ReadableTextBlock } from "@/components/ui/readable-text";
import { InsightCharts } from "@/components/worldcup/insight-charts";
import type { MatchData } from "@/data/matches";
import { generatePlatformContent, type PlatformContent } from "@/lib/ai/content";
import { reviewRisk } from "@/lib/ai/risk";
import { extractMatchSignals, type MatchSignal } from "@/lib/ai/signals";
import { generateTopics, type TopicIdea } from "@/lib/ai/topics";
import { copyToClipboard, downloadTextFile } from "@/lib/download";
import { HOT_RADAR_CACHE_KEY, type HotRadarCache } from "@/lib/hot/hotTopicWorkflow";
import type { HotItem, HotSearchPayload, HotTopic } from "@/lib/hot/types";
import { analyzeMatch, getMatchDetail } from "@/lib/project-api";
import { createRuleBasedAnalysis } from "@/lib/services/analysisService";
import { contentTypeOptions, createPlatformDraft, topicModeOptions, type ContentTypeKey, type TopicModeKey } from "@/lib/services/contentService";
import { createContentPackage, createPackageMarkdown, createPackageText } from "@/lib/services/exportService";
import { localizeMatchStatus, localizeRoundName, localizeTeamName, localizeVenueText } from "@/lib/services/footballNames";
import { buildDraftReviewFlow, buildMatchHotspotShortlist, mergeHotSearchPayloads, type DraftReviewFlow } from "@/lib/services/matchDetailPresentation";
import { appendHistoryRecord, writeReviewDraft, writeWorkflowState } from "@/lib/services/workflowStore";
import { worldCupMatchToMatchData } from "@/lib/sports/adapters";
import { useWorldCupQuery } from "@/lib/sports/client";
import type { SourceStatus, WorldCupMatch, WorldCupPayload } from "@/lib/sports/types";
import { getMatchSportType, getSportTheme, type SportTheme } from "@/lib/sport-theme";
import { formatBeijingDateTime } from "@/lib/time/beijingTime";
import type { AnalysisResult, MatchContext, PlatformDraft, WorkflowTopic } from "@/types/workflow";

const platformLabels = {
  bilibili: "B站",
  weibo: "微博",
  xiaohongshu: "小红书",
  douyin: "抖音",
  article: "公众号"
} as const;
const SETTINGS_STORAGE_KEY = "worldcup.datasource.settings";

type PlatformKey = keyof typeof platformLabels;
type PlatformFit = "主推" | "可做" | "谨慎";

type OpportunityScores = {
  heat: number;
  emotion: number;
  narrative: number;
  longTail: number;
};

type PlatformDecision = {
  fit: PlatformFit;
  score: number;
  reason: string;
  deliverable: string;
  caution: string;
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
  douyin: { title: "抖音", positioning: "短视频口播、前三秒钩子、节奏分镜", action: "生成抖音口播" },
  article: { title: "公众号", positioning: "深度评论、历史纵深、长文沉淀", action: "生成公众号长文" }
};

export default function MatchAnalysisPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const fixtureId = params.id;
  const { payload, loading, error } = useWorldCupQuery<WorldCupMatch>(
    `/api/worldcup/matches/${fixtureId}`,
    matchRefreshPolicy,
    {
      cacheKey: `worldcup.match.${fixtureId}`,
      staleMs: 120_000
    }
  );
  const sourceMatch = payload?.data;
  const fallbackMatch = getMatchDetail(fixtureId);
  const match = useMemo(() => (sourceMatch ? worldCupMatchToMatchData(sourceMatch) : fallbackMatch), [fallbackMatch, sourceMatch]);
  const theme = getSportTheme(getMatchSportType(match.id));
  const analysis = useMemo(() => analyzeMatch(match), [match]);
  const matchSignals = useMemo(() => extractMatchSignals(match), [match]);
  const baselineTopics = useMemo(() => generateTopics(match).slice(0, 6), [match]);
  const [aiEnhancement, setAiEnhancement] = useState<AiWorkflowEnhancement | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const topics = aiEnhancement?.sourceStatus === "live" && aiEnhancement.topics.length ? aiEnhancement.topics : baselineTopics;
  const [selectedTopicId, setSelectedTopicId] = useState(topics[0]?.id);
  const selectedTopic = topics.find((topic) => topic.id === selectedTopicId) ?? topics[0];
  const workflow = useMemo(() => buildMatchWorkflow(match, topics[0], analysis, aiEnhancement), [aiEnhancement, analysis, match, topics]);
  const [activePlatform, setActivePlatform] = useState<PlatformKey>("bilibili");
  const [activeContentType, setActiveContentType] = useState<ContentTypeKey>("topic");
  const [activeTopicMode, setActiveTopicMode] = useState<TopicModeKey>("professional");
  const [copied, setCopied] = useState<string | null>(null);
  const [manualAnalysis, setManualAnalysis] = useState<AnalysisResult | null>(null);
  const [manualDraft, setManualDraft] = useState<PlatformDraft | null>(null);
  const [draftLoading, setDraftLoading] = useState(false);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [aiReviewFlow, setAiReviewFlow] = useState<DraftReviewFlow | null>(null);
  const [workflowNotice, setWorkflowNotice] = useState("");
  const [matchHotItems, setMatchHotItems] = useState<HotItem[]>([]);
  const [hotspotLoading, setHotspotLoading] = useState(false);
  const [hotspotError, setHotspotError] = useState("");
  const [draftForReview, setDraftForReview] = useState("");

  const localContent = useMemo(() => generatePlatformContent(match, selectedTopic), [match, selectedTopic]);
  const content = useMemo(() => {
    const aiPrimaryTopicId = aiEnhancement?.topics[0]?.id;
    if (aiEnhancement?.sourceStatus === "live" && aiEnhancement.platformContent && selectedTopic.id === aiPrimaryTopicId) {
      return aiEnhancement.platformContent;
    }

    return localContent;
  }, [aiEnhancement, localContent, selectedTopic.id]);
  const selectedText = useMemo(() => buildSelectedContent(content, ["bilibili", "weibo", "xiaohongshu", "douyin", "article"]), [content]);
  const matchContext = useMemo(
    () => buildMatchContext(match, matchSignals, payload?.sourceStatus ?? "fallback"),
    [match, matchSignals, payload?.sourceStatus]
  );
  const workflowTopic = useMemo(() => topicToWorkflowTopic(selectedTopic), [selectedTopic]);
  const platformDecisions = useMemo(() => buildPlatformDecisions(match, matchSignals, selectedTopic), [match, matchSignals, selectedTopic]);
  const activeWorkflowDraft = useMemo(
    () => manualDraft ?? createPlatformDraft(toWorkflowPlatform(activePlatform), matchContext, workflowTopic, manualAnalysis ?? createRuleBasedAnalysis(matchContext), { contentType: activeContentType, topicMode: activeTopicMode }),
    [activeContentType, activePlatform, activeTopicMode, manualAnalysis, manualDraft, matchContext, workflowTopic]
  );
  const reviewSourceText = draftForReview.trim() || getPublishableDraftText(activeWorkflowDraft);
  const reviewResult = useMemo(() => reviewRisk(reviewSourceText), [reviewSourceText]);
  const localReviewFlow = useMemo(() => buildDraftReviewFlow(reviewSourceText, match, reviewResult), [match, reviewResult, reviewSourceText]);
  const reviewFlow = aiReviewFlow ?? localReviewFlow;
  const markdown = useMemo(() => buildMarkdown(match.name, selectedTopic, content, reviewFlow.result.advice), [content, match.name, reviewFlow.result.advice, selectedTopic]);
  const matchHotspots = useMemo(
    () => buildMatchHotspotShortlist({ match, signals: matchSignals, hotItems: matchHotItems }),
    [match, matchHotItems, matchSignals]
  );

  useEffect(() => {
    const controller = new AbortController();
    setAiEnhancement(null);
    setAiLoading(true);

    fetch("/api/ai/match-workflow", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ match, baselineTopics, apiKey: getStoredDeepseekKey() || undefined }),
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
    const controller = new AbortController();
    const query = `${match.teamA} ${match.teamB} ${match.name} 世界杯 足球`;
    setHotspotLoading(true);
    setHotspotError("");

    Promise.allSettled([
      fetchHotPayload("/api/hot?source=all&scope=sports&limit=50", controller.signal),
      fetchHotPayload(`/api/hot/search?q=${encodeURIComponent(query)}`, controller.signal, getStoredHotSearchHeaders())
    ])
      .then((results) => {
        if (controller.signal.aborted) return;
        const payloads = results.flatMap((result) => (result.status === "fulfilled" ? [result.value] : []));
        const failures = results.flatMap((result) => (result.status === "rejected" ? [result.reason] : []));
        if (!payloads.length) throw failures[0] ?? new Error("热点源请求失败，已保留本场事件信号。");
        const payload = mergeHotSearchPayloads(payloads);
        if (payload.sourceStatus === "error") {
          setHotspotError(payload.message || "热点源暂不可用，已保留本场事件信号。");
          setMatchHotItems([]);
          return;
        }
        setMatchHotItems(payload.data ?? []);
        setHotspotError(payload.message ?? "");
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          setHotspotError(error instanceof Error ? error.message : "热点源请求失败，已保留本场事件信号。");
          setMatchHotItems([]);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setHotspotLoading(false);
      });

    return () => controller.abort();
  }, [match.id, match.name, match.teamA, match.teamB]);

  useEffect(() => {
    if (!topics.some((topic) => topic.id === selectedTopicId)) {
      setSelectedTopicId(topics[0]?.id);
    }
  }, [selectedTopicId, topics]);

  useEffect(() => {
    writeWorkflowState({
      currentMatch: matchContext,
      selectedTopic: workflowTopic,
      selectedPlatform: toWorkflowPlatform(activePlatform),
      dataSourceStatus: matchContext.matchInfo.sourceStatus
    });
  }, [activePlatform, matchContext, workflowTopic]);

  async function handleCopy(key: string, value: string) {
    await copyToClipboard(value);
    setCopied(key);
    window.setTimeout(() => setCopied(null), 1600);
  }

  function showWorkflowNotice(message: string) {
    setWorkflowNotice(message);
    window.setTimeout(() => setWorkflowNotice(""), 1800);
  }

  function handleGenerateAnalysis() {
    const result = createRuleBasedAnalysis(matchContext);
    setManualAnalysis(result);
    writeWorkflowState({
      currentMatch: matchContext,
      analysisResult: result,
      dataSourceStatus: matchContext.matchInfo.sourceStatus
    });
    showWorkflowNotice("赛事分析已生成并写入工作流。");
  }

  function handleGenerateTopics() {
    const topicList = topics.map(topicToWorkflowTopic);
    writeWorkflowState({
      currentMatch: matchContext,
      topicList,
      selectedTopic: workflowTopic
    });
    showWorkflowNotice("选题已生成，可继续生成平台文案。");
  }

  async function handleGeneratePlatformDraft() {
    const analysisSnapshot = manualAnalysis ?? createRuleBasedAnalysis(matchContext);
    const fallbackDraft = createPlatformDraft(toWorkflowPlatform(activePlatform), matchContext, workflowTopic, analysisSnapshot, { contentType: activeContentType, topicMode: activeTopicMode });
    setDraftLoading(true);
    let draft = fallbackDraft;

    try {
      const response = await fetch("/api/ai/platform-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform: toWorkflowPlatform(activePlatform),
          contentType: activeContentType,
          topicMode: activeTopicMode,
          matchContext,
          topic: workflowTopic,
          analysis: analysisSnapshot,
          apiKey: getStoredDeepseekKey() || undefined
        })
      });
      const payload = (await response.json()) as { sourceStatus: "live" | "fallback" | "error"; draft?: PlatformDraft; message?: string };
      if (payload.sourceStatus === "live" && payload.draft) draft = payload.draft;
    } catch {
      draft = fallbackDraft;
    }

    setManualAnalysis(analysisSnapshot);
    setManualDraft(draft);
    setDraftForReview(getPublishableDraftText(draft));
    setAiReviewFlow(null);
    writeWorkflowState({
      currentMatch: matchContext,
      analysisResult: analysisSnapshot,
      selectedTopic: workflowTopic,
      selectedPlatform: draft.platform,
      generatedContent: draft
    });
    setDraftLoading(false);
  }

  async function handleAiReview() {
    writeReviewDraft(reviewSourceText);
    writeWorkflowState({
      currentMatch: matchContext,
      selectedTopic: workflowTopic,
      selectedPlatform: activeWorkflowDraft.platform,
      generatedContent: { ...activeWorkflowDraft, body: reviewSourceText }
    });

    setReviewLoading(true);
    try {
      const response = await fetch("/api/ai/review-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          draft: reviewSourceText,
          matchContext,
          apiKey: getStoredDeepseekKey() || undefined
        })
      });
      const payload = (await response.json()) as {
        sourceStatus: "live" | "fallback" | "error";
        result?: DraftReviewFlow["result"];
        riskPoints?: string[];
        rewriteSuggestion?: string;
        checklist?: string[];
      };
      if (payload.sourceStatus === "live" && payload.result) {
        setAiReviewFlow({
          draft: reviewSourceText,
          result: payload.result,
          riskPoints: payload.riskPoints?.length ? payload.riskPoints : localReviewFlow.riskPoints,
          rewriteSuggestion: payload.rewriteSuggestion || localReviewFlow.rewriteSuggestion,
          checklist: payload.checklist?.length ? payload.checklist : localReviewFlow.checklist
        });
      } else {
        setAiReviewFlow(null);
      }
    } catch {
      setAiReviewFlow(null);
    } finally {
      setReviewLoading(false);
    }
  }

  function openHotspotWorkflow(hotspot: ReturnType<typeof buildMatchHotspotShortlist>[number]) {
    if (typeof window !== "undefined") {
      const topic: HotTopic = {
        id: hotspot.id,
        rank: hotspot.rank,
        title: hotspot.title,
        summary: hotspot.summary,
        heat: hotspot.heat,
        platform: hotspot.platform,
        source: hotspot.source,
        valueScore: hotspot.valueScore,
        relevanceScore: hotspot.valueScore,
        leverageValue: hotspot.valueScore >= 75 ? "高价值" : "可观察",
        tags: [match.teamA, match.teamB, match.stage, "比赛详情页"],
        updatedAt: new Date().toISOString(),
        url: hotspot.url,
        relatedMatches: [match.name],
        contentAngles: [
          `从“${hotspot.title}”切入，先确认热点来源，再回到${match.teamA} vs ${match.teamB}的比赛事实。`,
          "生成内容前先拆清：已知事实、待核验信息、平台适配和风险边界。"
        ]
      };
      const cached = readHotRadarCache();
      const topics = [topic, ...(cached?.topics ?? []).filter((item) => item.id !== topic.id)];
      const nextCache: HotRadarCache = {
        topics,
        lastUpdatedAt: new Date().toISOString(),
        sourceStatus: cached?.sourceStatus ?? "cache",
        message: "来自比赛详情页热点短榜。"
      };
      window.localStorage.setItem(HOT_RADAR_CACHE_KEY, JSON.stringify(nextCache));
    }
    router.push(`/hot-topics/${encodeURIComponent(hotspot.id)}?mode=generate`);
  }

  function buildCurrentPackage() {
    const analysisSnapshot = manualAnalysis ?? createRuleBasedAnalysis(matchContext);
    return createContentPackage({
      matchContext,
      analysis: analysisSnapshot,
      selectedTopic: workflowTopic,
      platformDraft: activeWorkflowDraft,
      reviewResult: {
        level: reviewFlow.result.level,
        score: reviewFlow.result.score,
        findings: reviewFlow.result.findings.map((finding) => ({ type: finding.type, sentence: finding.sentence, rewrite: finding.rewrite })),
        advice: reviewFlow.result.advice
      }
    });
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
        error={error || formatSourceIssue(payload?.message)}
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
        <SectionTitle eyebrow="FIELD SIGNALS" title="场上热点信号" description="把外部热榜和本场事件合并成短榜，按热度与比赛相关性排序，像热搜一样先看最值得处理的内容。" />
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-slate-500">
          <span>{hotspotLoading ? "正在同步热点源..." : `已筛出 ${matchHotspots.length} 条比赛相关热点`}</span>
          {hotspotError ? <span className="font-semibold text-amber-700">{hotspotError}</span> : null}
        </div>
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          {matchHotspots.map((hotspot) => (
            <MatchHotspotCard
              key={hotspot.id}
              hotspot={hotspot}
              theme={theme}
              copied={copied === `hotspot-${hotspot.id}`}
              onCopy={() => handleCopy(`hotspot-${hotspot.id}`, `${hotspot.title}\n${hotspot.summary}`)}
              onUse={() => openHotspotWorkflow(hotspot)}
            />
          ))}
        </div>
      </section>

      <section className="rounded-[32px] border bg-white p-6 shadow-[0_20px_70px_rgba(15,23,42,0.06)]" style={{ borderColor: theme.border }}>
        <SectionTitle eyebrow="PLATFORM OUTPUT" title="多平台分发工作台" />
        {workflowNotice ? <p className="mt-3 text-sm font-semibold text-emerald-700">{workflowNotice}</p> : null}
        <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          {(Object.keys(platformLabels) as PlatformKey[]).map((platform) => (
            <PlatformOutputCard
              key={platform}
              platform={platform}
              active={activePlatform === platform}
              decision={platformDecisions[platform]}
              theme={theme}
              onClick={() => {
                setActivePlatform(platform);
                setManualDraft(null);
                setDraftForReview("");
                setAiReviewFlow(null);
              }}
            />
          ))}
        </div>
        <PlatformPreview
          className="mt-5"
          platform={activePlatform}
          draft={manualDraft}
          topics={topics}
          selectedTopicId={selectedTopic.id}
          contentType={activeContentType}
          topicMode={activeTopicMode}
          draftLoading={draftLoading}
          onTopicChange={(topicId) => {
            setSelectedTopicId(topicId);
            setManualDraft(null);
            setDraftForReview("");
            setAiReviewFlow(null);
          }}
          onContentTypeChange={(type) => {
            setActiveContentType(type);
            setManualDraft(null);
            setDraftForReview("");
            setAiReviewFlow(null);
          }}
          onTopicModeChange={(mode) => {
            setActiveTopicMode(mode);
            setManualDraft(null);
            setDraftForReview("");
            setAiReviewFlow(null);
          }}
          theme={theme}
          copied={copied}
          onCopy={handleCopy}
          onExport={() => {
            appendHistoryRecord({
              kind: "workflow",
              matchId: match.id,
              title: match.name,
              score: match.score,
              stage: match.stage,
              platforms: [platformMeta[activePlatform].title],
              route: `/matches/${match.id}`,
              summary: workflowTopic.title,
              sourceStatus: matchContext.matchInfo.sourceStatus
            });
            downloadTextFile(`${match.id}-${activePlatform}.md`, activeWorkflowDraft.body, "text/markdown;charset=utf-8");
            showWorkflowNotice(`${platformMeta[activePlatform].title} Markdown 已导出，并写入历史记录。`);
          }}
          onRegenerate={handleGeneratePlatformDraft}
        />
      </section>

      <section className="rounded-[32px] border bg-white p-6 shadow-[0_20px_70px_rgba(15,23,42,0.06)]" style={{ borderColor: theme.border }}>
        <SectionTitle eyebrow="RISK REVIEW" title="发布风险审稿" />
        <div className="mt-6 grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="rounded-[28px] border bg-slate-50 p-5" style={{ borderColor: theme.border }}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold" style={{ color: theme.primary }}>待审稿件</div>
              </div>
              <ActionButton onClick={handleAiReview} theme={theme} variant="secondary">
                {reviewLoading ? "审核中..." : "AI审核"}
              </ActionButton>
            </div>
            <textarea
              value={reviewSourceText}
              onChange={(event) => {
                setDraftForReview(event.target.value);
                setAiReviewFlow(null);
              }}
              className="mt-4 min-h-64 w-full resize-y rounded-2xl border border-slate-200 bg-white p-4 text-sm leading-7 text-slate-800 outline-none focus:border-emerald-300"
            />
            <div className="mt-4 flex flex-wrap gap-2">
              <ActionButton onClick={() => {
                setDraftForReview(getPublishableDraftText(activeWorkflowDraft));
                setAiReviewFlow(null);
              }} theme={theme} variant="secondary">
                读取当前生成稿件
              </ActionButton>
              <ActionButton onClick={() => {
                setDraftForReview(reviewFlow.rewriteSuggestion);
                setAiReviewFlow(null);
              }} theme={theme}>
                应用改写建议
              </ActionButton>
              <ActionButton onClick={() => handleCopy("review-rewrite", reviewFlow.rewriteSuggestion)} theme={theme} variant="secondary">
                <Clipboard className="h-4 w-4" />
                {copied === "review-rewrite" ? "已复制" : "复制改写"}
              </ActionButton>
            </div>
          </div>
          <div className="space-y-4">
            <div className="rounded-[28px] border bg-white p-5" style={{ borderColor: theme.border }}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full px-3 py-1 text-xs font-black text-white" style={{ backgroundColor: reviewFlow.result.level === "高" ? "#e11d48" : reviewFlow.result.level === "中" ? "#d97706" : theme.primary }}>
                  {reviewFlow.result.level}风险
                </span>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">分数 {reviewFlow.result.score}</span>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{reviewFlow.result.advice}</span>
              </div>
              <h3 className="mt-4 text-xl font-semibold text-slate-950">审核结果</h3>
              <div className="mt-4 space-y-3">
                {reviewFlow.riskPoints.map((item) => (
                  <div key={item} className="rounded-2xl bg-slate-50 p-4">
                    <ReadableTextBlock text={item} />
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-[28px] border bg-white p-5" style={{ borderColor: theme.border }}>
              <h3 className="text-xl font-semibold text-slate-950">改写建议</h3>
              <ReadableTextBlock text={reviewFlow.rewriteSuggestion} className="mt-3 rounded-2xl bg-emerald-50/60 p-4" />
            </div>
            <div className="rounded-[28px] border bg-white p-5" style={{ borderColor: theme.border }}>
              <h3 className="text-xl font-semibold text-slate-950">发布前检查</h3>
              <div className="mt-3 space-y-2">
                {reviewFlow.checklist.map((item) => (
                  <div key={item} className="flex gap-2 text-sm leading-6 text-slate-600">
                    <Check className="mt-1 h-4 w-4 shrink-0 text-emerald-600" />
                    <span className="leading-relaxed text-slate-700"><HighlightedText text={item} /></span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="flex flex-wrap items-center justify-between gap-4 rounded-[32px] border bg-white p-6 shadow-[0_20px_70px_rgba(15,23,42,0.06)]" style={{ borderColor: theme.border }}>
        <div>
          <h2 className="text-2xl font-semibold text-slate-950">复制 / 导出</h2>
        </div>
        <div className="flex flex-wrap gap-3">
          <ActionButton onClick={() => handleCopy("all", selectedText)} theme={theme} variant="secondary">
            <Clipboard className="h-4 w-4" />
            {copied === "all" ? "已复制全部" : "复制全部内容"}
          </ActionButton>
          <ActionButton onClick={() => {
            appendHistoryRecord({
              kind: "workflow",
              matchId: match.id,
              title: match.name,
              score: match.score,
              stage: match.stage,
              platforms: ["Markdown 报告"],
              route: `/matches/${match.id}`,
              summary: workflowTopic.title,
              sourceStatus: matchContext.matchInfo.sourceStatus
            });
            downloadTextFile(`${match.id}-content-report.md`, markdown, "text/markdown;charset=utf-8");
            showWorkflowNotice("Markdown 报告已导出，并写入历史记录。");
          }} theme={theme}>
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
  const homeTeam = sourceMatch ? localizeTeamName(sourceMatch.homeTeam.name) : match.teamA;
  const awayTeam = sourceMatch ? localizeTeamName(sourceMatch.awayTeam.name) : match.teamB;
  const score = sourceMatch?.score.display ?? match.score;
  const round = sourceMatch ? localizeRoundName(sourceMatch.round) : match.stage;
  const statusText = sourceMatch ? localizeMatchStatus(sourceMatch.statusText) : (match.isExample ? "经典样例" : "真实数据");
  const kickoffTime = sourceMatch?.kickoffTime ?? match.time;
  const venue = [sourceMatch?.venue.name, sourceMatch?.venue.city].filter(Boolean).map(localizeVenueText).join("｜");
  const dataTag = sourceMatch ? sourceProviderTag(sourceMatch.source.provider) : match.isExample ? "经典样例" : "运营数据";
  const hasBasicCoverageOnly = sourceMatch?.source.provider === "sportradar" && !sourceMatch.events.length && sourceMatch.statistics.every((statistic) =>
    statistic.values.every((entry) => entry.type === "Goals" || entry.type === "Data Coverage")
  );
  const actionTitle = `优先做${primaryTopic.recommendedFormat}`;
  const actionBody = `先用“${primaryTopic.title}”建立内容主线，再用比分、控球、射门、射正和事件说明做证据层，最后按 B站深度、微博讨论、小红书解释卡分发。`;

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
          <SourceStatusLine
            status={sourceStatus}
            provider={sourceMatch?.source.provider}
            lastUpdated={lastUpdated}
            loading={loading}
            error={error}
          />
          {hasBasicCoverageOnly ? (
            <div className="mt-3 max-w-3xl rounded-2xl border border-amber-200 bg-amber-50/90 px-4 py-3 text-sm leading-6 text-amber-800">
              当前 Sportradar trial/basic 只返回赛程、比分和基础进球覆盖，暂未返回事件流与完整技术统计。AI 分析会按“需补充事件源”处理，不会自动推断进球过程、判罚或伤病。
            </div>
          ) : null}
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
  provider,
  lastUpdated,
  loading,
  error
}: {
  status: SourceStatus;
  provider?: WorldCupMatch["source"]["provider"];
  lastUpdated?: string;
  loading?: boolean;
  error?: string;
}) {
  return (
    <div className="mt-4 inline-flex flex-wrap items-center gap-2 rounded-full bg-white/80 px-4 py-2 text-xs font-semibold text-slate-600 shadow-sm">
      <span>数据来源：{loading ? "加载中" : sourceLabel(status, provider)}</span>
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

function SectionTitle({ eyebrow, title, description }: { eyebrow: string; title: string; description?: string }) {
  return (
    <div>
      <div className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">{eyebrow}</div>
      <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">{title}</h2>
      {description ? <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">{description}</p> : null}
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
      <p className="mt-3 text-sm font-medium leading-relaxed text-slate-700"><HighlightedText text={body} /></p>
    </div>
  );
}

function DataAngleCard({ label, value, compare, explain, angle, theme }: { label: string; value: string; compare: string; explain: string; angle: string; theme: SportTheme }) {
  return (
    <div className="rounded-[28px] border bg-white p-5 shadow-sm transition hover:-translate-y-1" style={{ borderColor: theme.border }}>
      <div className="text-sm font-semibold text-slate-500">{label}</div>
      <div className="mt-3 text-4xl font-black tracking-tight" style={{ color: theme.strongText }}>{value}</div>
      <div className="mt-1 text-sm font-semibold" style={{ color: theme.primary }}>{compare}</div>
      <p className="mt-4 text-sm leading-relaxed text-slate-700"><HighlightedText text={explain} /></p>
      <div className="mt-4 rounded-2xl p-3 text-sm font-medium leading-relaxed" style={{ backgroundColor: theme.background, color: theme.secondary }}>
        内容转化：<HighlightedText text={angle} />
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

function MatchHotspotCard({
  hotspot,
  theme,
  copied,
  onCopy,
  onUse
}: {
  hotspot: ReturnType<typeof buildMatchHotspotShortlist>[number];
  theme: SportTheme;
  copied: boolean;
  onCopy: () => void;
  onUse: () => void;
}) {
  return (
    <article className="rounded-[28px] border bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-[0_18px_48px_rgba(15,23,42,0.08)]" style={{ borderColor: hotspot.rank <= 3 ? theme.primary : theme.border }}>
      <div className="flex items-start gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-base font-black text-white" style={{ backgroundColor: hotspot.rank <= 3 ? theme.primary : theme.secondary }}>
          {hotspot.rank}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap gap-2">
            <HotspotBadge>{compactHotspotLabel(hotspot.platform || "全网")}</HotspotBadge>
            <HotspotBadge>{compactHotspotLabel(hotspot.source)}</HotspotBadge>
            <span className="inline-flex max-w-24 items-center rounded-full px-2.5 py-1 text-[11px] font-semibold text-white" style={{ backgroundColor: theme.primary }}>
              热度 {hotspot.heat ?? hotspot.valueScore}
            </span>
          </div>
          <h3 className="mt-4 text-xl font-semibold leading-tight text-slate-950">{hotspot.title}</h3>
          <div className="mt-4 flex flex-wrap gap-2">
            <ActionButton onClick={onUse} theme={theme}>
              {hotspot.actionText}
            </ActionButton>
            <ActionButton onClick={onCopy} theme={theme} variant="secondary">
              <Clipboard className="h-4 w-4" />
              {copied ? "已复制" : "复制热点"}
            </ActionButton>
            {hotspot.url ? (
              <a href={hotspot.url} target="_blank" rel="noreferrer" className="inline-flex h-11 items-center justify-center rounded-full border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:-translate-y-0.5">
                打开来源
              </a>
            ) : null}
          </div>
        </div>
      </div>
    </article>
  );
}

function HotspotBadge({ children }: { children: ReactNode }) {
  return <span className="inline-flex max-w-24 items-center truncate rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">{children}</span>;
}

function compactHotspotLabel(value: string) {
  return value.split(/[\/｜|]/)[0]?.trim() || value;
}

function PlatformOutputCard({
  platform,
  active,
  decision,
  theme,
  onClick
}: {
  platform: PlatformKey;
  active: boolean;
  decision: PlatformDecision;
  theme: SportTheme;
  onClick: () => void;
}) {
  const meta = platformMeta[platform];
  const tone = platformCardTone(platform, decision.fit, active);
  return (
    <button
      onClick={onClick}
      className={`rounded-[26px] border p-4 text-left transition hover:-translate-y-1 hover:shadow-[0_20px_56px_rgba(15,23,42,0.08)] ${tone.card}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="text-xl font-semibold text-slate-950">{meta.title}</div>
        <span className={`rounded-full px-2.5 py-1 text-xs font-black ${tone.badge}`}>
          {decision.fit}
        </span>
      </div>
      <div className="mt-3 flex items-end gap-2">
        <span className={`text-3xl font-black ${tone.score}`}>{decision.score}</span>
        <span className="mb-1 text-xs font-semibold text-slate-400">适配分</span>
      </div>
    </button>
  );
}

function PlatformPreview({
  className,
  platform,
  draft,
  topics,
  selectedTopicId,
  contentType,
  topicMode,
  draftLoading,
  onTopicChange,
  onContentTypeChange,
  onTopicModeChange,
  theme,
  copied,
  onCopy,
  onExport,
  onRegenerate
}: {
  className?: string;
  platform: PlatformKey;
  draft: PlatformDraft | null;
  topics: TopicIdea[];
  selectedTopicId: string;
  contentType: ContentTypeKey;
  topicMode: TopicModeKey;
  draftLoading: boolean;
  onTopicChange: (topicId: string) => void;
  onContentTypeChange: (type: ContentTypeKey) => void;
  onTopicModeChange: (mode: TopicModeKey) => void;
  theme: SportTheme;
  copied: string | null;
  onCopy: (key: string, value: string) => void;
  onExport: () => void;
  onRegenerate: () => void;
}) {
  const generatedText = draft?.body ?? "";
  return (
    <div className={`rounded-[28px] border bg-white p-5 ${className ?? ""}`} style={{ borderColor: theme.border }}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-sm font-semibold" style={{ color: theme.primary }}>{platformMeta[platform].title}</div>
          {draft ? <h3 className="mt-2 text-2xl font-semibold text-slate-950">{draft.title}</h3> : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <ActionButton onClick={onRegenerate} theme={theme} variant="secondary">
            <RefreshCcw className="h-4 w-4" />
            {draftLoading ? "生成中..." : draft ? "重新生成" : platformMeta[platform].action}
          </ActionButton>
          {draft ? (
            <>
              <ActionButton onClick={() => onCopy(`platform-${platform}`, generatedText)} theme={theme} variant="secondary">
                <Clipboard className="h-4 w-4" />
                {copied === `platform-${platform}` ? "已复制" : "复制"}
              </ActionButton>
              <ActionButton onClick={onExport} theme={theme} variant="secondary">
                <Download className="h-4 w-4" />
                导出
              </ActionButton>
            </>
          ) : null}
        </div>
      </div>
      <div className="mt-5 grid gap-3 md:grid-cols-3">
        <label className="text-sm font-semibold text-slate-600">
          选题
          <select
            value={selectedTopicId}
            onChange={(event) => onTopicChange(event.target.value)}
            className="mt-2 h-11 w-full rounded-2xl border border-emerald-200 bg-white px-3 text-sm font-semibold text-slate-800 outline-none focus:border-emerald-400"
          >
            {topics.map((topic) => (
              <option key={topic.id} value={topic.id}>{topic.title}</option>
            ))}
          </select>
        </label>
        <label className="text-sm font-semibold text-slate-600">
          内容类型
          <select
            value={contentType}
            onChange={(event) => onContentTypeChange(event.target.value as ContentTypeKey)}
            className="mt-2 h-11 w-full rounded-2xl border border-emerald-200 bg-white px-3 text-sm font-semibold text-slate-800 outline-none focus:border-emerald-400"
          >
            {contentTypeOptions.map((item) => (
              <option key={item.key} value={item.key}>{item.label}</option>
            ))}
          </select>
        </label>
        <label className="text-sm font-semibold text-slate-600">
          选题方向
          <select
            value={topicMode}
            onChange={(event) => onTopicModeChange(event.target.value as TopicModeKey)}
            className="mt-2 h-11 w-full rounded-2xl border border-emerald-200 bg-white px-3 text-sm font-semibold text-slate-800 outline-none focus:border-emerald-400"
          >
            {topicModeOptions.map((item) => (
              <option key={item.key} value={item.key}>{item.label}</option>
            ))}
          </select>
        </label>
      </div>
      {draft ? (
        <ReadableTextBlock text={generatedText} className="mt-5 rounded-2xl bg-slate-50 p-5" />
      ) : null}
    </div>
  );
}

function getPublishableDraftText(draft: PlatformDraft) {
  return draft.sections.find((section) => section.title.includes("可直接发布"))?.content ?? draft.body;
}

function buildPlatformDecisions(match: MatchData, signals: MatchSignal[], topic: TopicIdea): Record<PlatformKey, PlatformDecision> {
  const eventCount = match.keyEvents.length;
  const playerCount = match.keyPlayers.length;
  const scoreParts = match.score.match(/\d+/g)?.map(Number) ?? [];
  const goalTotal = scoreParts.reduce((sum, item) => sum + item, 0);
  const shotGap = Math.abs(match.stats.teamA.shots - match.stats.teamB.shots);
  const onTargetTotal = match.stats.teamA.shotsOnTarget + match.stats.teamB.shotsOnTarget;
  const signalValue = Math.max(...signals.map((signal) => signal.contentValue), 0);
  const hasPenalty = Boolean(match.penaltyScore) || match.keyEvents.some((event) => event.type.includes("点"));
  const hasLateEvent = match.keyEvents.some((event) => /8\d|9\d|加时|点球|终场/.test(event.minute));

  const deepScore = clampPlatformScore(58 + eventCount * 4 + playerCount * 3 + Math.min(shotGap, 12) + (hasPenalty ? 8 : 0));
  const weiboScore = clampPlatformScore(56 + goalTotal * 5 + (hasLateEvent ? 10 : 0) + Math.round(signalValue / 8));
  const xhsScore = clampPlatformScore(52 + playerCount * 5 + Math.min(onTargetTotal, 12) + (topic.category.includes("人物") ? 8 : 0));
  const douyinScore = clampPlatformScore(46 + goalTotal * 6 + (hasLateEvent ? 12 : 0) + (eventCount >= 4 ? 8 : 0));
  const articleScore = clampPlatformScore(60 + eventCount * 3 + match.historicalMeetings.length * 4 + Math.min(shotGap, 10));

  return {
    bilibili: {
      fit: scoreToFit(deepScore),
      score: deepScore,
      reason: eventCount >= 3 ? "事件线够完整，适合做复盘。" : "信息偏基础，适合做短复盘。",
      deliverable: "标题、封面、结构、开头口播",
      caution: "别只剪比分，先补证据。"
    },
    weibo: {
      fit: scoreToFit(weiboScore),
      score: weiboScore,
      reason: goalTotal >= 3 || hasLateEvent ? "有讨论点，适合快速承接。" : "热度一般，适合观点短评。",
      deliverable: "短评、话题、评论区引导",
      caution: "争议表达要留核验口。"
    },
    xiaohongshu: {
      fit: scoreToFit(xhsScore),
      score: xhsScore,
      reason: playerCount >= 2 ? "人物和数据都能拆成卡片。" : "适合做基础看球解释。",
      deliverable: "封面、卡片结构、正文",
      caution: "少用绝对判断，多用解释。"
    },
    douyin: {
      fit: scoreToFit(douyinScore),
      score: douyinScore,
      reason: goalTotal >= 3 || hasLateEvent ? "有短视频钩子。" : "缺少强瞬间，先谨慎。",
      deliverable: "3秒钩子、15秒/30秒口播",
      caution: "没有画面版权时用数据卡。"
    },
    article: {
      fit: scoreToFit(articleScore),
      score: articleScore,
      reason: match.historicalMeetings.length ? "有历史纵深，适合沉淀。" : "可做赛后长文。",
      deliverable: "标题、导语、结构、结尾",
      caution: "长文要标清数据来源。"
    }
  };
}

function scoreToFit(score: number): PlatformFit {
  if (score >= 78) return "主推";
  if (score >= 62) return "可做";
  return "谨慎";
}

function clampPlatformScore(score: number) {
  return Math.max(45, Math.min(96, score));
}

const promotedPlatformTone: Record<PlatformKey, { card: string; badge: string; score: string }> = {
  bilibili: {
    card: "border-pink-200/60 bg-gradient-to-b from-pink-50/70 to-white shadow-sm",
    badge: "bg-pink-50 text-pink-700 ring-1 ring-pink-200/70",
    score: "text-pink-600"
  },
  weibo: {
    card: "border-orange-200/60 bg-gradient-to-b from-orange-50/70 to-white shadow-sm",
    badge: "bg-orange-50 text-orange-700 ring-1 ring-orange-200/70",
    score: "text-orange-600"
  },
  xiaohongshu: {
    card: "border-rose-200/60 bg-gradient-to-b from-rose-50/70 to-white shadow-sm",
    badge: "bg-rose-50 text-rose-700 ring-1 ring-rose-200/70",
    score: "text-rose-600"
  },
  douyin: {
    card: "border-cyan-200/60 bg-gradient-to-b from-cyan-50/70 to-white shadow-sm",
    badge: "bg-cyan-50 text-cyan-700 ring-1 ring-cyan-200/70",
    score: "text-cyan-600"
  },
  article: {
    card: "border-emerald-200/70 bg-gradient-to-b from-emerald-50/80 to-white shadow-sm",
    badge: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/80",
    score: "text-emerald-700"
  }
};

function platformCardTone(platform: PlatformKey, fit: PlatformFit, active: boolean) {
  const activeRing = active ? "ring-2 ring-emerald-200/80" : "";

  // 主推卡片按平台品牌色提升权重；可做卡片保持后退，避免全部抢视觉。
  if (fit === "主推") {
    const tone = promotedPlatformTone[platform];
    return {
      card: `${tone.card} ${activeRing}`,
      badge: tone.badge,
      score: tone.score
    };
  }

  if (fit === "可做") {
    return {
      card: `border-slate-100 bg-white shadow-[0_1px_0_rgba(15,23,42,0.03)] ${activeRing}`,
      badge: "bg-slate-50 text-slate-500 ring-1 ring-slate-200/80",
      score: "text-slate-700"
    };
  }

  return {
    card: `border-amber-100 bg-white shadow-[0_1px_0_rgba(15,23,42,0.03)] ${activeRing}`,
    badge: "bg-amber-50 text-amber-700 ring-1 ring-amber-200/70",
    score: "text-amber-700"
  };
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
  const possessionGap = Math.abs(match.stats.teamA.possession - match.stats.teamB.possession);
  const shotTotal = match.stats.teamA.shots + match.stats.teamB.shots;
  const onTargetTotal = match.stats.teamA.shotsOnTarget + match.stats.teamB.shotsOnTarget;
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
          ? "双方控球接近，运营表达应重点转向射正和关键事件，不要硬写谁完全控制比赛。"
          : `${possessionLeader.name}控球多出 ${possessionGap}%，但控球是否形成威胁，还要继续看射正和事件说明。`,
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

function buildMatchContext(match: MatchData, signals: MatchSignal[], sourceStatus: SourceStatus): MatchContext {
  return {
    id: match.id,
    matchInfo: {
      id: match.id,
      name: match.name,
      teamA: match.teamA,
      teamB: match.teamB,
      score: match.score,
      stage: match.stage,
      time: match.time,
      sourceStatus
    },
    keyEvents: match.keyEvents.map((event) => ({
      minute: event.minute,
      team: event.team,
      type: event.type,
      description: event.description
    })),
    keyPlayers: match.keyPlayers.map((player) => ({
      name: player.name,
      team: player.team,
      role: player.role,
      rating: player.rating
    })),
    stats: match.stats,
    hotSignals: signals.map((signal) => ({
      label: signal.label,
      topicSeed: signal.topicSeed,
      contentValue: signal.contentValue
    })),
    summary: match.summary
  };
}

function topicToWorkflowTopic(topic: TopicIdea): WorkflowTopic {
  return {
    id: topic.id,
    title: topic.title,
    category: topic.category,
    coreAngle: topic.coreAngle,
    reason: topic.reason,
    riskLevel: topic.riskLevel,
    recommendedFormat: topic.recommendedFormat
  };
}

function toWorkflowPlatform(platform: PlatformKey) {
  return platform === "douyin" ? "douyin" : platform;
}

function getStoredDeepseekKey() {
  if (typeof window === "undefined") return "";
  try {
    const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    const settings = raw ? (JSON.parse(raw) as { deepseekKey?: string }) : null;
    return settings?.deepseekKey?.trim() ?? "";
  } catch {
    return "";
  }
}

function getStoredHotSearchHeaders() {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    const settings = raw ? (JSON.parse(raw) as { tavilyKey?: string; topHubDataKey?: string }) : null;
    const headers: Record<string, string> = {};
    if (settings?.tavilyKey?.trim()) headers["x-worldcup-tavily-key"] = settings.tavilyKey.trim();
    if (settings?.topHubDataKey?.trim()) headers["x-worldcup-tophubdata-key"] = settings.topHubDataKey.trim();
    return headers;
  } catch {
    return {};
  }
}

async function fetchHotPayload(url: string, signal: AbortSignal, headers?: Record<string, string>): Promise<HotSearchPayload> {
  const response = await fetch(url, {
    cache: "no-store",
    headers,
    signal
  });
  const payload = (await response.json().catch(() => null)) as HotSearchPayload | null;
  if (!response.ok || !payload) {
    throw new Error(payload?.message || `热点接口请求失败：${response.status}`);
  }
  return payload;
}

function readHotRadarCache(): HotRadarCache | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(HOT_RADAR_CACHE_KEY);
    return raw ? (JSON.parse(raw) as HotRadarCache) : null;
  } catch {
    return null;
  }
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
  if (platform === "douyin") {
    const items = [
      { label: "前三秒钩子", value: content.shortVideo.threeSecondHook },
      { label: "15秒口播", value: content.shortVideo.fifteenSec },
      { label: "30秒口播", value: content.shortVideo.thirtySec },
      { label: "60秒口播", value: content.shortVideo.sixtySec },
      { label: "画面素材清单", value: content.shortVideo.materialList.join(" / ") }
    ];
    return { title: "抖音短视频口播包", items, fullText: items.map((item) => `${item.label}：${item.value}`).join("\n") };
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
  return [
    `# ${platformMeta[platform].title} 内容预览`,
    "",
    "## 可直接发布版",
    preview.items[0] ? `${preview.items[0].label}：${preview.items[0].value}` : preview.title,
    "",
    "## 编辑参考版",
    preview.fullText,
    "",
    "## 风险提示版",
    "涉及伤病、冲突、内部矛盾和裁判争议时，发布前先核验来源。"
  ].join("\n");
}

function buildMarkdown(title: string, topic: TopicIdea, content: PlatformContent, advice: string) {
  return [
    `# ${title} 内容处理报告`,
    "",
    "## 可直接发布版",
    `B站：${content.bilibili.titles[0]}`,
    `微博：${content.weibo.fiveMinuteComment}`,
    `小红书：${content.xiaohongshu.coverTitle}`,
    "",
    "## 编辑参考版",
    `核心选题：${topic.title}`,
    `核心看点：${topic.coreAngle}`,
    buildSelectedContent(content, ["bilibili", "weibo", "xiaohongshu", "article"]),
    "",
    "## 风险提示版",
    `发布建议：${advice}`,
    "当前内容基于项目数据和规则生成。发布前需核实事实、数据来源、素材版权和平台规则。"
  ].join("\n");
}

function getMatchRefreshMs(match: WorldCupMatch) {
  if (match.status === "live") return 15_000;
  if (match.status === "finished") return undefined;
  if (match.status === "scheduled") return 30_000;
  return 30_000;
}

function matchRefreshPolicy(payload: WorldCupPayload<WorldCupMatch>) {
  return getMatchRefreshMs(payload.data);
}

function sourceLabel(status: SourceStatus, provider?: WorldCupMatch["source"]["provider"]) {
  const providerName = providerSourceName(provider);
  if (provider === "thestatsapi-fixtures" && status === "live") return "TheStatsAPI 兜底数据";
  if (provider === "thestatsapi-fixtures" && status === "cache") return "TheStatsAPI 兜底缓存";
  if (status === "live") return providerName ? `${providerName} 实时数据` : "真实 API 数据";
  if (status === "cache") return providerName ? `${providerName} 缓存数据` : "缓存数据";
  if (status === "fallback") return "示例数据";
  return "请求失败";
}

function formatSourceIssue(message?: string) {
  if (!message) return "";
  if (/429|limit exceeded/i.test(message)) return "Sportradar 当前限流，已切换兜底源";
  if (/sportradar/i.test(message)) return "Sportradar 暂不可用，已切换兜底源";
  return message;
}

function providerSourceName(provider?: WorldCupMatch["source"]["provider"]) {
  const labels: Partial<Record<WorldCupMatch["source"]["provider"], string>> = {
    sportradar: "Sportradar",
    "api-football": "API-Football",
    "worldcup26-free": "免费赛程源",
    "thestatsapi-fixtures": "TheStatsAPI",
    mock: "经典样例"
  };
  return provider ? labels[provider] : undefined;
}

function sourceProviderTag(provider: WorldCupMatch["source"]["provider"]) {
  const labels: Record<WorldCupMatch["source"]["provider"], string> = {
    sportradar: "Sportradar 数据",
    "api-football": "真实 API 数据",
    "worldcup26-free": "WorldCup26 免费 API",
    "thestatsapi-fixtures": "TheStatsAPI 免费赛程",
    mock: "经典样例"
  };
  return labels[provider];
}

function formatSourceDate(value: string) {
  return formatBeijingDateTime(value, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}
