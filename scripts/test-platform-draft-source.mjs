import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../lib/ai/platform-draft.ts", import.meta.url), "utf8");
const workflowSource = readFileSync(new URL("../lib/ai/deepseek-workflow.ts", import.meta.url), "utf8");

assert.match(source, /topics\?: AiTopicAngle\[\]/);
assert.match(source, /contentType === "topic"/);
assert.match(source, /topics\.length !== 5/);
assert.match(source, /title: "选题角度"/);
assert.match(source, /怎么做：/);
assert.match(source, /说明：/);
assert.match(source, /动漫二创/);
assert.match(source, /游戏二创/);
assert.match(source, /generationTypeGuide\(contentType\)/);
assert.match(source, /styleTypeGuide\(topicMode\)/);
assert.match(source, /videoScript: "按开场钩子/);
assert.match(source, /professional: "专业复盘必须结合关键事件和数据证据/);

const outputShapeStart = workflowSource.indexOf("outputShape:");
const outputShapeEnd = workflowSource.indexOf("match,", outputShapeStart);
assert.ok(outputShapeStart > -1 && outputShapeEnd > outputShapeStart);
assert.doesNotMatch(workflowSource.slice(outputShapeStart, outputShapeEnd), /platformContent:/);
assert.match(workflowSource, /baselineTopicHints\b/);
assert.match(workflowSource, /maxTokens: 1_800/);

console.log("platform draft source contract ok");
