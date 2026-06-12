import type { ReactNode } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type ReportCardProps = {
  title: string;
  children: ReactNode;
};

export function ReportCard({ title, children }: ReportCardProps) {
  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-teal-300 shadow-[0_0_16px_rgba(45,212,191,0.7)]" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="text-sm leading-7 text-slate-300">{children}</CardContent>
    </Card>
  );
}
