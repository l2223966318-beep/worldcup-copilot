import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../app/matches/[id]/page.tsx", import.meta.url), "utf8");

assert.match(source, />\s*生成类型\s*</);
assert.match(source, />\s*风格类型\s*</);
assert.match(source, /draftLoading \? "生成中\.\.\." : "生成"/);
assert.doesNotMatch(source, />\s*选题方向\s*</);
assert.match(source, /onContentTypeChange=\{\(type\) => \{[\s\S]*?setManualDraft\(null\)[\s\S]*?setDraftForReview\(""\)/);
assert.match(source, /onTopicModeChange=\{\(mode\) => \{[\s\S]*?setManualDraft\(null\)[\s\S]*?setDraftForReview\(""\)/);
assert.match(source, /const \[reviewedDraft, setReviewedDraft\] = useState\(""\)/);
assert.match(source, /const reviewFlow = reviewedDraft === reviewSourceText && reviewedDraft/);
assert.match(source, /setReviewedDraft\(draftSnapshot\)/);
assert.match(source, /onChange=\{\(event\) => \{[\s\S]*?setReviewedDraft\(""\)/);
assert.match(source, /const AI_WORKFLOW_MAX_ATTEMPTS = 2/);
assert.match(source, /for \(let attempt = 1; attempt <= AI_WORKFLOW_MAX_ATTEMPTS; attempt \+= 1\)/);
assert.match(source, /payload\.sourceStatus === "live"/);
assert.match(source, /setTimeout\(resolve, AI_WORKFLOW_RETRY_DELAY_MS\)/);
assert.match(source, /<ReadableTextBlock text=\{generatedText\} emphasizeTitles/);

const readableTextSource = readFileSync(new URL("../components/ui/readable-text.tsx", import.meta.url), "utf8");
assert.match(readableTextSource, /emphasizeTitles\?: boolean/);
assert.match(readableTextSource, /isGeneratedTitleLine/);
assert.match(readableTextSource, /font-bold text-slate-950/);

console.log("match platform controls ok");
