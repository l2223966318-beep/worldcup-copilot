import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-semibold shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] transition-colors",
  {
    variants: {
      variant: {
        default: "border-emerald-300/30 bg-emerald-300/10 text-emerald-100",
        secondary: "border-white/10 bg-white/10 text-slate-100",
        success: "border-emerald-400/25 bg-emerald-400/10 text-emerald-200",
        warning: "border-amber-400/25 bg-amber-400/10 text-amber-200",
        destructive: "border-rose-400/25 bg-rose-400/10 text-rose-200"
      }
    },
    defaultVariants: {
      variant: "default"
    }
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
