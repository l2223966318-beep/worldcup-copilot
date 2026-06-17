import { NextResponse } from "next/server";

import { getSportradarSourceDebug } from "@/lib/sports/sourceDebug";
import { getLiveWorldCupFixtures } from "@/lib/sports/worldCupService";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  if (searchParams.get("debug") === "source") {
    return NextResponse.json(await getSportradarSourceDebug());
  }

  const payload = await getLiveWorldCupFixtures();
  return NextResponse.json(payload);
}
