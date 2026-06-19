import { NextResponse } from "next/server";

import { generatePlatformDraftWithAi } from "@/lib/ai/platform-draft";
import type { ContentTypeKey, TopicModeKey } from "@/lib/services/contentService";
import type { AnalysisResult, MatchContext, PlatformKey, WorkflowTopic } from "@/types/workflow";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      platform?: PlatformKey;
      contentType?: ContentTypeKey;
      topicMode?: TopicModeKey;
      matchContext?: MatchContext;
      topic?: WorkflowTopic;
      analysis?: AnalysisResult;
      apiKey?: string;
    };

    if (!body.platform || !body.contentType || !body.topicMode || !body.matchContext || !body.topic || !body.analysis) {
      return NextResponse.json({ sourceStatus: "error", message: "Missing platform draft inputs." }, { status: 400 });
    }

    const payload = await generatePlatformDraftWithAi({
      platform: body.platform,
      contentType: body.contentType,
      topicMode: body.topicMode,
      matchContext: body.matchContext,
      topic: body.topic,
      analysis: body.analysis,
      apiKey: body.apiKey
    });

    return NextResponse.json(payload);
  } catch (error) {
    return NextResponse.json(
      { sourceStatus: "error", message: error instanceof Error ? error.message : "Unknown platform draft AI error." },
      { status: 500 }
    );
  }
}
