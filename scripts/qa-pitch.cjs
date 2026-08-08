const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const { chromium } = require("playwright");

const baseUrl = process.env.PITCH_BASE_URL || "http://127.0.0.1:3035";
const outputDir = path.resolve(process.cwd(), ".pitch-qa");

async function revealCover(page) {
  assert.equal(await page.locator(".pitch-cover-copy").getAttribute("aria-hidden"), "true");
  await page.getByRole("button", { name: "跳过片头" }).click();
  assert.equal(await page.locator(".pitch-cover-copy").getAttribute("aria-hidden"), "false");
  await page.getByRole("button", { name: "重新播放开场视频" }).click();
  assert.equal(await page.locator(".pitch-cover-copy").getAttribute("aria-hidden"), "true");
  await page.locator(".pitch-cover-video").evaluate((video) => video.dispatchEvent(new Event("ended")));
  await page.waitForTimeout(1250);
  assert.match(await page.locator("h1").innerText(), /把每一场比赛\s+变成高光时刻/);
}

async function main() {
  await fs.mkdir(outputDir, { recursive: true });
  const browser = await chromium.launch({
    headless: true,
    executablePath: "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"
  });

  try {
    const desktop = await browser.newPage({ viewport: { width: 1366, height: 768 } });
    await desktop.goto(`${baseUrl}/pitch`, { waitUntil: "networkidle" });
    assert.equal(await desktop.locator("main section").count(), 3);
    await revealCover(desktop);
    await desktop.screenshot({ path: path.join(outputDir, "pitch-1366-cover.png") });

    await desktop.keyboard.press("ArrowDown");
    await desktop.waitForTimeout(520);
    assert.equal((await desktop.locator(".pitch-footer span").innerText()).trim(), "02 / 03");
    assert.equal(await desktop.getByRole("tab").count(), 4);
    await desktop.getByRole("tab", { name: /B站内容案例/ }).click();
    assert.match(await desktop.locator(".pitch-material-stage img").getAttribute("src"), /background-bilibili-cases/);
    await desktop.waitForFunction(() => {
      const image = document.querySelector(".pitch-material-stage img");
      return image instanceof HTMLImageElement && image.complete && image.currentSrc.includes("background-bilibili-cases");
    });
    await desktop.getByRole("button", { name: "放大查看B站内容案例" }).click();
    assert.equal(await desktop.getByRole("dialog", { name: "B站内容案例大图" }).count(), 1);
    await desktop.getByRole("button", { name: "关闭素材大图" }).click();
    await desktop.screenshot({ path: path.join(outputDir, "pitch-1366-background.png") });

    await desktop.getByRole("button", { name: "进入实机演示" }).click();
    await desktop.waitForTimeout(520);
    assert.equal((await desktop.locator(".pitch-footer span").innerText()).trim(), "03 / 03");
    assert.equal(await desktop.getByRole("link", { name: /进入 WorldCup Copilot/ }).getAttribute("href"), "/");
    await desktop.screenshot({ path: path.join(outputDir, "pitch-1366-handoff.png") });

    await desktop.keyboard.press("2");
    await desktop.waitForTimeout(520);
    assert.equal((await desktop.locator(".pitch-footer span").innerText()).trim(), "02 / 03");
    await desktop.getByRole("button", { name: "前往第 3 章：进入工具" }).click();
    await desktop.waitForTimeout(520);
    assert.equal((await desktop.locator(".pitch-footer span").innerText()).trim(), "03 / 03");

    const wide = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
    await wide.goto(`${baseUrl}/pitch`, { waitUntil: "networkidle" });
    await wide.locator(".pitch-cover-video").evaluate((video) => video.dispatchEvent(new Event("ended")));
    await wide.waitForTimeout(1250);
    await wide.screenshot({ path: path.join(outputDir, "pitch-1920-cover.png") });

    const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true });
    await mobile.goto(`${baseUrl}/pitch`, { waitUntil: "networkidle" });
    await mobile.locator(".pitch-cover-video").evaluate((video) => video.dispatchEvent(new Event("ended")));
    await mobile.waitForTimeout(1250);
    await mobile.screenshot({ path: path.join(outputDir, "pitch-mobile-cover.png") });

    console.log(JSON.stringify({ sections: 3, keyboard: true, handoff: true, links: true, screenshots: 5 }));
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
