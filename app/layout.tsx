import type { Metadata } from "next";
import type { ReactNode } from "react";

import { Header } from "@/components/layout/header";
import { Sidebar } from "@/components/layout/sidebar";
import "./globals.css";

export const metadata: Metadata = {
  title: "WorldCup Copilot | AI 世界杯内容生产与传播助手",
  description: "面向体育记者、自媒体创作者、平台运营和赛事运营人员的 AI 体育赛事内容生产工作台。"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN" className="dark">
      <body>
        <div className="min-h-screen">
          <div className="flex min-h-screen">
            <Sidebar />
            <div className="flex min-w-0 flex-1 flex-col">
              <Header />
              <main className="flex-1 px-4 py-5 lg:px-6">{children}</main>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
