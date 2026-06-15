import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import ts from "typescript";

const sourcePath = new URL("../lib/sports/staticFixtureStatus.ts", import.meta.url);
const source = readFileSync(sourcePath, "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ES2022,
    target: ts.ScriptTarget.ES2022
  }
}).outputText;

const outDir = join(tmpdir(), "worldcup-copilot-static-status-test");
if (existsSync(outDir)) rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });
const modulePath = join(outDir, "staticFixtureStatus.mjs");
writeFileSync(modulePath, compiled, "utf8");

const { inferStaticFixtureStatus } = await import(`file:///${modulePath.replaceAll("\\", "/")}`);

const now = new Date("2026-06-15T04:00:00Z");

assert.equal(inferStaticFixtureStatus("2026-06-14T20:00:00Z", now), "finished");
assert.equal(inferStaticFixtureStatus("2026-06-14T20:00:00", now), "finished");
assert.equal(inferStaticFixtureStatus("2026-06-15T03:00:00Z", now), "live");
assert.equal(inferStaticFixtureStatus("2026-06-16T03:00:00Z", now), "scheduled");
assert.equal(inferStaticFixtureStatus("", now), "scheduled");

console.log("static fixture status ok");
