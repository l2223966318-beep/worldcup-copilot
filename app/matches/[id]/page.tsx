"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
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
import { generatePlatformContent, type PlatformContent } from "@/lib/ai/content";
import { reviewRisk } from "@/lib/ai/risk";
import { generateTopics, type TopicIdea } from "@/lib/ai/topics";
import { copyToClipboard, downloadTextFile } from "@/lib/download";
import { analyzeMatch, getMatchDetail, getMatchTask } from "@/lib/project-api";
import { getMatchSportType, getSportTheme, type SportTheme } from "@/lib/sport-theme";

const platformLabels = {
  bilibili: "B站",
  weibo: "微博",
  xiaohongshu: "小红书",
  article: "公众号"
} as const;

type PlatformKey = keyof typeof platformLabels;

const platformMeta: Record<PlatformKey, { title: string; positioning: string; action: string }> = {
  bilibili: { title: "B站", positioning: "深度视频、人物复盘、战术复盘", action: "生成 B站脚本" },
  weibo: { title: "微博", positioning: "热点讨论、话题扩散、情绪传播", action: "生成微博话题" },
  xiaohongshu: { title: "小红书", positioning: "图文收藏、新手看球解释、轻表达", action: "生成小红书图文" },
  article: { title: "公众号", positioning: "深度评论、历史纵深、长文沉淀", action: "生成公众号长文" }
};

export default function MatchAnalysisPage() {
  const params = useParams<{ id: string }>();
  const match = getMatchDetail(params.id);
  const task = getMatchTask(params.id);
  const theme = getSportTheme(getMatchSportType(match.id));
  const analysis = useMemo(() => analyzeMatch(match), [match]);
  const topics = useMemo(() => normalizeTopics(generateTopics(match).slice(0, 3)), [match]);
  const [selectedTopicId, setSelectedTopicId] = useState(topics[0]?.id);
  const selectedTopic = topics.find((topic) => topic.id === selectedTopicId) ?? topics[0];
  const [activePlatform, setActivePlatform] = useState<PlatformKey>("bilibili");
  const [copied, setCopied] = useState<string | null>(null);
  const [rewriteApplied, setRewriteApplied] = useState<string | null>(null);

  const content = useMemo(() => generatePlatformContent(match, selectedTopic), [match, selectedTopic]);
  const selectedText = useMemo(() => buildSelectedContent(content, ["bilibili", "weibo", "xiaohongshu", "article"]), [content]);
  const risk = useMemo(() => reviewRisk(selectedText), [selectedText]);
  const markdown = useMemo(() => buildMarkdown(match.name, selectedTopic, content, risk.advice), [content, match.name, risk.advice, selectedTopic]);

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

      <MatchHero matchName={match.name} taskPriority={task.priority} theme={theme} />

      <section className="grid gap-4 lg:grid-cols-3">
        <ConclusionCard
          title="为什么值得做"
          body="球星叙事、历史意义和情绪反转同时成立，具备赛后短爆发和长尾复盘双重价值。"
          theme={theme}
        />
        <ConclusionCard
          title="先做什么"
          body="主推“梅西职业生涯最后拼图”，先做 B站 8 分钟人物复盘，再用微博承接话题讨论。"
          theme={theme}
          featured
        />
        <ConclusionCard
          title="注意什么风险"
          body="避免制造梅西和姆巴佩对立，表达重点放在时代交接、竞技张力和事实依据。"
          theme={theme}
        />
      </section>

      <section className="rounded-[32px] border bg-white p-6 shadow-[0_20px_70px_rgba(15,23,42,0.06)]" style={{ borderColor: theme.border }}>
        <SectionTitle eyebrow="DATA TO ANGLE" title="核心数据如何转成内容角度" description="数据不是为了摆出来，而是帮助运营判断这场比赛应该怎么讲。" />
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <DataAngleCard
            label="控球率"
            value={`${match.stats.teamA.possession}% / ${match.stats.teamB.possession}%`}
            compare={`${match.teamA} vs ${match.teamB}`}
            explain="阿根廷掌握更多比赛时间，但控球本身不是唯一重点。"
            angle="可以讨论“控球是否等于控制比赛”。"
            theme={theme}
          />
          <DataAngleCard
            label="射门 / 射正"
            value={`${match.stats.teamA.shots}-${match.stats.teamA.shotsOnTarget} / ${match.stats.teamB.shots}-${match.stats.teamB.shotsOnTarget}`}
            compare="进攻密度"
            explain="双方进攻效率高，比赛信息密度强。"
            angle="可以做“为什么这场决赛被认为是神级决赛”。"
            theme={theme}
          />
          <DataAngleCard
            label="xG"
            value={`${match.stats.teamA.xg} / ${match.stats.teamB.xg}`}
            compare="机会质量"
            explain="机会质量接近，但阿根廷整体输出更稳定。"
            angle="适合支撑战术复盘和胜负原因分析。"
            theme={theme}
          />
        </div>
      </section>

      <section className="rounded-[32px] border bg-white p-6 shadow-[0_20px_70px_rgba(15,23,42,0.06)]" style={{ borderColor: theme.border }}>
        <SectionTitle eyebrow="CHART INSIGHTS" title="图表服务内容创作" description="每张图表都配运营解释和可复制金句，用来快速变成脚本、标题或长文段落。" />
        <div className="mt-6">
          <InsightCharts match={match} theme={theme} />
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
          {[
            ["舆情风险", "中", "避免制造球星粉丝对立，把重点放在时代交接与竞技张力。"],
            ["表达风险", risk.level, risk.findings[0]?.rewrite ?? "当前表达整体稳妥，发布前仍建议补充数据来源。"],
            ["版权风险", "低", "使用比赛画面时注意版权边界，可优先使用自制图表和公开数据。"],
            ["标题党风险", "中", "标题可以有冲突感，但不要使用黑幕、保送、确认伤退等定性词。"],
            ["平台适配风险", "低", "微博适合短讨论，B站适合深复盘，小红书适合解释型卡片。"]
          ].map(([title, level, advice]) => (
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

function MatchHero({ matchName, taskPriority, theme }: { matchName: string; taskPriority: string; theme: SportTheme }) {
  return (
    <section className={`relative overflow-hidden rounded-[40px] border bg-gradient-to-br ${theme.gradient} p-7 shadow-[0_28px_90px_rgba(15,23,42,0.08)] lg:p-10`} style={{ borderColor: theme.border }}>
      <FieldPattern theme={theme} />
      <div className="relative z-10 grid gap-8 lg:grid-cols-[1fr_360px] lg:items-end">
        <div>
          <div className="flex flex-wrap gap-2">
            {["世界杯决赛", "经典样例", "高热度比赛"].map((tag) => (
              <span key={tag} className="rounded-full bg-white/80 px-3 py-1 text-xs font-semibold shadow-sm" style={{ color: theme.secondary }}>
                {tag}
              </span>
            ))}
          </div>
          <p className="mt-8 text-sm font-semibold uppercase tracking-[0.2em]" style={{ color: theme.secondary }}>{matchName}</p>
          <div className="mt-4 flex flex-wrap items-end gap-4">
            <div className="text-5xl font-black tracking-tight text-slate-950 lg:text-7xl">阿根廷</div>
            <div className="rounded-[28px] bg-white px-6 py-4 text-5xl font-black shadow-xl shadow-slate-900/10 lg:text-7xl" style={{ color: theme.primary }}>
              3 - 3
            </div>
            <div className="text-5xl font-black tracking-tight text-slate-950 lg:text-7xl">法国</div>
          </div>
          <p className="mt-5 text-base font-medium text-slate-600">决赛｜已结束｜点球大战 4-2｜2022-12-18</p>
          <div className="mt-8 rounded-3xl border bg-white/82 p-5 shadow-sm backdrop-blur" style={{ borderColor: theme.border }}>
            <div className="text-sm font-semibold" style={{ color: theme.secondary }}>推荐动作</div>
            <p className="mt-2 text-2xl font-semibold leading-tight text-slate-950">优先做 B站人物复盘 + 微博话题承接</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">先用“梅西职业生涯最后拼图”打穿情绪，再用数据和历史交锋支撑长尾复盘。</p>
          </div>
        </div>

        <div className="rounded-[32px] border bg-white/88 p-6 shadow-xl shadow-slate-900/10 backdrop-blur" style={{ borderColor: theme.border }}>
          <div className="text-sm font-semibold text-slate-500">内容机会评分</div>
          <div className="mt-3 flex items-end gap-3">
            <span className="text-7xl font-black" style={{ color: theme.primary }}>{taskPriority}</span>
            <span className="mb-3 text-xl font-semibold text-slate-950">级内容机会</span>
          </div>
          <div className="mt-5 space-y-4">
            <ScoreBar label="热度" value={96} theme={theme} />
            <ScoreBar label="情绪" value={94} theme={theme} />
            <ScoreBar label="叙事" value={98} theme={theme} />
            <ScoreBar label="长尾价值" value={92} theme={theme} />
          </div>
        </div>
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

function normalizeTopics(topics: TopicIdea[]) {
  if (!topics.length) return topics;
  const [first, ...rest] = topics;
  return [
    { ...first, title: "梅西职业生涯最后拼图" },
    rest[0] ? { ...rest[0], title: "控球并不等于控制比赛" } : rest[0],
    rest[1] ? { ...rest[1], title: "姆巴佩的帽子戏法为什么仍然输了" } : rest[1]
  ].filter(Boolean) as TopicIdea[];
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
