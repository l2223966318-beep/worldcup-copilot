import { NextResponse } from "next/server";

import { reviewDraftWithAi } from "@/lib/ai/review-draft";
import type { MatchContext } from "@/types/workflow";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      draft?: string;
      matchContext?: MatchContext;
      apiKey?: string;
    };

    if (!body.draft?.trim() || !body.matchContext) {
      return NextResponse.json({ sourceStatus: "error", message: "draft and matchContext are required." }, { status: 400 });
    }

    return NextResponse.json(await reviewDraftWithAi({
      draft: body.draft,
      matchContext: body.matchContext,
      apiKey: body.apiKey
    }));
  } catch (error) {
    return NextResponse.json(
      { sourceStatus: "error", message: error instanceof Error ? error.message : "Unknown review AI error." },
      { status: 500 }
    );
  }
}
