import { Fragment } from "react";
import type { ReactNode } from "react";

const highlightPattern =
  /(B站复盘|微博热评|小红书图文|抖音口播|公众号长文|B站|微博|小红书|抖音|公众号|复盘|热评|口播|图文|审稿|发布|导出)|(\d+\s*-\s*\d+|\d+(?:\.\d+)?%|\d{1,3}(?:\+\d+)?'|\d+(?:分钟|秒|场|分))/g;

export function HighlightedText({ text }: { text: string }) {
  const nodes: ReactNode[] = [];
  let cursor = 0;

  for (const match of text.matchAll(highlightPattern)) {
    const index = match.index ?? 0;
    if (index > cursor) {
      nodes.push(text.slice(cursor, index));
    }

    const value = match[0];
    // 数字、比分和时间点用轻量胶囊高亮，方便运营快速扫读。
    nodes.push(
      match[2] ? (
        <span key={`${value}-${index}`} className="mx-0.5 rounded bg-emerald-50 px-1.5 py-0.5 text-xs font-medium text-emerald-700">
          {value}
        </span>
      ) : (
        <strong key={`${value}-${index}`} className="font-semibold text-slate-950">
          {value}
        </strong>
      )
    );
    cursor = index + value.length;
  }

  if (cursor < text.length) {
    nodes.push(text.slice(cursor));
  }

  return (
    <>
      {nodes.map((node, index) => (
        <Fragment key={index}>{node}</Fragment>
      ))}
    </>
  );
}

export function ReadableTextBlock({ text, className = "" }: { text: string; className?: string }) {
  const paragraphs = text.split(/\n{2,}/).map((item) => item.trim()).filter(Boolean);

  return (
    <div className={`space-y-3.5 text-sm leading-relaxed text-slate-700 ${className}`}>
      {paragraphs.map((paragraph, index) => (
        <p key={`${paragraph}-${index}`} className="whitespace-pre-line">
          <HighlightedText text={paragraph} />
        </p>
      ))}
    </div>
  );
}
