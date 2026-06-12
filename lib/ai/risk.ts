import { cleanText } from "@/lib/ai/quality";

export type RiskLevel = "低" | "中" | "高";

export type RiskFinding = {
  type: string;
  level: RiskLevel;
  sentence: string;
  reason: string;
  rewrite: string;
  publishAdvice: string;
};

export type RiskReviewResult = {
  level: RiskLevel;
  score: number;
  findings: RiskFinding[];
  advice: "可发布" | "修改后发布" | "建议暂缓";
};

const riskRules = [
  {
    type: "未经证实的伤病判断",
    level: "高" as const,
    pattern: /(确认伤退|报销|重伤|彻底废了|无法复出|赛季结束)/,
    reason: "伤病信息需要球队、赛事方或权威媒体确认，不能用猜测替代事实。",
    rewrite: "该球员疑似出现身体不适，具体情况仍需等待球队或权威媒体确认。",
    publishAdvice: "建议暂缓定性发布；如必须发布，只保留可核实画面和官方信息。"
  },
  {
    type: "引战表达",
    level: "中" as const,
    pattern: /(全网都在骂|吊打|碾压|完虐|耻辱|打爆)/,
    reason: "强对立表达容易激化讨论，也会降低内容专业度。",
    rewrite: "这次判罚或表现引发较多讨论，建议结合比赛过程和公开信息理性分析。",
    publishAdvice: "适合修改后发布；弱化群体情绪判断，增加事实依据。"
  },
  {
    type: "夸大争议判罚",
    level: "高" as const,
    pattern: /(裁判黑哨|黑哨|保送|被保送|裁判毁了|明着偏|假球)/,
    reason: "判罚争议需要规则依据和多方来源，不能直接给出操纵性定性。",
    rewrite: "这一判罚引发讨论，建议结合规则条文、多角度回放和权威解读继续分析。",
    publishAdvice: "建议暂缓直接定性；先补充规则来源和可靠解读。"
  },
  {
    type: "侮辱性表达",
    level: "中" as const,
    pattern: /(废物|垃圾|菜到离谱|滚出|彻底废了)/,
    reason: "侮辱性表达会提高平台审核风险，也不利于建立专业账号形象。",
    rewrite: "本场表现未达到预期，可以从具体技术环节和比赛环境分析原因。",
    publishAdvice: "修改后发布；用技术分析替代人身攻击。"
  },
  {
    type: "事实与观点混淆",
    level: "高" as const,
    pattern: /(某队靠黑幕夺冠|靠黑幕夺冠|黑幕夺冠|必然|一定|毫无疑问|铁定|实锤)/,
    reason: "绝对化判断容易把观点包装成事实，正式发布前需要可靠来源支撑。",
    rewrite: "从目前公开信息看，相关争议仍需要更多数据、规则依据和权威来源支持。",
    publishAdvice: "建议暂缓定性发布；可改成讨论题或资料汇总。"
  },
  {
    type: "数据无来源",
    level: "低" as const,
    pattern: /(数据表明|数据显示|据统计|xG|控球率|射正率)/,
    reason: "数据表达应说明来源和统计口径，否则容易被质疑准确性。",
    rewrite: "如使用数据，请注明来源；当前演示可标注为示例数据或公开统计口径。",
    publishAdvice: "可修改后发布；补充数据来源和口径说明。"
  }
];

const highRiskWords = /(黑哨|黑幕夺冠|靠黑幕|确认伤退|彻底废了|被保送|保送|全网都在骂)/;

export function reviewRisk(text: string): RiskReviewResult {
  const sentences = splitSentences(text);
  const findings = sentences.flatMap((sentence) =>
    riskRules
      .filter((rule) => rule.pattern.test(sentence))
      .map((rule) => ({
        type: rule.type,
        level: rule.level,
        sentence: cleanText(sentence),
        reason: rule.reason,
        rewrite: sanitizeRewrite(rule.rewrite),
        publishAdvice: rule.publishAdvice
      }))
  );

  const score = Math.min(
    100,
    findings.reduce((sum, finding) => sum + (finding.level === "高" ? 26 : finding.level === "中" ? 18 : 10), 8)
  );
  const level: RiskLevel = score >= 70 ? "高" : score >= 36 ? "中" : "低";
  const advice = level === "高" ? "建议暂缓" : level === "中" ? "修改后发布" : "可发布";

  return { level, score, findings, advice };
}

function splitSentences(text: string) {
  return text
    .split(/[。！？；;.!?\n]/)
    .map((item) => cleanText(item))
    .filter(Boolean);
}

function sanitizeRewrite(rewrite: string) {
  const cleaned = cleanText(rewrite);
  if (!highRiskWords.test(cleaned)) return cleaned;
  return "建议改为事实描述，并补充来源、规则依据和人工确认结论。";
}
