# WorldCup Copilot 参赛创作过程资料

本目录用于提交“能够反映创作过程的资料”。内容来自 WorldCup Copilot 的真实开发过程和当前项目代码，已去除密钥、账号、环境变量和无关部署信息。

## 可提交文件

1. `01-AI创作过程记录.md`
   - 说明作品从需求、原型、AI辅助开发到验证的迭代过程。
   - 适合作为“AI创作中与AI对话的过程”说明材料。

2. `02-核心源代码节选.md`
   - 汇总核心代码节选和功能说明。
   - 适合作为“部分源代码”说明材料。

3. `03-创作过程证明材料.md`
   - 按“需求输入 -> AI辅助 -> 代码实现 -> 验证结果”的格式整理。
   - 可直接复制到报名系统的文字说明区域。

4. `source-code/*.txt`
   - 分模块保存的脱敏代码节选。
   - 可作为“AI辅助网页或应用开发中由AI生成的代码”等附件材料。

## 源码说明

本项目是 Next.js App Router + TypeScript + Tailwind 应用，没有传统单页 `index.html`。页面源码主要位于：

- 首页与赛事内容机会池：`app/page.tsx`
- 单场比赛详情页：`app/matches/[id]/page.tsx`
- 热点评分：`lib/hot/valueScoring.ts`
- 赛事证据与审稿：`lib/services/evidenceService.ts`、`lib/ai/review-draft.ts`
- 多平台生成：`lib/ai/platform-draft.ts`
- Word 导出：`lib/word-export.ts`

## 脱敏说明

资料中不包含：

- API Key、Token、Secret
- `.env.local`、`.env.production`
- 第三方账号信息
- 真实用户 Cookie 或控制台截图

资料中的代码为当前项目核心逻辑的节选和整理版，目的是解释作品如何完成赛事数据采集、热点判断、AI生成和风险审稿闭环。
