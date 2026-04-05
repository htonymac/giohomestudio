-- Add slide transition and motion fields to commercial_projects
-- These fields are read/written via $queryRaw/$executeRaw since prisma generate
-- cannot be run while the dev server is active (Windows Defender DLL lock).

ALTER TABLE commercial_projects
  ADD COLUMN IF NOT EXISTS "transitionType"        TEXT,
  ADD COLUMN IF NOT EXISTS "transitionDurationSec" DOUBLE PRECISION;
