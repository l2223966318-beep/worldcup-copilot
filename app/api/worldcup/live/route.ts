import { NextResponse } from "next/server";

import { getLiveWorldCupFixtures } from "@/lib/sports/worldCupService";

export const dynamic = "force-dynamic";

export async function GET() {
  const payload = await getLiveWorldCupFixtures();
  return NextResponse.json(payload);
}
