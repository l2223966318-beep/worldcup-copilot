import { NextResponse } from "next/server";

import { enhanceMatchWorkflowWithDeepSeek } from "@/lib/ai/deepseek-workflow";
import type { TopicIdea } from "@/lib/ai/topics";
import type { MatchData } from "@/data/matches";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      match?: MatchData;
      baselineTopics?: TopicIdea[];
    };

    if (!body.match || !Array.isArray(body.baselineTopics)) {
      return NextResponse.json(
        {
          sourceStatus: "error",
          conclusions: [],
          topics: [],
          message: "match and baselineTopics are required."
        },
        { status: 400 }
      );
    }

    const payload = await enhanceMatchWorkflowWithDeepSeek({
      match: body.match,
      baselineTopics: body.baselineTopics
    });

    return NextResponse.json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown AI workflow error.";
    return NextResponse.json(
      {
        sourceStatus: "error",
        conclusions: [],
        topics: [],
        message
      },
      { status: 500 }
    );
  }
}
