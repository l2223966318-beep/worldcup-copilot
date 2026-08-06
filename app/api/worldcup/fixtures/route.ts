import { NextResponse } from "next/server";

import { getWorldCupFixtures } from "@/lib/sports/worldCupService";

export const dynamic = "force-dynamic";

export async function GET() {
  const payload = await getWorldCupFixtures();
  return NextResponse.json(payload);
}
