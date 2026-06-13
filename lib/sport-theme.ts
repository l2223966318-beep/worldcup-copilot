export type SportType = "football" | "basketball" | "swimming";

export type SportTheme = {
  sportType: SportType;
  name: string;
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  card: string;
  border: string;
  gradient: string;
  pattern: string;
  mutedText: string;
  strongText: string;
  chartA: string;
  chartB: string;
  chartC: string;
  softPanel: string;
  heroGlow: string;
};

export const sportThemes: Record<SportType, SportTheme> = {
  football: {
    sportType: "football",
    name: "足球",
    primary: "#16a34a",
    secondary: "#0f766e",
    accent: "#f2b705",
    background: "#f4fbf4",
    card: "#ffffff",
    border: "#d7ead8",
    gradient: "from-emerald-50 via-white to-lime-50",
    pattern: "球场线条 / 草坪纹理 / 战术箭头",
    mutedText: "#64746b",
    strongText: "#102117",
    chartA: "#16a34a",
    chartB: "#f59e0b",
    chartC: "#0f766e",
    softPanel: "bg-emerald-50",
    heroGlow: "rgba(22, 163, 74, 0.18)"
  },
  basketball: {
    sportType: "basketball",
    name: "篮球",
    primary: "#ea580c",
    secondary: "#991b1b",
    accent: "#f59e0b",
    background: "#fff7ed",
    card: "#ffffff",
    border: "#fed7aa",
    gradient: "from-orange-50 via-white to-red-50",
    pattern: "三分线 / 木地板纹理 / 速度斜切线",
    mutedText: "#7c5b49",
    strongText: "#2b170e",
    chartA: "#ea580c",
    chartB: "#991b1b",
    chartC: "#f59e0b",
    softPanel: "bg-orange-50",
    heroGlow: "rgba(234, 88, 12, 0.18)"
  },
  swimming: {
    sportType: "swimming",
    name: "游泳",
    primary: "#0891b2",
    secondary: "#2563eb",
    accent: "#22d3ee",
    background: "#effbff",
    card: "#ffffff",
    border: "#bae6fd",
    gradient: "from-cyan-50 via-white to-blue-50",
    pattern: "泳道线 / 水波纹 / 流动曲线",
    mutedText: "#526b79",
    strongText: "#092334",
    chartA: "#0891b2",
    chartB: "#2563eb",
    chartC: "#22d3ee",
    softPanel: "bg-cyan-50",
    heroGlow: "rgba(8, 145, 178, 0.18)"
  }
};

export function getSportTheme(sportType: SportType = "football") {
  return sportThemes[sportType];
}

export function getMatchSportType(matchId?: string): SportType {
  if (matchId?.includes("basketball")) return "basketball";
  if (matchId?.includes("swimming")) return "swimming";
  return "football";
}
