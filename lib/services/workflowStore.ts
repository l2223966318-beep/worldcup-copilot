import type { WorkflowState } from "@/types/workflow";

export const WORKFLOW_STORAGE_KEY = "worldcup.workflow.state";
export const REVIEW_DRAFT_STORAGE_KEY = "worldcup.workflow.draftForReview";

export function readWorkflowState(): WorkflowState {
  if (typeof window === "undefined") return { updatedAt: new Date().toISOString() };
  try {
    const raw = window.localStorage.getItem(WORKFLOW_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as WorkflowState) : { updatedAt: new Date().toISOString() };
  } catch {
    return { updatedAt: new Date().toISOString() };
  }
}

export function writeWorkflowState(patch: Partial<WorkflowState>) {
  if (typeof window === "undefined") return;
  const current = readWorkflowState();
  const next: WorkflowState = {
    ...current,
    ...patch,
    updatedAt: new Date().toISOString()
  };
  window.localStorage.setItem(WORKFLOW_STORAGE_KEY, JSON.stringify(next));
}

export function writeReviewDraft(content: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(REVIEW_DRAFT_STORAGE_KEY, content);
}

export function readReviewDraft() {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(REVIEW_DRAFT_STORAGE_KEY) ?? "";
}

export function appendKnowledgeContext(text: string) {
  const current = readWorkflowState();
  const nextContext = Array.from(new Set([...(current.knowledgeContext ?? []), text])).slice(-8);
  writeWorkflowState({ knowledgeContext: nextContext });
}
