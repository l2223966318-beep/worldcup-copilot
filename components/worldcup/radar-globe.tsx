import { Badge } from "@/components/ui/badge";

export function RadarGlobe() {
  return (
    <div className="relative hidden h-[318px] overflow-hidden rounded-2xl border border-white/10 bg-black/15 lg:block">
      <div className="absolute inset-0 bg-[linear-gradient(rgba(45,212,191,.045)_1px,transparent_1px),linear-gradient(90deg,rgba(251,146,60,.035)_1px,transparent_1px)] bg-[size:30px_30px] opacity-80" />

      <div className="absolute left-1/2 top-[47%] h-[188px] w-[188px] -translate-x-1/2 -translate-y-1/2">
        <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_33%_27%,rgba(240,253,250,.98),rgba(45,212,191,.62)_20%,rgba(14,165,120,.46)_38%,rgba(251,146,60,.42)_58%,rgba(244,63,94,.26)_72%,rgba(2,6,23,.88)_86%)] shadow-[0_0_50px_rgba(45,212,191,.48),0_0_110px_rgba(251,146,60,.24)]" />
        <div className="absolute inset-0 rounded-full bg-[linear-gradient(115deg,rgba(255,255,255,.32),transparent_28%,rgba(255,255,255,.08)_45%,transparent_62%)]" />
        <div className="absolute inset-0 rounded-full border border-teal-100/40" />

        {[0, 1, 2, 3, 4].map((item) => (
          <div
            key={`lat-${item}`}
            className="absolute left-1/2 top-1/2 rounded-full border border-teal-100/20"
            style={{
              height: `${26 + item * 16}%`,
              width: "92%",
              transform: `translate(-50%, -50%) rotateX(68deg) translateY(${(item - 2) * 17}px)`
            }}
          />
        ))}

        {[-62, -32, 0, 32, 62].map((deg) => (
          <div
            key={`lon-${deg}`}
            className="absolute left-1/2 top-1/2 h-[104%] w-[34%] rounded-full border border-amber-100/20"
            style={{ transform: `translate(-50%, -50%) rotate(${deg}deg)` }}
          />
        ))}

        <span className="absolute left-[23%] top-[64%] h-3 w-3 rounded-full bg-teal-200 shadow-[0_0_24px_rgba(94,234,212,.95)] holo-pulse" />
        <span className="absolute right-[18%] top-[28%] h-2.5 w-2.5 rounded-full bg-amber-300 shadow-[0_0_24px_rgba(252,211,77,.9)] holo-pulse" />
        <span className="absolute right-[30%] bottom-[18%] h-2.5 w-2.5 rounded-full bg-rose-300 shadow-[0_0_24px_rgba(253,164,175,.9)] holo-pulse" />
      </div>

      <div className="holo-orbit absolute left-1/2 top-[47%] h-[210px] w-[330px] -translate-x-1/2 -translate-y-1/2 rounded-[100%] border border-teal-300/35" />
      <div className="holo-orbit-reverse absolute left-1/2 top-[47%] h-[252px] w-[136px] -translate-x-1/2 -translate-y-1/2 rotate-[63deg] rounded-[100%] border border-amber-300/30" />
      <div className="holo-orbit absolute left-1/2 top-[47%] h-[242px] w-[132px] -translate-x-1/2 -translate-y-1/2 rotate-[-56deg] rounded-[100%] border border-rose-300/20" />
      <div className="absolute bottom-[42px] left-1/2 h-[54px] w-[280px] -translate-x-1/2 rounded-[100%] border border-amber-300/20 bg-[radial-gradient(ellipse,rgba(251,146,60,.18),transparent_68%)] shadow-[0_0_54px_rgba(251,146,60,.2)]" />
      <div className="absolute bottom-[67px] left-1/2 h-2 w-56 -translate-x-1/2 rounded-full bg-gradient-to-r from-transparent via-teal-300/60 to-transparent blur-sm" />

      <SignalLabel className="left-[2%] top-[28%]" text="赛程雷达" side="right" />
      <SignalLabel className="right-[10%] top-[14%]" text="选题预测" side="left" />
      <SignalLabel className="right-[2%] top-[45%]" text="内容生成" side="left" />
      <SignalLabel className="bottom-[23%] left-[42%]" text="风险审稿" side="top" />
    </div>
  );
}

function SignalLabel({
  className,
  text,
  side
}: {
  className: string;
  text: string;
  side: "left" | "right" | "top";
}) {
  return (
    <div className={`absolute ${className}`}>
      <div
        className={
          side === "left"
            ? "absolute right-full top-1/2 h-px w-14 bg-gradient-to-l from-teal-300/60 to-transparent"
            : side === "right"
              ? "absolute left-full top-1/2 h-px w-14 bg-gradient-to-r from-teal-300/60 to-transparent"
              : "absolute bottom-full left-1/2 h-10 w-px bg-gradient-to-t from-teal-300/60 to-transparent"
        }
      />
      <Badge variant="secondary" className="whitespace-nowrap border-teal-300/20 bg-[#071111]/80 px-3 py-1.5 text-teal-100 shadow-[0_0_22px_rgba(45,212,191,.18)] backdrop-blur-xl">
        {text}
      </Badge>
    </div>
  );
}
