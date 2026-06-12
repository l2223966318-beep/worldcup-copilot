"use client";

import Link from "next/link";
import { ArrowRight, Copy, Download } from "lucide-react";
import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MatchSelect } from "@/components/worldcup/match-select";
import { exampleMatches } from "@/data/matches";
import { generatePlatformContent } from "@/lib/ai/content";
import { generateTopics } from "@/lib/ai/topics";
import { copyToClipboard, downloadTextFile } from "@/lib/download";
import { useLocalStorageState } from "@/lib/local-store";

export function GeneratorPanel() {
  const [matchId, setMatchId] = useLocalStorageState("worldcup.selectedMatchId", exampleMatches[0].id);
  const match = exampleMatches.find((item) => item.id === matchId) ?? exampleMatches[0];
  const topics = useMemo(() => generateTopics(match), [match]);
  const [storedTopicId, setStoredTopicId] = useLocalStorageState("worldcup.selectedTopicId", topics[0].id);
  const [topicId, setTopicId] = useState(storedTopicId || topics[0].id);
  const topic = topics.find((item) => item.id === topicId) ?? topics[0];
  const content = useMemo(() => generatePlatformContent(match, topic), [match, topic]);
  const markdown = createMarkdown(match.name, topic.title, content);

  function updateTopic(value: string) {
    setTopicId(value);
    setStoredTopicId(value);
  }

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <section className="rounded-2xl border border-white/10 bg-gradient-to-br from-[#0d3553]/90 via-[#0b223b]/80 to-[#173516]/75 p-6 shadow-soft-xl backdrop-blur-2xl lg:p-8">
        <Badge variant="warning" className="mb-5">Content Studio</Badge>
        <h1 className="text-4xl font-semibold tracking-normal lg:text-6xl">内容工坊</h1>
        <p className="mt-4 max-w-3xl text-lg leading-8 text-slate-100">
          选择一个选题后，生成 B站、小红书、微博、短视频和公众号 / 专栏的差异化内容方案。
        </p>
      </section>

      <Card>
        <CardContent className="grid gap-4 p-5 lg:grid-cols-[360px_1fr_auto]">
          <MatchSelect value={matchId} onChange={setMatchId} />
          <label className="block">
            <span className="text-sm font-medium text-slate-200">选题</span>
            <select value={topic.id} onChange={(event) => updateTopic(event.target.value)} className="mt-2 h-12 w-full rounded-xl border border-white/10 bg-slate-950/40 px-3 text-sm text-white outline-none">
              {topics.map((item) => (
                <option key={item.id} value={item.id} className="bg-slate-950 text-white">{item.title}</option>
              ))}
            </select>
          </label>
          <div className="flex flex-wrap items-end gap-2">
            <Button className="gap-2" onClick={() => copyToClipboard(markdown)}>
              <Copy className="h-4 w-4" />
              复制方案
            </Button>
            <Button variant="outline" className="gap-2" onClick={() => downloadTextFile("worldcup-content-plan.md", markdown, "text/markdown;charset=utf-8")}>
              <Download className="h-4 w-4" />
              下载
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <PlatformCard title="B站" icon="B">
          <List title="视频标题 5 个" items={content.bilibili.titles} />
          <Block title="视频开头 30 秒脚本" body={content.bilibili.openingScript} />
          <List title="视频结构大纲" items={content.bilibili.outline} />
          <Block title="弹幕 / 评论区互动话术" body={content.bilibili.commentPrompt} />
          <Block title="推荐 UP 主类型" body={content.bilibili.creatorType} />
          <Block title="封面文案建议" body={content.bilibili.coverCopy} />
        </PlatformCard>

        <PlatformCard title="小红书" icon="RED">
          <List title="图文标题 5 个" items={content.xiaohongshu.titles} />
          <div>
            <div className="mb-2 text-xs text-slate-300">5 页卡片结构</div>
            <div className="space-y-2">
              {content.xiaohongshu.cards.map((card, index) => (
                <div key={card.title} className="rounded-xl border border-white/10 bg-white/[0.055] p-3">
                  <div className="font-semibold text-white">第 {index + 1} 页：{card.title}</div>
                  <div className="mt-1 text-sm text-slate-200">{card.body}</div>
                </div>
              ))}
            </div>
          </div>
          <Block title="封面标题" body={content.xiaohongshu.coverTitle} />
          <List title="标签建议" items={content.xiaohongshu.tags} />
          <List title="避免用词" items={content.xiaohongshu.avoidWords} />
        </PlatformCard>

        <PlatformCard title="微博" icon="WB">
          <Block title="100 字快评" body={content.weibo.shortComment} />
          <Block title="300 字长微博" body={content.weibo.longPost} />
          <Block title="争议讨论提问" body={content.weibo.debateQuestion} />
          <List title="话题标签" items={content.weibo.hashtags} />
          <Block title="风险提示" body={content.weibo.riskTip} />
        </PlatformCard>

        <PlatformCard title="短视频" icon="SV">
          <Block title="15 秒版本" body={content.shortVideo.fifteenSec} />
          <Block title="30 秒版本" body={content.shortVideo.thirtySec} />
          <Block title="60 秒版本" body={content.shortVideo.sixtySec} />
          <List title="分镜脚本" items={content.shortVideo.storyboard} />
          <Block title="口播稿" body={content.shortVideo.voiceover} />
          <List title="画面建议" items={content.shortVideo.visuals} />
        </PlatformCard>

        <PlatformCard title="公众号 / 专栏" icon="DOC">
          <Block title="文章标题" body={content.article.title} />
          <Block title="导语" body={content.article.intro} />
          <List title="文章结构" items={content.article.structure} />
          <List title="小标题" items={content.article.subheads} />
          <Block title="结尾观点" body={content.article.ending} />
          <List title="数据图表插入建议" items={content.article.chartSuggestions} />
        </PlatformCard>

        <Card>
          <CardHeader>
            <CardTitle>下一步</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-slate-200">
            <p>多平台内容已生成。建议进入风险审稿页，用微博长文或短视频口播做发布前检查。</p>
            <Button asChild className="gap-2">
              <Link href="/risk-review">
                进入风险审稿
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function PlatformCard({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span className="flex h-9 min-w-9 items-center justify-center rounded-xl border border-emerald-300/25 bg-emerald-300/10 px-2 text-xs text-emerald-50">{icon}</span>
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm leading-7 text-slate-200">{children}</CardContent>
    </Card>
  );
}

function List({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <div className="mb-2 text-xs text-slate-300">{title}</div>
      <div className="space-y-2">
        {items.map((item) => (
          <div key={item} className="rounded-xl border border-white/10 bg-white/[0.055] p-3 text-slate-100">{item}</div>
        ))}
      </div>
    </div>
  );
}

function Block({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-slate-950/30 p-4">
      <div className="mb-1 text-xs text-slate-300">{title}</div>
      <div className="whitespace-pre-wrap text-slate-100">{body}</div>
    </div>
  );
}

function createMarkdown(matchName: string, topicTitle: string, content: ReturnType<typeof generatePlatformContent>) {
  return [
    `# WorldCup Copilot 多平台内容方案`,
    "",
    `- 比赛：${matchName}`,
    `- 主选题：${topicTitle}`,
    "",
    "## B站",
    ...content.bilibili.titles.map((item) => `- ${item}`),
    "",
    "## 小红书",
    ...content.xiaohongshu.cards.map((item, index) => `${index + 1}. ${item.title}：${item.body}`),
    "",
    "## 微博",
    content.weibo.shortComment,
    "",
    "## 短视频",
    content.shortVideo.thirtySec,
    "",
    "## 公众号 / 专栏",
    content.article.title
  ].join("\n");
}
