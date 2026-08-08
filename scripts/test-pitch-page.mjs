import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [page, styles] = await Promise.all([
  readFile(new URL("../app/pitch/page.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/pitch/pitch.css", import.meta.url), "utf8")
]);

assert.equal((page.match(/<section className=/g) ?? []).length, 3, "pitch page must contain three focused chapters");
assert.match(page, /ArrowDown.*ArrowRight.*PageDown/s, "pitch page must support forward keyboard navigation");
assert.match(page, /ArrowUp.*ArrowLeft.*PageUp/s, "pitch page must support backward keyboard navigation");
assert.match(page, /document\.documentElement\.requestFullscreen\(\)/, "pitch page must provide a real fullscreen action");
assert.match(page, /href="\/"[\s\S]*进入 WorldCup Copilot/, "final chapter must link directly to the live product");
assert.match(page, /src="\/videos\/worldcup-hero\.mp4"/, "pitch cover must reuse the product background video");
assert.match(page, /onEnded=\{finishCoverVideo\}/, "pitch cover must reveal its title after the video ends");
assert.doesNotMatch(page, /<video[\s\S]*?\sloop[\s\S]*?>/, "pitch cover video must not loop automatically");
assert.match(page, /把每一场比赛[\s\S]*变成[\s\S]*高光[\s\S]*时刻/, "pitch cover must use the product statement as its largest title");

for (const image of ["background-hot-daily", "background-bilibili-cases", "background-volume-trend", "background-content-mix"]) {
  assert.match(page, new RegExp(`/pitch/${image}\\.png`), `project background must include ${image}`);
}

assert.match(page, /className="pitch-material-viewer"/, "project background must present sources in a visible material viewer");
assert.match(page, /放大查看/, "background materials must support focused viewing");
assert.match(page, /内容机会很多[\s\S]*判断时间很少/, "project background must use the approved opportunity-window statement");
assert.match(page, /className="pitch-context-flow"/, "project background must present the three problems as a clear flow");
assert.doesNotMatch(page, /pitch-context-media|pitch-context-shade/, "project materials must not be dimmed decorative backgrounds");
assert.doesNotMatch(page, /match-center|match-detail|topic-engine|signals\.png|review\.png|report\.png|stadium\.png|trophy\.png/, "retired presentation imagery must not remain referenced");
assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/, "pitch page must respect reduced-motion preferences");
assert.match(styles, /height: 300dvh/, "pitch page track must match the three-chapter structure");
assert.match(styles, /--pitch-green: #0b8f4d/, "pitch page must retain the football-green visual system");

console.log("Pitch presentation page contract passed.");
