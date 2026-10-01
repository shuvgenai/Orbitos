-- CreateEnum
CREATE TYPE "gmail_connection_state" AS ENUM ('connected', 'revoked');

-- CreateTable
CREATE TABLE "gmail_connections" (
    "workspace_id" UUID NOT NULL,
    "email_address" TEXT NOT NULL,
    "refresh_token_cipher" TEXT NOT NULL,
    "history_id" TEXT NOT NULL,
    "state" "gmail_connection_state" NOT NULL DEFAULT 'connected',
    "last_checked_at" TIMESTAMPTZ(3),
    "revoked_at" TIMESTAMPTZ(3),

    CONSTRAINT "gmail_connections_pkey" PRIMARY KEY ("workspace_id")
);

-- CreateTable
CREATE TABLE "decision_calls" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "workspace_id" UUID NOT NULL,
    "lead_id" UUID,
    "model" TEXT NOT NULL,
    "outcome" "classification" NOT NULL,
    "confidence" DECIMAL(4,3),
    "input_tokens" INTEGER NOT NULL,
    "output_tokens" INTEGER NOT NULL,
    "cost_usd" DECIMAL(10,6) NOT NULL,
    "latency_ms" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "decision_calls_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "decision_calls_workspace_id_created_at_idx" ON "decision_calls"("workspace_id", "created_at");

-- AddForeignKey
ALTER TABLE "gmail_connections" ADD CONSTRAINT "gmail_connections_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decision_calls" ADD CONSTRAINT "decision_calls_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
