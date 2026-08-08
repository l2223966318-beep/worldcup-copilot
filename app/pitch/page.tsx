"use client";

import Image from "next/image";
import Link from "next/link";
import type { CSSProperties, WheelEvent as ReactWheelEvent } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowLeft, ArrowRight, Expand, Pause, Play, RotateCcw, SkipForward } from "lucide-react";

import "./pitch.css";

const chapters = ["开场", "项目背景", "进入工具"] as const;

const backgroundSignals = [
  ["01", "热点窗口短", "赛后信息在数小时内集中爆发，人工整理会错过时效。"],
  ["02", "内容需求分化", "复盘、热点点评和二创需要不同的数据与表达方式。"],
  ["03", "生产链路分散", "数据、热点、选题和审核分布在不同工具与工作环节。"]
] as const;

export default function PitchPage() {
  const [active, setActive] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const [coverRevealed, setCoverRevealed] = useState(false);
  const [coverPaused, setCoverPaused] = useState(false);
  const [coverProgress, setCoverProgress] = useState(0);
  const coverVideoRef = useRef<HTMLVideoElement>(null);
  const lastWheelAt = useRef(0);

  const goToSlide = useCallback((index: number) => {
    setActive(Math.max(0, Math.min(chapters.length - 1, index)));
  }, []);

  useEffect(() => {
    const video = coverVideoRef.current;
    if (!video) return;
    if (active === 0 && !coverRevealed) {
      void video.play().catch(() => setCoverPaused(true));
      return;
    }
    video.pause();
  }, [active, coverRevealed]);

  function finishCoverVideo() {
    setCoverProgress(1);
    setCoverPaused(true);
    setCoverRevealed(true);
  }

  function skipCoverVideo() {
    const video = coverVideoRef.current;
    if (video) {
      video.pause();
      if (Number.isFinite(video.duration) && video.duration > 0) {
        video.currentTime = Math.max(0, video.duration - 0.05);
      }
    }
    finishCoverVideo();
  }

  async function toggleCoverVideo() {
    const video = coverVideoRef.current;
    if (!video) return;
    if (coverRevealed) {
      video.currentTime = 0;
      setCoverProgress(0);
      setCoverRevealed(false);
      setCoverPaused(false);
      await video.play().catch(() => setCoverPaused(true));
      return;
    }
    if (video.paused) {
      await video.play().catch(() => setCoverPaused(true));
    } else {
      video.pause();
    }
  }

  const requestFullscreen = useCallback(async () => {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen();
      return;
    }
    await document.exitFullscreen();
  }, []);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(event: KeyboardEvent) {
      if (["ArrowDown", "ArrowRight", "PageDown", " "].includes(event.key)) {
        event.preventDefault();
        setActive((current) => Math.min(chapters.length - 1, current + 1));
        return;
      }
      if (["ArrowUp", "ArrowLeft", "PageUp"].includes(event.key)) {
        event.preventDefault();
        setActive((current) => Math.max(0, current - 1));
        return;
      }
      if (event.key === "Home") {
        event.preventDefault();
        setActive(0);
        return;
      }
      if (event.key === "End") {
        event.preventDefault();
        setActive(chapters.length - 1);
        return;
      }
      if (/^[1-3]$/.test(event.key)) {
        setActive(Number(event.key) - 1);
      }
    }

    function onFullscreenChange() {
      setFullscreen(Boolean(document.fullscreenElement));
    }

    window.addEventListener("keydown", onKeyDown);
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("fullscreenchange", onFullscreenChange);
    };
  }, []);

  function handleWheel(event: ReactWheelEvent<HTMLDivElement>) {
    if (!window.matchMedia("(min-width: 821px)").matches || Math.abs(event.deltaY) < 20) return;
    const now = Date.now();
    if (now - lastWheelAt.current < 720) return;
    lastWheelAt.current = now;
    setActive((current) => Math.max(0, Math.min(chapters.length - 1, current + (event.deltaY > 0 ? 1 : -1))));
  }

  return (
    <div className="pitch-shell" onWheel={handleWheel}>
      <header className="pitch-toolbar">
        <div className={`pitch-brand ${active > 0 || !coverRevealed ? "is-hidden" : ""}`}>
          <span className="pitch-brand-mark">W</span>
          <span>WorldCup Copilot</span>
        </div>
        <button type="button" className="pitch-icon-button" onClick={requestFullscreen} title={fullscreen ? "退出全屏" : "进入全屏"}>
          <Expand aria-hidden="true" />
        </button>
      </header>

      <main className="pitch-track" style={{ "--pitch-slide": active } as CSSProperties} aria-live="polite">
        <section className="pitch-slide pitch-cover" data-revealed={coverRevealed} aria-label="开场">
          <video
            ref={coverVideoRef}
            className="pitch-cover-video"
            autoPlay
            muted
            playsInline
            preload="auto"
            onEnded={finishCoverVideo}
            onPause={() => setCoverPaused(true)}
            onPlay={() => setCoverPaused(false)}
            onTimeUpdate={(event) => {
              const video = event.currentTarget;
              setCoverProgress(video.duration > 0 ? Math.min(1, video.currentTime / video.duration) : 0);
            }}
          >
            <source src="/videos/worldcup-hero.mp4" type="video/mp4" />
          </video>
          <div className="pitch-cover-shade" />
          <div className={`pitch-cover-copy ${coverRevealed ? "is-visible" : ""}`} aria-hidden={!coverRevealed}>
            <div className="pitch-cover-product">
              <span className="pitch-cover-product-index">01 /</span>
              <strong>WorldCup Copilot</strong>
            </div>
            <h1>
              <span className="pitch-cover-title-line"><span>把每一场比赛</span></span>
              <span className="pitch-cover-title-line"><span>变成<strong>高光</strong>时刻<i aria-hidden="true" /></span></span>
            </h1>
            <p className="pitch-cover-tagline">让赛事信号成为内容资产</p>
            <div className="pitch-rule" />
            <p className="pitch-cover-summary">赛事证据 × 内容选题 × 发布审校</p>
            <p className="pitch-origin">B站内容运营相关实习观察 / 个人实践项目</p>
            <button type="button" onClick={() => goToSlide(1)} className="pitch-primary-button">
              了解项目背景 <ArrowDown aria-hidden="true" />
            </button>
          </div>
          <div className={`pitch-cover-media ${coverRevealed ? "is-revealed" : ""}`} aria-label="开场视频控制">
            <button type="button" className="pitch-cover-media-button" onClick={toggleCoverVideo} aria-label={coverRevealed ? "重新播放开场视频" : coverPaused ? "继续播放开场视频" : "暂停开场视频"}>
              {coverRevealed ? <RotateCcw aria-hidden="true" /> : coverPaused ? <Play aria-hidden="true" /> : <Pause aria-hidden="true" />}
            </button>
            <div className="pitch-cover-progress" aria-hidden="true"><span style={{ width: `${coverProgress * 100}%` }} /></div>
            {!coverRevealed ? <button type="button" className="pitch-cover-skip" onClick={skipCoverVideo}>跳过片头 <SkipForward aria-hidden="true" /></button> : null}
          </div>
          <div className="pitch-cover-index">AIGC 应用大赛 · 四川赛区决赛</div>
        </section>

        <section className="pitch-slide pitch-context" aria-label="项目背景">
          <div className="pitch-context-media" aria-hidden="true">
            <div className="pitch-context-shot pitch-context-shot-main"><Image src="/pitch/background-hot-daily.png" alt="" fill sizes="56vw" /></div>
            <div className="pitch-context-shot pitch-context-shot-trend"><Image src="/pitch/background-volume-trend.png" alt="" fill sizes="44vw" /></div>
            <div className="pitch-context-shot pitch-context-shot-cases"><Image src="/pitch/background-bilibili-cases.png" alt="" fill sizes="22vw" /></div>
            <div className="pitch-context-shot pitch-context-shot-mix"><Image src="/pitch/background-content-mix.png" alt="" fill sizes="22vw" /></div>
          </div>
          <div className="pitch-context-shade" />
          <SlideHeader number="02" label="PROJECT ORIGIN" />
          <div className="pitch-context-copy pitch-reveal">
            <p className="pitch-eyebrow">B站内容运营实习观察 / 个人实践项目</p>
            <h2>内容机会很多，<br />判断时间很少。</h2>
            <p className="pitch-context-lead">世界杯期间，热点日报、赛后复盘与内容趋势观察暴露出三个连续问题。</p>
            <div className="pitch-context-signals">
              {backgroundSignals.map(([number, title, body]) => (
                <div key={number}>
                  <span>{number}</span>
                  <strong>{title}</strong>
                  <p>{body}</p>
                </div>
              ))}
            </div>
            <div className="pitch-context-conclusion">
              <span>项目起点</span>
              <strong>把分散的赛事证据，转成可执行、可审校的内容决策。</strong>
            </div>
            <button type="button" onClick={() => goToSlide(2)} className="pitch-primary-button">
              进入实机演示 <ArrowRight aria-hidden="true" />
            </button>
          </div>
        </section>

        <section className="pitch-slide pitch-handoff" aria-label="进入工具">
          <SlideHeader number="03" label="LIVE PRODUCT" />
          <div className="pitch-handoff-grid" aria-hidden="true"><span /><span /><span /><span /></div>
          <div className="pitch-handoff-copy pitch-reveal">
            <p className="pitch-eyebrow">BACKGROUND → LIVE PRODUCT</p>
            <h2>背景介绍到这里，<br /><span>接下来直接操作。</span></h2>
            <p>从一场比赛开始，现场走完热点筛选、选题生成、平台内容、风险审校与 Word 导出。</p>
            <Link href="/" className="pitch-enter-tool">
              <span>进入 WorldCup Copilot</span>
              <ArrowRight aria-hidden="true" />
            </Link>
          </div>
          <div className="pitch-demo-route">比赛机会 → 赛事信号 → 选题生成 → 内容审校 → 报告导出</div>
        </section>
      </main>

      <nav className="pitch-progress" aria-label="答辩章节">
        {chapters.map((chapter, index) => (
          <button type="button" key={chapter} className={active === index ? "is-active" : ""} onClick={() => goToSlide(index)} aria-label={`前往第 ${index + 1} 章：${chapter}`}>
            <span>{String(index + 1).padStart(2, "0")}</span><i />
          </button>
        ))}
      </nav>

      <div className="pitch-footer">
        <button type="button" onClick={() => goToSlide(active - 1)} disabled={active === 0} aria-label="上一章"><ArrowLeft aria-hidden="true" /></button>
        <span>{String(active + 1).padStart(2, "0")} / 03</span>
        <button type="button" onClick={() => goToSlide(active + 1)} disabled={active === chapters.length - 1} aria-label="下一章"><ArrowRight aria-hidden="true" /></button>
      </div>
    </div>
  );
}

function SlideHeader({ number, label }: { number: string; label: string }) {
  return <div className="pitch-slide-header"><strong>{number}.</strong><span>/ {label}</span></div>;
}
