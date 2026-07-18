-- Migration: video_editor_project
-- Server-side project save/resume for /dashboard/video-editor (mirrors ad_projects pattern).
-- NOT yet applied to any live database — apply via `prisma db push` or `prisma migrate deploy`.

-- VideoEditorProject
CREATE TABLE IF NOT EXISTS "video_editor_projects" (
    "id"        TEXT NOT NULL,
    "name"      TEXT NOT NULL DEFAULT 'Untitled video project',
    "state"     JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "video_editor_projects_pkey" PRIMARY KEY ("id")
);
