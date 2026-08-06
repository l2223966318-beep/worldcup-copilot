import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import ts from "typescript";

const outDir = join(tmpdir(), "worldcup-copilot-sportradar-today-test");
if (existsSync(outDir)) rmSync(outDir, { recursive: true, force: true });
mkdirSync(join(outDir, "lib/sports"), { recursive: true });
mkdirSync(join(outDir, "lib/time"), { recursive: true });

const timeSource = readFileSync(new URL("../lib/time/beijingTime.ts", import.meta.url), "utf8");
writeFileSync(
  join(outDir, "lib/time/beijingTime.mjs"),
  ts.transpileModule(timeSource, {
    compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 }
  }).outputText,
  "utf8"
);

writeFileSync(
  join(outDir, "lib/sports/normalizers.mjs"),
  "export function createPayload(sourceStatus, data, message) { return { sourceStatus, data, lastUpdated: new Date().toISOString(), ...(message ? { message } : {}) }; }\n",
  "utf8"
);

const clientSource = readFileSync(new URL("../lib/sports/sportradarClient.ts", import.meta.url), "utf8")
  .replaceAll("@/lib/time/beijingTime", "../time/beijingTime.mjs")
  .replaceAll("@/lib/sports/normalizers", "./normalizers.mjs");
writeFileSync(
  join(outDir, "lib/sports/sportradarClient.mjs"),
  ts.transpileModule(clientSource, {
    compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 }
  }).outputText,
  "utf8"
);

process.env.SPORTRADAR_API_KEY = "test-key";
process.env.SPORTRADAR_ACCESS_LEVEL = "trial";
process.env.SPORTRADAR_LANGUAGE_CODE = "en";
process.env.SPORTRADAR_WORLD_CUP_COMPETITION_ID = "sr:competition:16";
process.env.SPORTRADAR_WORLD_CUP_SEASON_ID = "sr:season:101177";

const requests = [];
globalThis.fetch = async (input) => {
  requests.push(String(input));
  return new Response(JSON.stringify({
    generated_at: "2026-06-29T00:00:00Z",
    summaries: [
      {
        sport_event: {
          id: "sr:sport_event:1",
          start_time: "2026-06-28T19:00:00Z",
          sport_event_context: {
            competition: { id: "sr:competition:16", name: "FIFA World Cup" },
            season: { id: "sr:season:101177", name: "World Cup 2026", year: "2026" }
          },
          competitors: [
            { name: "South Africa", qualifier: "home" },
            { name: "Canada", qualifier: "away" }
          ]
        },
        sport_event_status: {
          status: "closed",
          home_score: 0,
          away_score: 1
        }
      }
    ]
  }), { status: 200, headers: { "content-type": "application/json" } });
};

const { getSportradarWorldCupToday } = await import(
  `file:///${join(outDir, "lib/sports/sportradarClient.mjs").replaceAll("\\", "/")}`
);
const payload = await getSportradarWorldCupToday("2026-06-29");

assert.equal(requests.length, 1, "today loader should avoid bursting three Sportradar requests");
assert.match(requests[0], /seasons\/sr%3Aseason%3A101177\/summaries\.json/);
assert.equal(payload.sourceStatus, "live");
assert.equal(payload.data.length, 1);
assert.equal(payload.data[0].source.provider, "sportradar");

console.log("sportradar today summaries ok");
