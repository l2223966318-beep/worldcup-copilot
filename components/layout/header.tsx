"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChangeEvent, FormEvent, useState } from "react";
import { Clock3, Search, Settings, Trophy } from "lucide-react";

import { cn } from "@/lib/utils";

const workflow = ["今日比赛池", "单场分析", "平台内容", "风险审稿", "复制导出"];

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");

  function emitGlobalSearch(query: string) {
    if (typeof window === "undefined") return;
    window.dispatchEvent(new CustomEvent("worldcup:global-search", { detail: { query } }));
  }

  function handleSearchChange(event: ChangeEvent<HTMLInputElement>) {
    const query = event.target.value;
    setSearchQuery(query);
    emitGlobalSearch(query);
  }

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = searchQuery.trim();
    if (!query) return;
    emitGlobalSearch(query);
    router.push(`/?q=${encodeURIComponent(query)}#opportunity-pool`);
  }

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl">
      <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-4 px-4 lg:px-8">
        <Link href="/" className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-950 text-white shadow-lg shadow-slate-900/10">
            <Trophy className="h-5 w-5" />
          </div>
          <div>
            <div className="text-base font-semibold tracking-normal text-slate-950">WorldCup Copilot</div>
            <div className="hidden text-xs text-slate-500 sm:block">赛事内容运营工作台</div>
          </div>
        </Link>

        <nav className="hidden flex-1 items-center justify-center gap-2 xl:flex">
          {workflow.map((step, index) => (
            <div key={step} className="flex items-center gap-2">
              <span
                className={cn(
                  "rounded-full px-3 py-1.5 text-xs font-semibold",
                  pathname.startsWith("/matches") && index <= 4 ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"
                )}
              >
                {step}
              </span>
              {index < workflow.length - 1 ? <span className="h-px w-5 bg-slate-200" /> : null}
            </div>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <form
            onSubmit={handleSearch}
            className="hidden w-[320px] items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-500 transition focus-within:border-emerald-300 focus-within:bg-white lg:flex"
          >
            <Search className="h-4 w-4" />
            <input
              value={searchQuery}
              onChange={handleSearchChange}
              className="min-w-0 flex-1 bg-transparent text-slate-700 outline-none placeholder:text-slate-400"
              placeholder="搜索比赛、球队、热点事件"
              aria-label="搜索比赛、球队、热点事件"
            />
          </form>
          <Link
            href="/history"
            className={cn(
              "inline-flex h-10 items-center gap-2 rounded-full px-3 text-sm font-semibold text-slate-600 hover:bg-slate-100",
              pathname.startsWith("/history") ? "bg-slate-100 text-slate-950" : ""
            )}
          >
            <Clock3 className="h-4 w-4" />
            <span className="hidden sm:inline">历史</span>
          </Link>
          <Link
            href="/settings"
            className={cn(
              "inline-flex h-10 items-center gap-2 rounded-full px-3 text-sm font-semibold text-slate-600 hover:bg-slate-100",
              pathname.startsWith("/settings") ? "bg-slate-100 text-slate-950" : ""
            )}
          >
            <Settings className="h-4 w-4" />
            <span className="hidden sm:inline">设置</span>
          </Link>
        </div>
      </div>
    </header>
  );
}
