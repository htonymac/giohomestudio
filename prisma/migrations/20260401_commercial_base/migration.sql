-- Base creation of commercial_projects and commercial_slides tables.
-- These were originally created via `prisma db push` and were missing from
-- migration history, causing P3006 shadow-database failures when later ALTER
-- TABLE migrations (20260405_commercial_motion etc.) tried to run.

CREATE TABLE IF NOT EXISTS "commercial_projects" (
    "id"                TEXT NOT NULL,
    "projectName"       TEXT NOT NULL,
    "aspectRatio"       TEXT NOT NULL DEFAULT '9:16',
    "brandName"         TEXT,
    "brandLogoPath"     TEXT,
    "colorAccent"       TEXT,
    "tagline"           TEXT,
    "ctaMethod"         TEXT,
    "ctaValue"          TEXT,
    "ctaValueSecondary" TEXT,
    "ctaLabel"          TEXT,
    "voiceId"           TEXT,
    "voiceLanguage"     TEXT,
    "targetDurationSec" INTEGER,
    "autoDistribute"    BOOLEAN NOT NULL DEFAULT false,
    "captionMaxWords"   INTEGER NOT NULL DEFAULT 8,
    "captionMaxChars"   INTEGER,
    "musicPath"         TEXT,
    "musicSource"       TEXT,
    "musicVolume"       DOUBLE PRECISION NOT NULL DEFAULT 0.85,
    "narrationVolume"   DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "narrationScript"   TEXT,
    "enhancementPreset" TEXT,
    "enhancementLevel"  INTEGER,
    "renderStatus"      TEXT NOT NULL DEFAULT 'draft',
    "contentItemId"     TEXT,
    "destinationPageId" TEXT,
    "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "commercial_projects_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "commercial_slides" (
    "id"                  TEXT NOT NULL,
    "projectId"           TEXT NOT NULL,
    "slideOrder"          INTEGER NOT NULL,
    "imagePath"           TEXT,
    "imageFileName"       TEXT,
    "captionOriginal"     TEXT,
    "captionPolished"     TEXT,
    "captionApproved"     BOOLEAN NOT NULL DEFAULT false,
    "narrationLine"       TEXT,
    "durationMs"          INTEGER NOT NULL DEFAULT 3000,
    "brandingEnabled"     BOOLEAN NOT NULL DEFAULT false,
    "enhancementSettings" JSONB,
    "status"              TEXT NOT NULL DEFAULT 'draft',
    "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "commercial_slides_pkey" PRIMARY KEY ("id")
);

-- Foreign key (wrapped in DO block to be idempotent)
DO $$ BEGIN
    ALTER TABLE "commercial_slides"
        ADD CONSTRAINT "commercial_slides_projectId_fkey"
        FOREIGN KEY ("projectId") REFERENCES "commercial_projects"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
