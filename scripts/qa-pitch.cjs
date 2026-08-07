const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const { chromium } = require("playwright");

const baseUrl = process.env.PITCH_BASE_URL || "http://127.0.0.1:3035";
const outputDir = path.resolve(process.cwd(), ".pitch-qa");

async function main() {
  await fs.mkdir(outputDir, { recursive: true });
  const browser = await chromium.launch({
    headless: true,
    executablePath: "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"
  });

  try {
    const desktop = await browser.newPage({ viewport: { width: 1366, height: 768 } });
    await desktop.goto(`${baseUrl}/pitch`, { waitUntil: "networkidle" });
    assert.equal(await desktop.locator("main section").count(), 7);
    assert.equal(await desktop.locator(".pitch-cover-copy").getAttribute("aria-hidden"), "true");
    await desktop.getByRole("button", { name: "跳过片头" }).click();
    assert.equal(await desktop.locator(".pitch-cover-copy").getAttribute("aria-hidden"), "false");
    await desktop.getByRole("button", { name: "重新播放开场视频" }).click();
    assert.equal(await desktop.locator(".pitch-cover-copy").getAttribute("aria-hidden"), "true");
    await desktop.locator(".pitch-cover-video").evaluate((video) => video.dispatchEvent(new Event("ended")));
    await desktop.waitForTimeout(650);
    assert.match(await desktop.locator("h1").innerText(), /把每一场比赛\s+变成高光时刻/);
    assert.equal(await desktop.locator(".pitch-cover-copy").getAttribute("aria-hidden"), "false");
    await desktop.screenshot({ path: path.join(outputDir, "pitch-1366-cover.png") });

    await desktop.keyboard.press("ArrowDown");
    await desktop.waitForTimeout(520);
    assert.equal((await desktop.locator(".pitch-footer span").innerText()).trim(), "02 / 07");
    await desktop.screenshot({ path: path.join(outputDir, "pitch-1366-02.png") });

    for (let index = 2; index < 7; index += 1) {
      await desktop.getByRole("button", { name: `前往第 ${index + 1} 章：${["系统逻辑", "机会判断", "选题生成", "发布审校", "结论"][index - 2]}` }).click();
      await desktop.waitForTimeout(520);
      await desktop.screenshot({ path: path.join(outputDir, `pitch-1366-0${index + 1}.png`) });
    }

    await desktop.getByRole("button", { name: "前往第 5 章：选题生成" }).click();
    await desktop.waitForTimeout(520);
    assert.equal((await desktop.locator(".pitch-footer span").innerText()).trim(), "05 / 07");

    await desktop.keyboard.press("6");
    await desktop.waitForTimeout(520);
    assert.equal((await desktop.locator(".pitch-footer span").innerText()).trim(), "06 / 07");
    assert.equal(await desktop.locator('a[href="/matches/argentina-france-2022-final"]').count() > 0, true);
    assert.equal(await desktop.locator('a[href="/"]').count() > 0, true);

    const wide = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
    await wide.goto(`${baseUrl}/pitch`, { waitUntil: "networkidle" });
    await wide.locator(".pitch-cover-video").evaluate((video) => video.dispatchEvent(new Event("ended")));
    await wide.waitForTimeout(650);
    await wide.screenshot({ path: path.join(outputDir, "pitch-1920-cover.png") });

    const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true });
    await mobile.goto(`${baseUrl}/pitch`, { waitUntil: "networkidle" });
    await mobile.locator(".pitch-cover-video").evaluate((video) => video.dispatchEvent(new Event("ended")));
    await mobile.waitForTimeout(650);
    await mobile.screenshot({ path: path.join(outputDir, "pitch-mobile-cover.png") });

    console.log(JSON.stringify({ sections: 7, keyboard: true, progress: true, links: true, screenshots: 9 }));
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
