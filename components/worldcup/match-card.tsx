import { CalendarClock, Trophy } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ExampleBadge } from "@/components/worldcup/example-badge";
import type { MatchData } from "@/data/matches";

export function MatchCard({ match }: { match: MatchData }) {
  return (
    <Card className="aura-border">
      <CardHeader>
        <div className="flex flex-wrap gap-2">
          <ExampleBadge />
          <Badge variant="secondary">{match.stage}</Badge>
          {match.penaltyScore ? <Badge>点球 {match.penaltyScore}</Badge> : null}
        </div>
        <CardTitle className="flex items-center gap-2 pt-3">
          <Trophy className="h-5 w-5 text-amber-200" />
          {match.name}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-base leading-7 text-slate-200">
        <div className="flex flex-wrap items-center gap-3 text-slate-200">
          <span>{match.teamA}</span>
          <span className="rounded-xl border border-amber-200/25 bg-amber-200/[0.12] px-4 py-1 text-2xl font-semibold text-white">{match.score}</span>
          <span>{match.teamB}</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-300">
          <CalendarClock className="h-4 w-4" />
          {match.time}
        </div>
        <p>{match.summary}</p>
      </CardContent>
    </Card>
  );
}
