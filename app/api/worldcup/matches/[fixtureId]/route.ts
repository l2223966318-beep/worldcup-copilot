import { NextResponse } from "next/server";

import { getWorldCupMatch } from "@/lib/sports/worldCupService";

export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: { fixtureId: string } }) {
  const payload = await getWorldCupMatch(params.fixtureId);
  return NextResponse.json(payload);
}
