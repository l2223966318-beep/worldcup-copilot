"use client";

import { exampleMatches } from "@/data/matches";

export function MatchSelect({
  value,
  onChange
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-200">比赛</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 h-12 w-full rounded-xl border border-white/10 bg-slate-950/40 px-3 text-sm text-white outline-none ring-emerald-300/30 transition-all duration-300 focus:border-emerald-300/35 focus:ring-2"
      >
        {exampleMatches.map((match) => (
          <option key={match.id} value={match.id} className="bg-slate-950 text-white">
            {match.name}
          </option>
        ))}
      </select>
    </label>
  );
}
