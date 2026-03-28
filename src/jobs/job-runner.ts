// GioHomeStudio — Job Runner
// Processes queued pipeline jobs.
// In Phase 1 this is called directly from API routes.
// Phase 2 can replace with BullMQ or similar queue.

import { prisma } from "@/lib/prisma";
import { runPipeline } from "@/core/pipeline";
import type { PipelineInput } from "@/types/pipeline";

export interface JobRunnerInput {
  contentItemId?: string; // run for an existing item
  pipelineInput?: PipelineInput; // or start fresh
}

export async function processJob(input: JobRunnerInput): Promise<void> {
  if (input.pipelineInput) {
    await runPipeline(input.pipelineInput);
    return;
  }

  if (input.contentItemId) {
    const item = await prisma.contentItem.findUnique({
      where: { id: input.contentItemId },
    });

    if (!item) {
      console.error(`[JobRunner] Content item not found: ${input.contentItemId}`);
      return;
    }

    await runPipeline({
      rawInput: item.originalInput,
      mode: "FREE",
    });
  }
}

