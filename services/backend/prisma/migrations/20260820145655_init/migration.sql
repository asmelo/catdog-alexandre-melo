-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'CLIENTE');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('PENDING_CONFIRMATION', 'ACTIVE');

-- CreateEnum
CREATE TYPE "RefreshTokenRevokedReason" AS ENUM ('ROTATED', 'LOGOUT', 'REUSE_DETECTED', 'EXPIRED', 'ACCOUNT_DISABLED');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "password_hash" VARCHAR(72) NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'CLIENTE',
    "status" "UserStatus" NOT NULL DEFAULT 'PENDING_CONFIRMATION',
    "email_confirmed_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_confirmation_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" CHAR(64) NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "consumed_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_confirmation_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "family_id" UUID NOT NULL,
    "token_hash" CHAR(64) NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMPTZ(3),
    "revoked_reason" "RefreshTokenRevokedReason",
    "replaced_by_id" UUID,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_status_idx" ON "users"("status");

-- CreateIndex
CREATE UNIQUE INDEX "email_confirmation_tokens_token_hash_key" ON "email_confirmation_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "email_confirmation_tokens_user_id_consumed_at_idx" ON "email_confirmation_tokens"("user_id", "consumed_at");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_replaced_by_id_key" ON "refresh_tokens"("replaced_by_id");

-- CreateIndex
CREATE INDEX "refresh_tokens_family_id_revoked_at_idx" ON "refresh_tokens"("family_id", "revoked_at");

-- CreateIndex
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");

-- AddForeignKey
ALTER TABLE "email_confirmation_tokens" ADD CONSTRAINT "email_confirmation_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
