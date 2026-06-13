import { NextResponse } from "next/server";

import { getTodayWorldCupFixtures } from "@/lib/sports/worldCupService";

export const dynamic = "force-dynamic";

export async function GET() {
  const payload = await getTodayWorldCupFixtures();
  return NextResponse.json(payload);
}
