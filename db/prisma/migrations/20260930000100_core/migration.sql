-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "authority" AS ENUM ('approve_routine', 'approve_decline_refer', 'approve_board_level');

-- CreateEnum
CREATE TYPE "lead_state" AS ENUM ('received', 'filtered', 'classifying', 'not_lead', 'awaiting_verdict', 'drafting', 'draft_failed', 'awaiting_owner', 'sent', 'discarded', 'void', 'resolved');

-- CreateEnum
CREATE TYPE "classification" AS ENUM ('lead', 'not_lead', 'unsure', 'failed');

-- CreateEnum
CREATE TYPE "approval_state" AS ENUM ('issued', 'sending', 'sent', 'failed', 'void');

-- CreateEnum
CREATE TYPE "approval_category" AS ENUM ('routine', 'decline_refer', 'board_level');

-- CreateEnum
CREATE TYPE "decision_action" AS ENUM ('send', 'send_edited', 'discard');

-- CreateEnum
CREATE TYPE "discard_reason" AS ENUM ('not_a_lead', 'reply_myself', 'draft_wrong');

-- CreateEnum
CREATE TYPE "ack_variant" AS ENUM ('with_name', 'without_name');

-- CreateEnum
CREATE TYPE "send_state" AS ENUM ('sending', 'sent', 'failed');

-- CreateEnum
CREATE TYPE "retention_method" AS ENUM ('partition_drop', 'purge', 'file_delete', 'keep');

-- CreateTable
CREATE TABLE "workspaces" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workspaces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "workspace_id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_authorities" (
    "user_id" UUID NOT NULL,
    "authority" "authority" NOT NULL,
    "granted_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_authorities_pkey" PRIMARY KEY ("user_id","authority")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fresh_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "revoked_at" TIMESTAMPTZ(3),

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sign_in_links" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "redirect_path" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "used_at" TIMESTAMPTZ(3),

    CONSTRAINT "sign_in_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contacts" (
    "workspace_id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "first_seen_at" TIMESTAMPTZ(3) NOT NULL,
    "last_seen_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "contacts_pkey" PRIMARY KEY ("workspace_id","email")
);

-- CreateTable
CREATE TABLE "leads" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "workspace_id" UUID NOT NULL,
    "message_id" TEXT NOT NULL,
    "gmail_message_id" TEXT NOT NULL,
    "gmail_thread_id" TEXT NOT NULL,
    "from_email" TEXT NOT NULL,
    "from_name" TEXT,
    "subject" TEXT NOT NULL,
    "received_at" TIMESTAMPTZ(3) NOT NULL,
    "state" "lead_state" NOT NULL DEFAULT 'received',
    "classification" "classification",
    "confidence" DECIMAL(4,3),
    "paperclip_issue_id" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_bodies" (
    "lead_id" UUID NOT NULL,
    "raw_body" TEXT NOT NULL,
    "clean_body" TEXT,
    "received_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "email_bodies_pkey" PRIMARY KEY ("lead_id")
);

-- CreateTable
CREATE TABLE "ack_template_versions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "workspace_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "with_name_text" TEXT NOT NULL,
    "without_name_text" TEXT NOT NULL,
    "approved_by_user_id" UUID,
    "approved_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ack_template_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "acks" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "workspace_id" UUID NOT NULL,
    "lead_id" UUID NOT NULL,
    "to_email" TEXT NOT NULL,
    "template_version_id" UUID NOT NULL,
    "variant" "ack_variant" NOT NULL,
    "state" "send_state" NOT NULL DEFAULT 'sending',
    "gmail_message_id" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sent_at" TIMESTAMPTZ(3),

    CONSTRAINT "acks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approvals" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "workspace_id" UUID NOT NULL,
    "lead_id" UUID NOT NULL,
    "category" "approval_category" NOT NULL,
    "state" "approval_state" NOT NULL DEFAULT 'issued',
    "draft_text" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "issued_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "sending_at" TIMESTAMPTZ(3),
    "sent_at" TIMESTAMPTZ(3),
    "gmail_message_id" TEXT,
    "send_attempts" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "approvals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "decisions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "approval_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "authority_used" "authority" NOT NULL,
    "action" "decision_action" NOT NULL,
    "final_text" TEXT,
    "discard_reason" "discard_reason",
    "decided_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "decisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "retention_policies" (
    "data_class" TEXT NOT NULL,
    "keep_days" INTEGER,
    "method" "retention_method" NOT NULL,

    CONSTRAINT "retention_policies_pkey" PRIMARY KEY ("data_class")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_workspace_id_email_key" ON "users"("workspace_id", "email");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_token_hash_key" ON "sessions"("token_hash");

-- CreateIndex
CREATE UNIQUE INDEX "sign_in_links_token_hash_key" ON "sign_in_links"("token_hash");

-- CreateIndex
CREATE INDEX "leads_workspace_id_state_idx" ON "leads"("workspace_id", "state");

-- CreateIndex
CREATE UNIQUE INDEX "leads_workspace_id_message_id_key" ON "leads"("workspace_id", "message_id");

-- CreateIndex
CREATE INDEX "email_bodies_received_at_idx" ON "email_bodies"("received_at");

-- CreateIndex
CREATE UNIQUE INDEX "ack_template_versions_workspace_id_version_key" ON "ack_template_versions"("workspace_id", "version");

-- CreateIndex
CREATE UNIQUE INDEX "acks_lead_id_key" ON "acks"("lead_id");

-- CreateIndex
CREATE INDEX "acks_workspace_id_to_email_created_at_idx" ON "acks"("workspace_id", "to_email", "created_at");

-- CreateIndex
CREATE INDEX "acks_workspace_id_created_at_idx" ON "acks"("workspace_id", "created_at");

-- CreateIndex
CREATE INDEX "approvals_workspace_id_state_idx" ON "approvals"("workspace_id", "state");

-- CreateIndex
CREATE UNIQUE INDEX "decisions_approval_id_key" ON "decisions"("approval_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_authorities" ADD CONSTRAINT "user_authorities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sign_in_links" ADD CONSTRAINT "sign_in_links_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_bodies" ADD CONSTRAINT "email_bodies_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ack_template_versions" ADD CONSTRAINT "ack_template_versions_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ack_template_versions" ADD CONSTRAINT "ack_template_versions_approved_by_user_id_fkey" FOREIGN KEY ("approved_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "acks" ADD CONSTRAINT "acks_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "acks" ADD CONSTRAINT "acks_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "acks" ADD CONSTRAINT "acks_template_version_id_fkey" FOREIGN KEY ("template_version_id") REFERENCES "ack_template_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decisions" ADD CONSTRAINT "decisions_approval_id_fkey" FOREIGN KEY ("approval_id") REFERENCES "approvals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decisions" ADD CONSTRAINT "decisions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Hand-written below this line (Prisma does not model CHECKs, triggers or seed rows).
-- ---------------------------------------------------------------------------

-- FD-1, FD-1a: addresses are stored lowercase so dedupe and contact lookups cannot split a person.
ALTER TABLE "users" ADD CONSTRAINT "users_email_lowercase" CHECK ("email" = lower("email"));
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_email_lowercase" CHECK ("email" = lower("email"));
ALTER TABLE "leads" ADD CONSTRAINT "leads_from_email_lowercase" CHECK ("from_email" = lower("from_email"));
ALTER TABLE "acks" ADD CONSTRAINT "acks_to_email_lowercase" CHECK ("to_email" = lower("to_email"));

-- FD-5: the approval state machine, enforced in the database as well as in @orbit/shared/approvals.
CREATE FUNCTION approval_state_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.state = OLD.state THEN
    RETURN NEW;
  END IF;
  IF (OLD.state::text, NEW.state::text) IN (
    ('issued', 'sending'), ('issued', 'void'),
    ('sending', 'sent'), ('sending', 'failed'),
    ('failed', 'sending'), ('failed', 'void')
  ) THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'invalid approval transition % -> %', OLD.state, NEW.state
    USING ERRCODE = 'check_violation';
END $$;

CREATE TRIGGER approvals_state_guard
  BEFORE UPDATE OF state ON "approvals"
  FOR EACH ROW EXECUTE FUNCTION approval_state_guard();

-- DAT-3 retention defaults. Changing a period is a data change, never a code change.
INSERT INTO "retention_policies" ("data_class", "keep_days", "method") VALUES
  ('raw_email_bodies', 90, 'purge'),
  ('hermes_sessions', 90, 'file_delete'),
  ('ledger_events', 730, 'partition_drop'),
  ('receipts', NULL, 'keep'),
  ('backups', 30, 'file_delete');
