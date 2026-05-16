-- GHS Story QC + Edit History tables
-- Safe: CREATE TABLE IF NOT EXISTS — touches nothing that already exists

CREATE TABLE IF NOT EXISTS story_qc_projects (
  id               TEXT NOT NULL,
  title            TEXT NOT NULL,
  "rawStoryText"   TEXT NOT NULL,
  status           TEXT NOT NULL DEFAULT 'draft',
  "contractId"     TEXT,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT story_qc_projects_pkey PRIMARY KEY (id),
  CONSTRAINT story_qc_projects_contractId_key UNIQUE ("contractId")
);

CREATE TABLE IF NOT EXISTS story_qc_contracts (
  id                     TEXT NOT NULL,
  "projectId"            TEXT NOT NULL,
  country                TEXT NOT NULL,
  culture                TEXT NOT NULL,
  "storyType"            TEXT NOT NULL,
  "totalDurationSeconds" INTEGER NOT NULL,
  "sceneDurationSeconds" INTEGER NOT NULL,
  "estimatedSceneCount"  INTEGER NOT NULL,
  "languageLevel"        TEXT NOT NULL,
  "emotionalIntensity"   TEXT NOT NULL,
  "subtitleStyle"        TEXT NOT NULL,
  "generationMode"       TEXT NOT NULL,
  "defaultCastAssumptions" JSONB NOT NULL DEFAULT '{}',
  "createdAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT story_qc_contracts_pkey PRIMARY KEY (id),
  CONSTRAINT story_qc_contracts_projectId_key UNIQUE ("projectId")
);
DO $$ BEGIN
  ALTER TABLE story_qc_contracts ADD CONSTRAINT story_qc_contracts_projectId_fkey
    FOREIGN KEY ("projectId") REFERENCES story_qc_projects(id) ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS story_qc_drafts (
  id               TEXT NOT NULL,
  "projectId"      TEXT NOT NULL,
  "expandedText"   TEXT,
  "simplifiedText" TEXT,
  "supervisorResults" JSONB,
  "pipelineStatus" TEXT NOT NULL DEFAULT 'pending',
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT story_qc_drafts_pkey PRIMARY KEY (id),
  CONSTRAINT story_qc_drafts_projectId_key UNIQUE ("projectId")
);
DO $$ BEGIN
  ALTER TABLE story_qc_drafts ADD CONSTRAINT story_qc_drafts_projectId_fkey
    FOREIGN KEY ("projectId") REFERENCES story_qc_projects(id) ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS story_qc_cast_members (
  id               TEXT NOT NULL,
  "projectId"      TEXT NOT NULL,
  character_id     TEXT NOT NULL,
  name             TEXT NOT NULL,
  role             TEXT NOT NULL DEFAULT 'supporting',
  ethnicity        TEXT NOT NULL DEFAULT 'unspecified',
  skin_tone        TEXT NOT NULL DEFAULT 'unspecified',
  gender           TEXT NOT NULL DEFAULT 'unspecified',
  age              TEXT NOT NULL DEFAULT 'adult',
  clothing         TEXT NOT NULL DEFAULT 'unspecified',
  voice_style      TEXT NOT NULL DEFAULT 'neutral',
  visual_anchor    TEXT,
  is_protagonist   BOOLEAN NOT NULL DEFAULT false,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT story_qc_cast_members_pkey PRIMARY KEY (id)
);
DO $$ BEGIN
  ALTER TABLE story_qc_cast_members ADD CONSTRAINT story_qc_cast_members_projectId_fkey
    FOREIGN KEY ("projectId") REFERENCES story_qc_projects(id) ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
CREATE INDEX IF NOT EXISTS story_qc_cast_members_projectId_idx ON story_qc_cast_members ("projectId");

CREATE TABLE IF NOT EXISTS story_qc_scene_plans (
  id                       TEXT NOT NULL,
  "projectId"              TEXT NOT NULL,
  scene_id                 TEXT NOT NULL,
  scene_number             INTEGER NOT NULL,
  duration                 INTEGER NOT NULL,
  title                    TEXT NOT NULL,
  summary                  TEXT NOT NULL DEFAULT '',
  characters               JSONB NOT NULL DEFAULT '[]',
  location                 TEXT NOT NULL DEFAULT 'unspecified',
  time_of_day              TEXT NOT NULL DEFAULT 'daytime',
  emotion                  TEXT NOT NULL DEFAULT 'neutral',
  visual_prompt            TEXT NOT NULL DEFAULT '',
  image_prompt             TEXT NOT NULL DEFAULT '',
  video_prompt             TEXT NOT NULL DEFAULT '',
  negative_prompt          TEXT NOT NULL DEFAULT '',
  voiceover_text           TEXT NOT NULL DEFAULT '',
  dialogue                 TEXT NOT NULL DEFAULT '',
  subtitle_text            TEXT NOT NULL DEFAULT '',
  subtitle_style           TEXT NOT NULL DEFAULT 'normal_movie',
  music_cue                TEXT NOT NULL DEFAULT '',
  sfx_cues                 JSONB NOT NULL DEFAULT '[]',
  camera_style             TEXT NOT NULL DEFAULT 'medium shot',
  continuity_notes         JSONB NOT NULL DEFAULT '[]',
  provider_recommendation  TEXT NOT NULL DEFAULT 'image_plus_motion',
  provider_reason          TEXT NOT NULL DEFAULT '',
  shots                    JSONB,
  "createdAt"              TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"              TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT story_qc_scene_plans_pkey PRIMARY KEY (id)
);
DO $$ BEGIN
  ALTER TABLE story_qc_scene_plans ADD CONSTRAINT story_qc_scene_plans_projectId_fkey
    FOREIGN KEY ("projectId") REFERENCES story_qc_projects(id) ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
CREATE INDEX IF NOT EXISTS story_qc_scene_plans_projectId_idx ON story_qc_scene_plans ("projectId");

CREATE TABLE IF NOT EXISTS story_supervisor_reports (
  id               TEXT NOT NULL,
  "projectId"      TEXT NOT NULL,
  "supervisorName" TEXT NOT NULL,
  passed           BOOLEAN NOT NULL,
  score            INTEGER NOT NULL,
  "blockingIssues" JSONB NOT NULL DEFAULT '[]',
  warnings         JSONB NOT NULL DEFAULT '[]',
  "suggestedFixes" JSONB NOT NULL DEFAULT '[]',
  "revisedData"    JSONB,
  "runAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT story_supervisor_reports_pkey PRIMARY KEY (id)
);
DO $$ BEGIN
  ALTER TABLE story_supervisor_reports ADD CONSTRAINT story_supervisor_reports_projectId_fkey
    FOREIGN KEY ("projectId") REFERENCES story_qc_projects(id) ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
CREATE INDEX IF NOT EXISTS story_supervisor_reports_projectId_supervisorName_idx
  ON story_supervisor_reports ("projectId", "supervisorName");

CREATE TABLE IF NOT EXISTS story_generation_plans (
  id                TEXT NOT NULL,
  "projectId"       TEXT NOT NULL,
  "totalScenes"     INTEGER NOT NULL,
  "totalDuration"   INTEGER NOT NULL,
  "estimatedCost"   JSONB,
  "readyToGenerate" BOOLEAN NOT NULL DEFAULT false,
  "gatekeeperScore" INTEGER NOT NULL DEFAULT 0,
  "gatekeeperIssues" JSONB,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT story_generation_plans_pkey PRIMARY KEY (id),
  CONSTRAINT story_generation_plans_projectId_key UNIQUE ("projectId")
);
DO $$ BEGIN
  ALTER TABLE story_generation_plans ADD CONSTRAINT story_generation_plans_projectId_fkey
    FOREIGN KEY ("projectId") REFERENCES story_qc_projects(id) ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS story_edit_history (
  id                 TEXT NOT NULL,
  "projectId"        TEXT NOT NULL,
  instruction        TEXT NOT NULL,
  "resolvedObjectId" TEXT NOT NULL,
  "changeType"       TEXT NOT NULL,
  scope              TEXT NOT NULL,
  "beforeSnapshot"   JSONB,
  "afterSnapshot"    JSONB,
  timestamp          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  undone             BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT story_edit_history_pkey PRIMARY KEY (id)
);
CREATE INDEX IF NOT EXISTS story_edit_history_projectId_idx ON story_edit_history ("projectId");

SELECT
  table_name,
  'OK' AS status
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'story_qc_projects','story_qc_contracts','story_qc_drafts',
    'story_qc_cast_members','story_qc_scene_plans',
    'story_supervisor_reports','story_generation_plans','story_edit_history'
  )
ORDER BY table_name;
