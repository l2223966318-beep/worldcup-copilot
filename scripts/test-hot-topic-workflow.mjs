import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import ts from "typescript";

const files = ["lib/ai/quality.ts", "lib/hot/hotTopicWorkflow.ts"];
const outDir = join(tmpdir(), "worldcup-copilot-hot-topic-workflow-test");
if (existsSync(outDir)) rmSync(outDir, { recursive: true, force: true });

for (const file of files) {
  const sourcePath = new URL(`../${file}`, import.meta.url);
  const source = readFileSync(sourcePath, "utf8").replaceAll("@/lib/ai/quality", "../ai/quality.mjs");
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022
    }
  }).outputText;
  const targetPath = join(outDir, file.replace(".ts", ".mjs"));
  mkdirSync(dirname(targetPath), { recursive: true });
  writeFileSync(targetPath, compiled, "utf8");
}

const { auditHotDraft } = await import(`file:///${join(outDir, "lib/hot/hotTopicWorkflow.mjs").replaceAll("\\", "/")}`);

const topic = {
  id: "hot-1",
  title: "C罗是否不该在世界杯首发了",
  summary: "热榜讨论，不代表官方结论。",
  source: "UApiPro",
  platform: "微博",
  valueScore: 76,
  tags: ["世界杯"]
};

const safeDraft = [
  "开头15秒：今天这个热点先别急着站队，我们先确认能确定的事实，再看它为什么会影响世界杯内容传播。",
  "分镜1：热搜词条/来源截图，字幕：先确认它在被讨论。",
  "发布前需人工核验来源，避免把讨论写成定论。"
].join("\n");
const safeAudit = auditHotDraft(safeDraft, topic, "抖音");
assert.equal(safeAudit.level, "pass");
assert.ok(!safeAudit.authenticity.some((item) => item.includes("存在确定性表述")));

const riskyAudit = auditHotDraft("官方证实他已经确认伤退，这事已经实锤。", topic, "微博");
assert.notEqual(riskyAudit.level, "pass");
assert.ok(riskyAudit.authenticity.some((item) => item.includes("存在确定性表述")));
assert.ok(riskyAudit.risk.some((item) => item.includes("高风险")));

console.log("hot topic workflow ok");
