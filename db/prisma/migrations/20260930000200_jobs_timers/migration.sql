-- CreateEnum
CREATE TYPE "job_kind" AS ENUM ('draft_poll', 'verdict_poll', 'notice', 'digest', 'send', 'ack_send');

-- CreateEnum
CREATE TYPE "job_state" AS ENUM ('pending', 'running', 'done', 'failed', 'dead');

-- CreateEnum
CREATE TYPE "timer_kind" AS ENUM ('reminder_2h', 'void_72h', 'digest_daily', 'ack_cap_window');

-- CreateTable
CREATE TABLE "jobs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "workspace_id" UUID NOT NULL,
    "kind" "job_kind" NOT NULL,
    "state" "job_state" NOT NULL DEFAULT 'pending',
    "run_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 5,
    "locked_by" TEXT,
    "locked_until" TIMESTAMPTZ(3),
    "dedupe_key" TEXT NOT NULL,
    "lead_id" UUID,
    "approval_id" UUID,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "last_error" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "timers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "workspace_id" UUID NOT NULL,
    "kind" "timer_kind" NOT NULL,
    "fire_at" TIMESTAMPTZ(3) NOT NULL,
    "fired_at" TIMESTAMPTZ(3),
    "cancelled_at" TIMESTAMPTZ(3),
    "dedupe_key" TEXT NOT NULL,
    "approval_id" UUID,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "timers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "jobs_dedupe_key_key" ON "jobs"("dedupe_key");

-- CreateIndex
CREATE INDEX "jobs_state_run_at_idx" ON "jobs"("state", "run_at");

-- CreateIndex
CREATE UNIQUE INDEX "timers_dedupe_key_key" ON "timers"("dedupe_key");

-- CreateIndex
CREATE INDEX "timers_fire_at_idx" ON "timers"("fire_at");
