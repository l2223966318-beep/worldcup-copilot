import type { WorldCupMatch } from "@/lib/sports/types";

const LIVE_WINDOW_BEFORE_MS = 15 * 60 * 1000;
const LIVE_WINDOW_AFTER_MS = 150 * 60 * 1000;

export function inferStaticFixtureStatus(
  kickoffTime?: string,
  now = new Date()
): WorldCupMatch["status"] {
  if (!kickoffTime) return "scheduled";

  const kickoff = Date.parse(kickoffTime);
  if (!Number.isFinite(kickoff)) return "scheduled";

  const current = now.getTime();
  if (current < kickoff - LIVE_WINDOW_BEFORE_MS) return "scheduled";
  if (current <= kickoff + LIVE_WINDOW_AFTER_MS) return "live";
  return "finished";
}
