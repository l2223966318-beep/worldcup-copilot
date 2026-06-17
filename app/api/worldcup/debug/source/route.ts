import { NextResponse } from "next/server";

import { getSportradarSourceDebug } from "@/lib/sports/sourceDebug";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await getSportradarSourceDebug());
}
