-- CreateTable: Free Mode Chat Sessions
CREATE TABLE IF NOT EXISTS "free_mode_sessions" (
    "id" TEXT NOT NULL,
    "userKey" TEXT NOT NULL,
    "title" TEXT,
    "characters" TEXT[],
    "introText" TEXT,
    "introPhone" TEXT,
    "outroText" TEXT,
    "outroPhone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "free_mode_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "free_mode_sessions_userKey_idx" ON "free_mode_sessions"("userKey");

-- CreateTable: Free Mode Chat Messages
CREATE TABLE IF NOT EXISTS "free_mode_messages" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "scenes" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "free_mode_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "free_mode_messages_sessionId_idx" ON "free_mode_messages"("sessionId");

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "free_mode_messages"
        ADD CONSTRAINT "free_mode_messages_sessionId_fkey"
        FOREIGN KEY ("sessionId") REFERENCES "free_mode_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateTable: Free Mode Daily Usage
CREATE TABLE IF NOT EXISTS "free_mode_daily_usage" (
    "id" TEXT NOT NULL,
    "userKey" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "imageCount" INTEGER NOT NULL DEFAULT 0,
    "videoCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "free_mode_daily_usage_pkey" PRIMARY KEY ("id")
);

-- CreateUniqueIndex
CREATE UNIQUE INDEX IF NOT EXISTS "free_mode_daily_usage_userKey_date_key"
    ON "free_mode_daily_usage"("userKey", "date");
