-- Migration: story_qc_and_edit_history
-- Applied via prisma db push on 2026-05-16. This file records the schema for migration history.

-- StoryQCProject
CREATE TABLE IF NOT EXISTS "story_qc_projects" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "rawStoryText" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "contractId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "story_qc_projects_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "story_qc_projects_contractId_key" ON "story_qc_projects"("contractId");

-- StoryQCContract
CREATE TABLE IF NOT EXISTS "story_qc_contracts" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "culture" TEXT NOT NULL,
    "storyType" TEXT NOT NULL,
    "totalDurationSeconds" INTEGER NOT NULL,
    "sceneDurationSeconds" INTEGER NOT NULL,
    "estimatedSceneCount" INTEGER NOT NULL,
    "languageLevel" TEXT NOT NULL,
    "emotionalIntensity" TEXT NOT NULL,
    "subtitleStyle" TEXT NOT NULL,
    "generationMode" TEXT NOT NULL,
    "targetAudience" TEXT NOT NULL DEFAULT 'general',
    "ageRating" TEXT NOT NULL DEFAULT 'PG',
    "defaultEthnicity" TEXT,
    "allowRaceOverride" BOOLEAN NOT NULL DEFAULT true,
    "musicStyle" TEXT,
    "nameStyle" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "story_qc_contracts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "story_qc_contracts_projectId_key" ON "story_qc_contracts"("projectId");

ALTER TABLE "story_qc_contracts" ADD CONSTRAINT "story_qc_contracts_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "story_qc_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- StoryQCDraft
CREATE TABLE IF NOT EXISTS "story_qc_drafts" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "originalText" TEXT NOT NULL,
    "simplifiedText" TEXT,
    "screeningScore" INTEGER NOT NULL DEFAULT 0,
    "screeningPassed" BOOLEAN NOT NULL DEFAULT false,
    "screeningIssues" JSONB,
    "culturePassed" BOOLEAN NOT NULL DEFAULT false,
    "cultureIssues" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "story_qc_drafts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "story_qc_drafts_projectId_key" ON "story_qc_drafts"("projectId");

ALTER TABLE "story_qc_drafts" ADD CONSTRAINT "story_qc_drafts_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "story_qc_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- StoryQCCastMember
CREATE TABLE IF NOT EXISTS "story_qc_cast_members" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "age" TEXT,
    "gender" TEXT,
    "ethnicity" TEXT,
    "skinTone" TEXT,
    "bodyType" TEXT,
    "hair" TEXT,
    "clothing" TEXT,
    "role" TEXT,
    "personality" TEXT,
    "voiceStyle" TEXT,
    "relationship" TEXT,
    "emotionalArc" TEXT,
    "firstScene" TEXT,
    "scenes" JSONB,
    "costumeChanges" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "story_qc_cast_members_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "story_qc_cast_members_projectId_characterId_key"
    ON "story_qc_cast_members"("projectId", "characterId");

ALTER TABLE "story_qc_cast_members" ADD CONSTRAINT "story_qc_cast_members_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "story_qc_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- StoryQCScenePlan
CREATE TABLE IF NOT EXISTS "story_qc_scene_plans" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "sceneId" TEXT NOT NULL,
    "sceneNumber" INTEGER NOT NULL,
    "duration" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "characters" JSONB,
    "location" TEXT,
    "timeOfDay" TEXT,
    "emotion" TEXT,
    "visualPrompt" TEXT,
    "imagePrompt" TEXT,
    "videoPrompt" TEXT,
    "negativePrompt" TEXT,
    "voiceoverText" TEXT,
    "dialogue" TEXT,
    "subtitleText" TEXT,
    "subtitleStyle" TEXT,
    "musicCue" TEXT,
    "sfxCues" JSONB,
    "cameraStyle" TEXT,
    "continuityNotes" JSONB,
    "providerRecommendation" TEXT,
    "providerReason" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "story_qc_scene_plans_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "story_qc_scene_plans_projectId_sceneId_key"
    ON "story_qc_scene_plans"("projectId", "sceneId");

ALTER TABLE "story_qc_scene_plans" ADD CONSTRAINT "story_qc_scene_plans_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "story_qc_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- StorySupervisorReport
CREATE TABLE IF NOT EXISTS "story_supervisor_reports" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "supervisorName" TEXT NOT NULL,
    "passed" BOOLEAN NOT NULL,
    "score" INTEGER NOT NULL,
    "blockingIssues" JSONB NOT NULL,
    "warnings" JSONB NOT NULL,
    "suggestedFixes" JSONB NOT NULL,
    "revisedData" JSONB,
    "runAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "story_supervisor_reports_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "story_supervisor_reports_projectId_supervisorName_idx"
    ON "story_supervisor_reports"("projectId", "supervisorName");

ALTER TABLE "story_supervisor_reports" ADD CONSTRAINT "story_supervisor_reports_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "story_qc_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- StoryGenerationPlan
CREATE TABLE IF NOT EXISTS "story_generation_plans" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "totalScenes" INTEGER NOT NULL,
    "totalDuration" INTEGER NOT NULL,
    "estimatedCost" JSONB,
    "readyToGenerate" BOOLEAN NOT NULL DEFAULT false,
    "gatekeeperScore" INTEGER NOT NULL DEFAULT 0,
    "gatekeeperIssues" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "story_generation_plans_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "story_generation_plans_projectId_key"
    ON "story_generation_plans"("projectId");

ALTER TABLE "story_generation_plans" ADD CONSTRAINT "story_generation_plans_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "story_qc_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- StoryEditHistory
CREATE TABLE IF NOT EXISTS "story_edit_history" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "instruction" TEXT NOT NULL,
    "resolvedObjectId" TEXT NOT NULL,
    "changeType" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "beforeSnapshot" JSONB,
    "afterSnapshot" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "undone" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "story_edit_history_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "story_edit_history_projectId_idx" ON "story_edit_history"("projectId");
