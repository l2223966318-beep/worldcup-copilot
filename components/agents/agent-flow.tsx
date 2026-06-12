import { Bot, BookOpen, CalendarClock, FilePenLine, ShieldCheck, Sparkles } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const steps = [
  { title: "赛事输入", desc: "整理赛程、球队、球员和内容目标", icon: CalendarClock },
  { title: "选题判断", desc: "拆解角度、受众、优先级和风险", icon: Sparkles },
  { title: "知识调用", desc: "复用球队资料、规则解释和账号口径", icon: BookOpen },
  { title: "内容生成", desc: "生成标题、脚本、图文大纲和检查清单", icon: FilePenLine },
  { title: "风险审稿", desc: "核验事实、版权、表达和发布边界", icon: ShieldCheck }
];

export function AgentFlow() {
  return (
    <Card className="overflow-hidden rounded-2xl border-white/10 bg-[#071111]/80">
      <CardHeader className="p-5 pb-1">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Bot className="h-5 w-5 text-teal-200" />
            AI 内容协作流程
          </CardTitle>
          <div className="rounded-full border border-teal-300/20 bg-teal-300/10 px-3 py-1.5 text-xs text-teal-100">
            5 个阶段
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-5 pt-2">
        <div className="relative grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <div className="absolute left-12 right-12 top-10 hidden h-[2px] bg-gradient-to-r from-teal-500/20 via-teal-300/90 to-amber-300/20 shadow-[0_0_18px_rgba(45,212,191,.42)] xl:block" />
          {steps.map((step, index) => {
            const Icon = step.icon;
            return (
              <div key={step.title} className="relative z-10 flex items-center gap-3 rounded-xl border border-white/10 bg-black/20 p-3 text-left shadow-[inset_0_1px_0_rgba(255,255,255,.05)] xl:block xl:border-0 xl:bg-transparent xl:p-0 xl:text-center xl:shadow-none">
                {index < steps.length - 1 ? (
                  <div className="absolute right-[-18px] top-[31px] hidden h-5 w-5 rotate-45 border-r-2 border-t-2 border-teal-200/80 shadow-[0_0_12px_rgba(45,212,191,.45)] xl:block" />
                ) : null}
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-teal-300/20 bg-[radial-gradient(circle,rgba(45,212,191,.18),rgba(251,146,60,.08)_54%,rgba(2,6,23,.72)_75%)] shadow-[0_0_32px_rgba(45,212,191,.18)] xl:mx-auto xl:h-16 xl:w-16 xl:rounded-full">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-black/40 xl:h-11 xl:w-11 xl:rounded-full">
                    <Icon className="h-5 w-5 text-teal-200 xl:h-6 xl:w-6" />
                  </div>
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-teal-100 xl:mt-3">{step.title}</div>
                  <div className="mt-1 text-xs text-slate-500">{step.desc}</div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
