"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Clock3, Home, Settings, Trophy } from "lucide-react";

import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", label: "首页", icon: Home, activeOn: "/" },
  { href: "/history", label: "历史记录", icon: Clock3, activeOn: "/history" },
  { href: "/settings", label: "项目设置", icon: Settings, activeOn: "/settings" }
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-[248px] shrink-0 border-r border-slate-200 bg-white px-5 py-6 lg:flex lg:flex-col">
      <Link href="/" className="mb-8 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-600/20">
          <Trophy className="h-5 w-5" />
        </div>
        <div>
          <div className="text-lg font-semibold tracking-normal text-slate-950">WorldCup Copilot</div>
          <div className="mt-1 text-xs text-slate-500">赛后内容流水线</div>
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
                "flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-950",
                isActive ? "bg-blue-50 text-blue-700 ring-1 ring-blue-100" : ""
              )}
            >
              <Icon className="h-5 w-5" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
