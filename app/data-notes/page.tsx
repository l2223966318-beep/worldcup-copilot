import { Info } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const notes = [
  "当前版本使用示例数据、用户输入数据和手动导入数据。",
  "不后台抓取抖音、小红书、B站、微博等平台登录内容。",
  "不保存账号、密码、Cookie 或个人平台会话。",
  "AI 生成内容仅作为创作辅助，不替代人工编辑和事实核查。",
  "正式版本可接入授权体育数据 API、公开数据集或机构自有数据源。"
];

export default function DataNotesPage() {
  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <section className="rounded-2xl border border-white/10 bg-gradient-to-br from-[#0d3553]/90 via-[#0b223b]/80 to-[#173516]/75 p-6 shadow-soft-xl backdrop-blur-2xl lg:p-8">
        <Badge variant="warning" className="mb-5">About</Badge>
        <h1 className="text-4xl font-semibold tracking-normal lg:text-6xl">数据说明</h1>
        <p className="mt-4 max-w-3xl text-lg leading-8 text-slate-100">
          说明当前版本的数据来源、隐私边界和 AI 生成内容的使用限制。
        </p>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        {notes.map((note) => (
          <Card key={note}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Info className="h-5 w-5 text-emerald-200" />
                说明
              </CardTitle>
            </CardHeader>
            <CardContent className="text-base leading-7 text-slate-200">{note}</CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
