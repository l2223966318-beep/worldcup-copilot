import Link from "next/link";
import { ArrowRight, CheckCircle2, CircleDot, Flame, ShieldAlert, Sparkles, Trophy } from "lucide-react";

import { getCurrentProject, getTodayMatches, type MatchTask } from "@/lib/project-api";
import { getSportTheme, sportThemes, type SportTheme } from "@/lib/sport-theme";

export default function DashboardPage() {
  const project = getCurrentProject();
  const theme = getSportTheme("football");
  const matches = getTodayMatches(project.id);
  const priorityMatches = matches.filter((item) => item.priority === "S" || item.priority === "A");
  const watchMatches = matches.filter((item) => item.priority === "B");

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-8 pb-16">
      <section className={`relative overflow-hidden rounded-[40px] border bg-gradient-to-br ${theme.gradient} p-7 shadow-[0_28px_90px_rgba(15,23,42,0.08)] lg:p-10`} style={{ borderColor: theme.border }}>
        <HeroPattern theme={theme} />
        <div className="relative z-10 grid gap-8 lg:grid-cols-[1fr_380px] lg:items-end">
          <div>
            <div className="inline-flex rounded-full bg-white/80 px-4 py-2 text-sm font-semibold shadow-sm" style={{ color: theme.secondary }}>
              当前项目：{project.name}
            </div>
            <h1 className="mt-8 max-w-4xl text-5xl font-black leading-tight tracking-tight text-slate-950 lg:text-7xl">
              WorldCup Copilot
            </h1>
            <p className="mt-5 max-w-2xl text-xl leading-9 text-slate-700">
              从赛事数据到平台分发，帮运营人员快速找到值得做的内容角度。
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="#opportunity-pool"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold text-white shadow-lg transition hover:-translate-y-0.5"
                style={{ backgroundColor: theme.primary, boxShadow: `0 18px 38px ${theme.heroGlow}` }}
              >
                查看今日比赛池
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/matches/argentina-france-2022-final"
                className="inline-flex h-12 items-center justify-center rounded-full border border-white bg-white/85 px-5 text-sm font-semibold text-slate-900 shadow-sm transition hover:-translate-y-0.5"
              >
                查看经典样例
              </Link>
            </div>
          </div>
          <div className="rounded-[32px] border bg-white/85 p-6 shadow-xl shadow-slate-900/10 backdrop-blur" style={{ borderColor: theme.border }}>
            <div className="flex items-center gap-3">
              <Trophy className="h-6 w-6" style={{ color: theme.primary }} />
              <div className="text-lg font-semibold text-slate-950">今日运营建议</div>
            </div>
            <div className="mt-5 grid grid-cols-3 gap-3">
              <HeroMetric label="优先做" value={priorityMatches.length} theme={theme} />
              <HeroMetric label="观望" value={watchMatches.length} theme={theme} />
              <HeroMetric label="不投入" value={0} theme={theme} />
            </div>
            <div className="mt-5 rounded-2xl p-4 text-sm leading-6" style={{ backgroundColor: theme.background, color: theme.mutedText }}>
              今日主推内容方向：球星叙事 + 数据解释。风险提醒：避免制造球星对立和判罚阴谋论。
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {Object.values(sportThemes).map((item) => (
          <div key={item.sportType} className={`rounded-[28px] border bg-gradient-to-br ${item.gradient} p-5 shadow-sm`} style={{ borderColor: item.border }}>
            <div className="text-lg font-semibold" style={{ color: item.strongText }}>{item.name}主题</div>
            <p className="mt-2 text-sm leading-6" style={{ color: item.mutedText }}>{item.pattern}</p>
            <div className="mt-4 flex gap-2">
              {[item.primary, item.secondary, item.accent].map((color) => (
                <span key={color} className="h-8 w-8 rounded-full ring-4 ring-white" style={{ backgroundColor: color }} />
              ))}
            </div>
          </div>
        ))}
      </section>

      <section id="opportunity-pool">
        <SectionTitle eyebrow="TODAY OPPORTUNITIES" title="今日赛事内容机会池" description="不是普通列表，而是帮运营快速判断今天先做哪场、发到哪里、注意什么风险。" />
        <div className="mt-6 grid gap-5">
          {matches.map((item) => (
            <OpportunityMatchCard key={item.match.id} task={item} theme={theme} />
          ))}
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-[1fr_1fr]">
        <div className="rounded-[32px] border bg-white p-6 shadow-[0_20px_70px_rgba(15,23,42,0.06)]" style={{ borderColor: theme.border }}>
          <SectionTitle eyebrow="OPS DECISION" title="今日运营建议" description="把比赛转成可执行排期，而不是让用户自己在功能里找方向。" />
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <DecisionCard icon={CheckCircle2} title="今日优先做" value={`${priorityMatches.length} 场`} body="先处理高热度、强叙事、平台适配清晰的比赛。" theme={theme} />
            <DecisionCard icon={CircleDot} title="观望比赛" value={`${watchMatches.length} 场`} body="适合作为素材储备，等待赛后舆情和平台热度变化。" theme={theme} />
            <DecisionCard icon={Sparkles} title="今日主推方向" value="人物复盘" body="以梅西职业生涯最后拼图作为主线，承接长尾讨论。" theme={theme} />
            <DecisionCard icon={ShieldAlert} title="今日风险提醒" value="中风险" body="避免黑幕、保送、确认伤退等定性表达。" theme={theme} />
          </div>
        </div>

        <div className="rounded-[32px] border bg-white p-6 shadow-[0_20px_70px_rgba(15,23,42,0.06)]" style={{ borderColor: theme.border }}>
          <SectionTitle eyebrow="CLASSIC CASES" title="历史经典样例" description="样例不是历史记录，而是作品集式演示入口。" />
          <div className="mt-6 space-y-4">
            {matches.slice(0, 2).map((item) => (
              <Link
                key={item.match.id}
                href={`/matches/${item.match.id}`}
                className="group block rounded-[26px] border bg-slate-50 p-5 transition hover:-translate-y-1 hover:bg-white hover:shadow-[0_20px_54px_rgba(15,23,42,0.08)]"
                style={{ borderColor: theme.border }}
              >
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="text-sm font-semibold" style={{ color: theme.primary }}>经典样例</div>
                    <div className="mt-2 text-xl font-semibold text-slate-950">{item.match.teamA} {item.match.score} {item.match.teamB}</div>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{item.highlight}</p>
                  </div>
                  <ArrowRight className="h-5 w-5 text-slate-400 transition group-hover:translate-x-1 group-hover:text-slate-950" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

function HeroPattern({ theme }: { theme: SportTheme }) {
  return (
    <div className="pointer-events-none absolute inset-0 opacity-70">
      <div className="absolute inset-0" style={{ background: `radial-gradient(circle at 78% 18%, ${theme.heroGlow}, transparent 300px)` }} />
      <div className="absolute left-[6%] top-[16%] h-[68%] w-[88%] rounded-[44px] border-2 border-white/55" />
      <div className="absolute left-1/2 top-[16%] h-[68%] w-px bg-white/55" />
      <div className="absolute left-[43%] top-[34%] h-40 w-40 rounded-full border-2 border-white/55" />
      <div className="absolute bottom-0 left-0 right-0 h-28 bg-[linear-gradient(135deg,rgba(255,255,255,.28)_25%,transparent_25%,transparent_50%,rgba(255,255,255,.28)_50%,rgba(255,255,255,.28)_75%,transparent_75%)] bg-[length:30px_30px] opacity-20" />
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

function HeroMetric({ label, value, theme }: { label: string; value: number; theme: SportTheme }) {
  return (
    <div className="rounded-2xl bg-white p-4 text-center shadow-sm">
      <div className="text-3xl font-black" style={{ color: theme.primary }}>{value}</div>
      <div className="mt-1 text-xs font-semibold text-slate-500">{label}</div>
    </div>
  );
}

function OpportunityMatchCard({ task, theme }: { task: MatchTask; theme: SportTheme }) {
  return (
    <article className="grid gap-5 rounded-[30px] border bg-white p-5 shadow-[0_18px_50px_rgba(15,23,42,0.06)] transition hover:-translate-y-1 hover:shadow-[0_28px_80px_rgba(15,23,42,0.1)] lg:grid-cols-[90px_1fr_220px]" style={{ borderColor: theme.border }}>
      <div className="flex items-center gap-3 lg:block">
        <div className="flex h-16 w-16 items-center justify-center rounded-3xl text-3xl font-black text-white" style={{ backgroundColor: priorityColor(task.priority, theme) }}>
          {task.priority}
        </div>
        <div className="text-sm font-semibold text-slate-500 lg:mt-2">机会等级</div>
      </div>
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-3xl font-semibold tracking-tight text-slate-950">
            {task.match.teamA} <span style={{ color: theme.primary }}>{task.match.score}</span> {task.match.teamB}
          </h3>
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">{task.status}</span>
          <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">风险：中</span>
        </div>
        <p className="mt-3 text-sm leading-6 text-slate-600">推荐内容主线：{task.highlight}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {["B站", "微博", ...task.recommendedDirections].slice(0, 5).map((direction) => (
            <span key={direction} className="rounded-full bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200">
              {direction}
            </span>
          ))}
        </div>
      </div>
      <div className="flex flex-col justify-between gap-4">
        <div className="rounded-2xl p-4 text-sm leading-6" style={{ backgroundColor: theme.background, color: theme.mutedText }}>
          推荐平台：B站深度复盘 + 微博话题扩散
        </div>
        <Link
          href={`/matches/${task.match.id}`}
          className="inline-flex h-12 items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold text-white transition hover:-translate-y-0.5"
          style={{ backgroundColor: theme.primary, boxShadow: `0 18px 38px ${theme.heroGlow}` }}
        >
          进入分析
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </article>
  );
}

function DecisionCard({ icon: Icon, title, value, body, theme }: { icon: typeof Flame; title: string; value: string; body: string; theme: SportTheme }) {
  return (
    <div className="rounded-[24px] border bg-slate-50 p-4" style={{ borderColor: theme.border }}>
      <Icon className="h-5 w-5" style={{ color: theme.primary }} />
      <div className="mt-4 text-sm font-semibold text-slate-500">{title}</div>
      <div className="mt-1 text-2xl font-black text-slate-950">{value}</div>
      <p className="mt-2 text-sm leading-6 text-slate-600">{body}</p>
    </div>
  );
}

function priorityColor(priority: MatchTask["priority"], theme: SportTheme) {
  if (priority === "S") return theme.primary;
  if (priority === "A") return theme.accent;
  return theme.secondary;
}
