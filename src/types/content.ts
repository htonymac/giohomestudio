// GioHomeStudio — Content Types

export type PagePlatform = "YOUTUBE" | "INSTAGRAM" | "TIKTOK" | "FACEBOOK" | "OTHER";

export interface DestinationPage {
  id: string;
  name: string;
  platform: PagePlatform;
  handle?: string | null;
  notes?: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

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
  requestedVideoProvider?: string | null;
  videoProvider?: string | null;
  voiceProvider?: string | null;
  requestedVoiceProvider?: string | null;
  voiceId?: string | null;
  voiceLanguage?: string | null;
  narrationSpeed?: number | null;
  narrationVolume?: number | null;
  audioMode?: string | null;
  musicProvider?: string | null;
  requestedMusicProvider?: string | null;
  musicVolume?: number | null;
  musicGenre?: string | null;
  musicRegion?: string | null;
  videoQuality?: string | null;
  videoType?: string | null;
  visualStyle?: string | null;
  subjectType?: string | null;
  customSubjectDescription?: string | null;
  aiAutoMode?: boolean;
  videoPath?: string | null;
  voicePath?: string | null;
  musicPath?: string | null;
  mergedOutputPath?: string | null;
  durationSeconds?: number | null;
  notes?: string | null;
  destinationPageId?: string | null;
  destinationPage?: DestinationPage | null;
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
