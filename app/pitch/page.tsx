"use client";

import Image from "next/image";
import Link from "next/link";
import type { CSSProperties, WheelEvent as ReactWheelEvent } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowLeft, ArrowRight, Expand, Home, MonitorPlay, Pause, Play, RotateCcw, SkipForward } from "lucide-react";

import "./pitch.css";

const chapters = [
  "开场",
  "项目起点",
  "系统逻辑",
  "机会判断",
  "选题生成",
  "发布审校",
  "结论"
] as const;

const workflow = [
  ["01", "赛事数据", "赛程 / 比分 / 统计 / 事件"],
  ["02", "价值判断", "热度 / 相关性 / 叙事 / 风险"],
  ["03", "选题生成", "资讯 / 复盘 / 二创 / 人物"],
  ["04", "平台适配", "B站 / 微博 / 小红书 / 公众号"],
  ["05", "证据审校", "事实定位 / 改写 / Word交付"]
] as const;

const opportunityScores = [
  ["72", "热度"],
  ["68", "情绪"],
  ["85", "叙事"],
  ["70", "长尾"]
] as const;

const platformOutputs = [
  ["B站", "标题 / 视频结构 / 开头口播", "bilibili"],
  ["微博", "短评 / 话题 / 讨论引导", "weibo"],
  ["小红书", "封面 / 图文卡片 / 正文", "redbook"],
  ["公众号", "导语 / 长文结构 / 结尾", "wechat"]
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
      if (event.key === "ArrowDown" || event.key === "ArrowRight" || event.key === "PageDown" || event.key === " ") {
        event.preventDefault();
        setActive((current) => Math.min(chapters.length - 1, current + 1));
        return;
      }
      if (event.key === "ArrowUp" || event.key === "ArrowLeft" || event.key === "PageUp") {
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
      if (/^[1-7]$/.test(event.key)) {
        setActive(Number(event.key) - 1);
        return;
      }
      if (event.key === "Escape" && !document.fullscreenElement) {
        window.location.assign("/");
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
    <div className={`pitch-shell ${[1, 3, 5].includes(active) ? "pitch-on-light" : ""}`} onWheel={handleWheel}>
      <header className="pitch-toolbar">
        <Link href="/" className={`pitch-brand ${active > 0 || !coverRevealed ? "is-hidden" : ""}`} aria-label="退出答辩，返回主系统">
          <span className="pitch-brand-mark">W</span>
          <span>WorldCup Copilot</span>
        </Link>
        <div className="pitch-toolbar-actions">
          <Link href="/" className="pitch-icon-button" title="返回主系统">
            <Home aria-hidden="true" />
          </Link>
          <Link href="/matches/argentina-france-2022-final" className="pitch-toolbar-link">
            <MonitorPlay aria-hidden="true" />
            <span>经典案例</span>
          </Link>
          <button type="button" className="pitch-icon-button" onClick={requestFullscreen} title={fullscreen ? "退出全屏" : "进入全屏"}>
            <Expand aria-hidden="true" />
          </button>
        </div>
      </header>

      <main
        className="pitch-track"
        style={{ "--pitch-slide": active } as CSSProperties}
        aria-live="polite"
      >
        <section className="pitch-slide pitch-cover" data-revealed={coverRevealed} aria-label="开场">
          <video
            ref={coverVideoRef}
            className="pitch-cover-video"
            autoPlay
            muted
            playsInline
            preload="auto"
            poster="/pitch/cover-football.png"
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
            <div className="pitch-cover-product"><span aria-hidden="true" />WorldCup Copilot</div>
            <h1><span>把每一场比赛</span><span>变成高光时刻</span></h1>
            <p className="pitch-cover-tagline">让赛事信号成为内容资产</p>
            <div className="pitch-rule" />
            <p className="pitch-cover-summary">赛事证据 × 内容选题 × 发布审校</p>
            <p className="pitch-origin">B站内容运营相关实习观察 / 个人实践项目</p>
            <div className="pitch-cover-actions">
              <button type="button" onClick={() => goToSlide(1)} className="pitch-primary-button">
                开始答辩 <ArrowDown aria-hidden="true" />
              </button>
              <Link href="/" className="pitch-text-link">进入产品实机 <ArrowRight aria-hidden="true" /></Link>
            </div>
          </div>
          <div className={`pitch-cover-media ${coverRevealed ? "is-revealed" : ""}`} aria-label="开场视频控制">
            <button type="button" className="pitch-cover-media-button" onClick={toggleCoverVideo} aria-label={coverRevealed ? "重新播放开场视频" : coverPaused ? "继续播放开场视频" : "暂停开场视频"}>
              {coverRevealed ? <RotateCcw aria-hidden="true" /> : coverPaused ? <Play aria-hidden="true" /> : <Pause aria-hidden="true" />}
            </button>
            <div className="pitch-cover-progress" aria-hidden="true"><span style={{ width: `${coverProgress * 100}%` }} /></div>
            {!coverRevealed ? (
              <button type="button" className="pitch-cover-skip" onClick={skipCoverVideo}>跳过片头 <SkipForward aria-hidden="true" /></button>
            ) : null}
          </div>
          <div className="pitch-cover-index">AIGC 应用大赛 · 四川赛区决赛</div>
        </section>

        <section className="pitch-slide pitch-light" aria-label="项目起点">
          <SlideHeader number="02" label="PROJECT ORIGIN" />
          <div className="pitch-origin-layout">
            <div className="pitch-origin-copy pitch-reveal">
              <h2>项目不是功能堆叠，<br />是实习问题的产品化回应。</h2>
              <p className="pitch-disclaimer">个人实践背景 / 非B站官方项目</p>
              <div className="pitch-problem-list">
                <Problem number="01" title="信息分散" body="赛程、事件和平台热点来自不同入口。" />
                <Problem number="02" title="选题依赖经验" body="热度高，不等于值得投入制作。" />
                <Problem number="03" title="审核成本后置" body="生成越快，越要区分事实与观点。" />
              </div>
              <p className="pitch-origin-conclusion">运营人员缺的不是又一个写稿工具，<br />而是判断下一条内容应该做什么。</p>
            </div>
            <div className="pitch-product-frame pitch-reveal pitch-delay-1">
              <Image src="/pitch/match-center.png" alt="赛事机会池与热点雷达产品界面" fill sizes="60vw" className="pitch-product-image" />
              <div className="pitch-frame-caption">FROM REAL WORK → REUSABLE CONTENT OPERATIONS</div>
            </div>
          </div>
        </section>

        <section className="pitch-slide pitch-system" aria-label="系统逻辑">
          <Image src="/pitch/stadium.png" alt="夜场足球场" fill sizes="100vw" className="pitch-system-image" />
          <div className="pitch-system-shade" />
          <SlideHeader number="03" label="SYSTEM LOGIC" dark />
          <div className="pitch-system-intro pitch-reveal">
            <h2>EVIDENCE<br />TO CONTENT.</h2>
            <div>
              <h3>先组织证据，再调用 AI</h3>
              <p>AI 只在明确的比赛、事件、热点和平台约束中生成。</p>
            </div>
          </div>
          <div className="pitch-workflow pitch-reveal pitch-delay-1">
            {workflow.map(([number, title, body], index) => (
              <div className="pitch-workflow-step" key={number}>
                <span>{number}</span>
                <h3>{title}</h3>
                <p>{body}</p>
                {index < workflow.length - 1 ? <ArrowRight className="pitch-workflow-arrow" aria-hidden="true" /> : null}
              </div>
            ))}
          </div>
          <div className="pitch-core-claim"><strong>核心创新</strong><span>让每个内容结论都能回到比赛证据，而不是只判断文案“像不像”。</span></div>
        </section>

        <section className="pitch-slide pitch-light" aria-label="机会判断">
          <SlideHeader number="04" label="LIVE PRODUCT" />
          <div className="pitch-slide-title pitch-reveal">
            <h2>一场比赛，先被拆成可解释的内容机会。</h2>
            <p>评分不是结论，评分依据才是。</p>
          </div>
          <div className="pitch-opportunity-layout">
            <div className="pitch-detail-frame pitch-reveal">
              <Image src="/pitch/match-detail.png" alt="单场比赛详情与内容机会评分" fill sizes="65vw" className="pitch-product-image" />
              <span className="pitch-screenshot-mask" aria-hidden="true" />
            </div>
            <div className="pitch-score-panel pitch-reveal pitch-delay-1">
              <div className="pitch-grade"><strong>B</strong><span>级内容机会</span></div>
              <div className="pitch-score-grid">
                {opportunityScores.map(([score, label]) => (
                  <div key={label}><strong>{score}</strong><span>{label}</span></div>
                ))}
              </div>
              <p>比赛证据 / 热点证据 / 内容判断</p>
            </div>
          </div>
        </section>

        <section className="pitch-slide pitch-dark" aria-label="AI选题生成">
          <SlideHeader number="05" label="AI TOPIC ENGINE" dark />
          <div className="pitch-topic-layout">
            <div className="pitch-topic-main pitch-reveal">
              <h2>同一热点，<br />不只是换一种语气。</h2>
              <p>先生成作品角度，再决定平台交付物。</p>
              <div className="pitch-topic-frame">
                <Image src="/pitch/topic-engine.png" alt="AI选题引擎产品界面" fill sizes="62vw" className="pitch-product-image" />
              </div>
            </div>
            <div className="pitch-platform-panel pitch-reveal pitch-delay-1">
              <h3>平台不是标签，<br />而是不同交付物。</h3>
              <div className="pitch-platform-list">
                {platformOutputs.map(([platform, output, theme]) => (
                  <div key={platform}><strong data-platform={theme}>{platform}</strong><span>{output}</span></div>
                ))}
              </div>
            </div>
          </div>
          <div className="pitch-bilibili-strip"><strong>B站主推链路</strong><span>热点 → 专业复盘 / 人物故事 / 动漫二创 / 游戏二创 / 数据解读</span></div>
        </section>

        <section className="pitch-slide pitch-light" aria-label="发布审校与交付">
          <SlideHeader number="06" label="PROOF BEFORE PUBLISH" />
          <div className="pitch-slide-title pitch-reveal">
            <h2>事实回到证据，风险定位到句子。</h2>
            <p>审稿不是泛泛提醒，而是给出可回填的改写。</p>
          </div>
          <div className="pitch-review-layout">
            <ProductComparison image="/pitch/review.png" alt="风险审稿产品界面" number="01" caption="具体风险句 → 风险类型 → 安全改写" />
            <ProductComparison image="/pitch/report.png" alt="Word方案报告产品界面" number="02" caption="可发布版 → 编辑参考 → 证据与来源" />
          </div>
          <div className="pitch-review-states">
            <div><strong>通过</strong><span>证据直接支持</span></div>
            <div><strong>缺少依据</strong><span>指出哪一句缺什么</span></div>
            <div><strong>超出证据</strong><span>给出可回填改写</span></div>
          </div>
        </section>

        <section className="pitch-slide pitch-closing" aria-label="结论">
          <Image src="/pitch/trophy.png" alt="夜场草坪上的金属足球奖杯" fill sizes="100vw" className="pitch-closing-image" />
          <div className="pitch-closing-shade" />
          <SlideHeader number="07" label="CONCLUSION" dark />
          <div className="pitch-closing-copy pitch-reveal">
            <h2>MAKE EVERY<br />SIGNAL COUNT.</h2>
            <h3>不是让 AI 替运营编故事，<br />而是让每一条内容有据可依。</h3>
            <p>先取证 × 再生成 × 后审校</p>
            <div className="pitch-closing-actions">
              <Link href="/" className="pitch-primary-button">进入产品实机 <ArrowRight aria-hidden="true" /></Link>
              <Link href="/matches/argentina-france-2022-final" className="pitch-outline-button">打开经典案例</Link>
            </div>
          </div>
          <div className="pitch-closing-brand"><strong>WorldCup Copilot</strong><span>赛事内容运营工作台</span></div>
        </section>
      </main>

      <aside className="pitch-progress" aria-label="答辩章节导航">
        {chapters.map((chapter, index) => (
          <button
            type="button"
            key={chapter}
            className={index === active ? "is-active" : ""}
            onClick={() => goToSlide(index)}
            aria-label={`前往第 ${index + 1} 章：${chapter}`}
            aria-current={index === active ? "step" : undefined}
          >
            <span>{String(index + 1).padStart(2, "0")}</span>
            <i />
          </button>
        ))}
      </aside>

      <footer className="pitch-footer">
        <button type="button" onClick={() => goToSlide(active - 1)} disabled={active === 0} aria-label="上一页"><ArrowLeft /></button>
        <span>{String(active + 1).padStart(2, "0")} / {String(chapters.length).padStart(2, "0")}</span>
        <button type="button" onClick={() => goToSlide(active + 1)} disabled={active === chapters.length - 1} aria-label="下一页"><ArrowRight /></button>
      </footer>
    </div>
  );
}

function SlideHeader({ number, label, dark = false }: { number: string; label: string; dark?: boolean }) {
  return (
    <div className={`pitch-slide-header ${dark ? "is-dark" : ""}`}>
      <strong>{number}.</strong>
      <span>/ {label}</span>
    </div>
  );
}

function Problem({ number, title, body }: { number: string; title: string; body: string }) {
  return (
    <div className="pitch-problem">
      <span>{number}</span>
      <div><h3>{title}</h3><p>{body}</p></div>
    </div>
  );
}

function ProductComparison({ image, alt, number, caption }: { image: string; alt: string; number: string; caption: string }) {
  return (
    <figure className="pitch-comparison pitch-reveal">
      <div><Image src={image} alt={alt} fill sizes="48vw" className="pitch-product-image" /></div>
      <figcaption><strong>{number}</strong><span>{caption}</span></figcaption>
    </figure>
  );
}
