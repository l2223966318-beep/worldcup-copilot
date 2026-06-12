"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  BookOpen,
  CalendarClock,
  FileText,
  Home,
  Layers3,
  PenTool,
  Radar,
  ShieldCheck,
  Sparkles,
  Trophy,
  UserRound
} from "lucide-react";

import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", label: "首页", icon: Home, activeOn: "/" },
  { href: "/match-input", label: "赛事输入", icon: CalendarClock, activeOn: "/match-input" },
  { href: "/topic-engine", label: "选题引擎", icon: Sparkles, activeOn: "/topic-engine" },
  { href: "/insights", label: "数据洞察", icon: BarChart3, activeOn: "/insights" },
  { href: "/workshop", label: "内容工坊", icon: PenTool, activeOn: "/workshop" },
  { href: "/knowledge", label: "知识库", icon: BookOpen, activeOn: "/knowledge" },
  { href: "/risk-review", label: "风险审稿", icon: ShieldCheck, activeOn: "/risk-review" },
  { href: "/report", label: "方案报告", icon: FileText, activeOn: "/report" },
  { href: "/data-notes", label: "数据说明", icon: Layers3, activeOn: "/data-notes" }
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-[268px] shrink-0 border-r border-white/10 bg-[#082033]/85 px-5 py-7 backdrop-blur-2xl lg:flex lg:flex-col">
      <Link href="/" className="mb-9 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-emerald-300/35 bg-gradient-to-br from-emerald-300/45 to-amber-300/25 shadow-[0_0_34px_rgba(34,197,94,.24)]">
          <Trophy className="h-5 w-5 text-emerald-50" />
        </div>
        <div>
          <div className="text-lg font-semibold tracking-normal text-white">WorldCup Copilot</div>
          <div className="mt-1 text-xs text-slate-300">AI 世界杯内容助手</div>
        </div>
      </Link>

      <nav className="space-y-2">
        {navItems.map((item) => {
          const isActive = item.activeOn === "/" ? pathname === "/" : pathname.startsWith(item.activeOn);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "group flex items-center gap-3 rounded-2xl px-4 py-3 text-sm text-slate-300 transition-all duration-300 hover:-translate-y-0.5 hover:bg-white/[0.09] hover:text-white",
                isActive
                  ? "bg-gradient-to-r from-emerald-300/25 to-amber-300/10 text-white shadow-[0_0_28px_rgba(34,197,94,.15),inset_0_1px_0_rgba(255,255,255,.12)]"
                  : ""
              )}
            >
              <Icon className="h-5 w-5" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto space-y-5">
        <div className="rounded-2xl border border-emerald-300/22 bg-emerald-300/[0.07] p-4 shadow-neon">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-sm font-semibold text-white">赛事运营指挥台</div>
            <Radar className="h-4 w-4 text-amber-200" />
          </div>
          <p className="text-xs leading-5 text-slate-300">围绕一场比赛完成选题、图表、多平台内容、审稿和报告交付。</p>
        </div>

        <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.07] p-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-white to-emerald-100 text-slate-950">
            <UserRound className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-white">内容运营主管</div>
            <div className="text-xs text-slate-300">赛事实时内容团队</div>
          </div>
        </div>
      </div>
    </aside>
  );
}
