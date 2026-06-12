"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Search, Trophy, UserRound } from "lucide-react";

import { cn } from "@/lib/utils";

const mobileNav = [
  { href: "/", label: "首页" },
  { href: "/match-input", label: "赛事" },
  { href: "/topic-engine", label: "选题" },
  { href: "/insights", label: "洞察" },
  { href: "/workshop", label: "工坊" },
  { href: "/report", label: "报告" }
];

export function Header() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-30 border-b border-white/10 bg-[#082033]/80 backdrop-blur-2xl lg:hidden">
      <div className="flex min-h-20 items-center justify-between gap-4 px-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-emerald-300/30 bg-emerald-300/10">
            <Trophy className="h-5 w-5 text-emerald-100" />
          </div>
          <div>
            <div className="font-semibold">WorldCup Copilot</div>
            <div className="text-xs text-slate-300">赛事热点拆解与分发工作台</div>
          </div>
        </div>

        <div className="flex flex-1 items-center justify-end gap-4">
          <div className="hidden w-full max-w-[360px] items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/30 px-4 py-3 text-sm text-slate-300 md:flex">
            <Search className="h-4 w-4" />
            <span>搜索赛事、球队、球员、选题</span>
          </div>
          <button className="relative hidden h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-slate-950/30 text-slate-200 transition-all duration-300 hover:-translate-y-0.5 hover:border-emerald-300/30 hover:text-white sm:flex">
            <Bell className="h-5 w-5" />
            <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-amber-300 shadow-[0_0_12px_rgba(252,211,77,.8)]" />
          </button>
          <div className="hidden h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-gradient-to-br from-slate-200 to-emerald-100 text-slate-950 sm:flex">
            <UserRound className="h-5 w-5" />
          </div>
        </div>
      </div>

      <nav className="flex gap-2 overflow-x-auto border-t border-white/10 px-4 py-2">
        {mobileNav.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "rounded-xl px-3 py-1.5 text-sm text-slate-300",
              pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href))
                ? "bg-emerald-300/15 text-emerald-50"
                : "hover:bg-white/10 hover:text-white"
            )}
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
