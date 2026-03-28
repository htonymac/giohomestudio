// GioHomeStudio — Content Types

export type ContentStatus =
  | "PENDING"
  | "ENHANCING"
  | "GENERATING_VIDEO"
  | "GENERATING_VOICE"
  | "GENERATING_MUSIC"
  | "MERGING"
  | "IN_REVIEW"
  | "APPROVED"
  | "REJECTED"
  | "FAILED"
  | "PUBLISHED"
  | "ARCHIVED";

export type ContentMode = "FREE";

export interface ContentItem {
  id: string;
  mode: ContentMode;
  status: ContentStatus;
  originalInput: string;
  enhancedPrompt?: string | null;
  videoProvider?: string | null;
  voiceProvider?: string | null;
  musicProvider?: string | null;
  videoPath?: string | null;
  voicePath?: string | null;
  musicPath?: string | null;
  mergedOutputPath?: string | null;
  durationSeconds?: number | null;
  notes?: string | null;
  createdAt: Date;
  updatedAt: Date;
  approvedAt?: Date | null;
  rejectedAt?: Date | null;
}

export interface ContentVersion {
  id: string;
  contentItemId: string;
  versionNumber: number;
  enhancedPrompt?: string | null;
  videoPath?: string | null;
  voicePath?: string | null;
  musicPath?: string | null;
  mergedOutputPath?: string | null;
  status: ContentStatus;
  reason?: string | null;
  createdAt: Date;
}

export type ReviewActionType =
  | "APPROVED"
  | "REJECTED"
  | "SENT_BACK"
  | "SAVED_DRAFT"
  | "MARKED_FOR_LATER";

export interface ReviewAction {
  id: string;
  contentItemId: string;
  action: ReviewActionType;
  reviewerNote?: string | null;
  createdAt: Date;
}
