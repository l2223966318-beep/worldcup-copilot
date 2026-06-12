export type RiskFinding = {
  sentence: string;
  type: string;
  reason: string;
  rewrite: string;
};

export type RiskReviewResult = {
  level: "低" | "中" | "高";
  score: number;
  findings: RiskFinding[];
  advice: "可发布" | "修改后发布" | "建议暂缓";
};

const rules = [
  {
    type: "未经证实的伤病判断",
    pattern: /(确认伤退|报销|重伤|彻底废了|无法复出|赛季结束)/,
    reason: "伤病状态需要球队、赛事方或权威媒体确认，不能仅凭画面或传闻下结论。",
    rewrite: "疑似出现身体不适，具体情况仍需等待球队或权威媒体确认。"
  },
  {
    type: "引战表达",
    pattern: /(全网都在骂|吊打|碾压|完虐|耻辱|打爆)/,
    reason: "强对立表达容易引发无效争吵，也会削弱内容专业度。",
    rewrite: "赛后讨论热度较高，建议结合比赛过程和公开数据理性分析。"
  },
  {
    type: "夸大争议判罚",
    pattern: /(裁判黑哨|黑哨|保送|裁判毁了|明着偏|假球)/,
    reason: "判罚争议需要规则依据和多方来源，避免直接定性。",
    rewrite: "这一判罚引发讨论，建议结合规则条文、多角度回放和权威解读继续分析。"
  },
  {
    type: "侮辱性表达",
    pattern: /(废物|垃圾|菜到离谱|滚出|彻底废了)/,
    reason: "侮辱性表述会提高平台审核和舆论风险。",
    rewrite: "本场表现未达到预期，可以从具体技术环节分析原因。"
  },
  {
    type: "事实与观点混淆",
    pattern: /(某队靠黑幕夺冠|靠黑幕夺冠|必然|一定|毫无疑问|铁定|实锤)/,
    reason: "绝对化判断容易把观点包装成事实，正式发布前需要补充可靠来源。",
    rewrite: "从目前公开信息看，这一判断仍需更多数据、规则依据和权威来源支持。"
  },
  {
    type: "数据无来源",
    pattern: /(数据表明|数据显示|据统计|xG|控球率|射正率)/,
    reason: "数据类表达建议补充来源，或说明为示例数据、公开统计口径。",
    rewrite: "如使用数据，请注明来源；当前可写为“根据示例数据/公开统计口径”。"
  }
];

export function reviewRisk(text: string): RiskReviewResult {
  const findings = text
    .split(/[。！？；;.!?\n]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .flatMap((sentence) =>
      rules
        .filter((rule) => rule.pattern.test(sentence))
        .map((rule) => ({
          sentence,
          type: rule.type,
          reason: rule.reason,
          rewrite: sentence.replace(rule.pattern, rule.rewrite)
        }))
    );

  const score = Math.min(
    100,
    findings.reduce((sum, item) => sum + (item.type === "夸大争议判罚" || item.type === "事实与观点混淆" ? 24 : 16), 8)
  );
  const level: RiskReviewResult["level"] = score >= 70 ? "高" : score >= 36 ? "中" : "低";
  const advice: RiskReviewResult["advice"] = level === "高" ? "建议暂缓" : level === "中" ? "修改后发布" : "可发布";

  return { level, score, findings, advice };
}
