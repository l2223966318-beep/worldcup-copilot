import { NextResponse } from "next/server";

import { getWorldCupFixtures } from "@/lib/sports/worldCupService";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const forceRefresh = new URL(request.url).searchParams.get("refresh") === "1";
  const payload = await getWorldCupFixtures({ forceRefresh });
  return NextResponse.json(payload);
}
