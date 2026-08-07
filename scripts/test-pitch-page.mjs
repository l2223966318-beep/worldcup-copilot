import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [page, styles] = await Promise.all([
  readFile(new URL("../app/pitch/page.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/pitch/pitch.css", import.meta.url), "utf8")
]);

assert.equal((page.match(/<section className=/g) ?? []).length, 7, "pitch page must contain seven full-screen chapters");
assert.match(page, /ArrowDown.*ArrowRight.*PageDown/s, "pitch page must support forward keyboard navigation");
assert.match(page, /ArrowUp.*ArrowLeft.*PageUp/s, "pitch page must support backward keyboard navigation");
assert.match(page, /document\.documentElement\.requestFullscreen\(\)/, "pitch page must provide a real fullscreen action");
assert.match(page, /href="\/matches\/argentina-france-2022-final"/, "pitch page must link to the classic match case");
assert.match(page, /href="\/"/, "pitch page must link to the live product");
assert.match(page, /src="\/videos\/worldcup-hero\.mp4"/, "pitch cover must reuse the product background video");
assert.match(page, /onEnded=\{finishCoverVideo\}/, "pitch cover must reveal its title after the video ends");
assert.doesNotMatch(page, /<video[\s\S]*?\sloop[\s\S]*?>/, "pitch cover video must not loop automatically");
assert.match(page, /把每一场比赛[\s\S]*变成高光时刻/, "pitch cover must use the product statement as its largest title");
assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/, "pitch page must respect reduced-motion preferences");
assert.match(styles, /height: 100dvh/, "pitch page must use a full-screen stage");
assert.match(styles, /--pitch-green: #0b8f4d/, "pitch page must retain the football-green visual system");

console.log("Pitch presentation page contract passed.");
