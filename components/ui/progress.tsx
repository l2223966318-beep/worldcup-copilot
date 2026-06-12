import { cn } from "@/lib/utils";

type ProgressProps = {
  value: number;
  className?: string;
};

export function Progress({ value, className }: ProgressProps) {
  return (
    <div className={cn("h-2.5 overflow-hidden rounded-full bg-white/10 shadow-[inset_0_1px_2px_rgba(0,0,0,0.3)]", className)}>
      <div
        className="h-full rounded-full bg-gradient-to-r from-teal-300 via-emerald-300 to-amber-300 shadow-[0_0_18px_rgba(45,212,191,0.35)]"
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}
