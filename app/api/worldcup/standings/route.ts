import { NextResponse } from "next/server";

import { getWorldCupStandings } from "@/lib/sports/worldCupService";

export const dynamic = "force-dynamic";

export async function GET() {
  const payload = await getWorldCupStandings();
  return NextResponse.json(payload);
}
