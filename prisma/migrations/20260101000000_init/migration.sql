-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "user_roles" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "game_modes" AS ENUM ('X01', 'CRICKET', 'AROUND_THE_CLOCK', 'CAREER');

-- CreateEnum
CREATE TYPE "game_statuses" AS ENUM ('WAITING', 'ACTIVE', 'FINISHED', 'ABANDONED');

-- CreateEnum
CREATE TYPE "friend_statuses" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'BLOCKED');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "role" "user_roles" NOT NULL DEFAULT 'USER',
    "display_name" VARCHAR(64) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guests" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "nickname" VARCHAR(64) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "migration_token_hash" VARCHAR(64),

    CONSTRAINT "guests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "elo_ratings" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "mode" VARCHAR(32) NOT NULL DEFAULT 'X01',
    "rating" INTEGER NOT NULL DEFAULT 1000,
    "games_played" INTEGER NOT NULL DEFAULT 0,
    "wins" INTEGER NOT NULL DEFAULT 0,
    "losses" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "elo_ratings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "performance_ratings" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "mode" VARCHAR(32) NOT NULL DEFAULT 'X01',
    "average_turn_score" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "checkout_pct" DECIMAL(5,4) NOT NULL DEFAULT 0,
    "games_played" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "performance_ratings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "game_sessions" (
    "id" UUID NOT NULL,
    "mode" "game_modes" NOT NULL DEFAULT 'X01',
    "status" "game_statuses" NOT NULL DEFAULT 'WAITING',
    "player_one_id" UUID NOT NULL,
    "player_two_id" UUID,
    "winner_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "finished_at" TIMESTAMPTZ(6),

    CONSTRAINT "game_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scores" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "points" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "friends" (
    "id" UUID NOT NULL,
    "requester_id" UUID NOT NULL,
    "addressee_id" UUID NOT NULL,
    "status" "friend_statuses" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "responded_at" TIMESTAMPTZ(6),

    CONSTRAINT "friends_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "career_quests" (
    "id" UUID NOT NULL,
    "slug" VARCHAR(64) NOT NULL,
    "name" VARCHAR(128) NOT NULL,
    "min_level" INTEGER NOT NULL DEFAULT 1,
    "quest_order" INTEGER NOT NULL,
    "payload" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "career_quests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "guests_user_id_key" ON "guests"("user_id");

-- CreateIndex
CREATE INDEX "guests_user_id_idx" ON "guests"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "elo_ratings_user_id_mode_key" ON "elo_ratings"("user_id", "mode");

-- CreateIndex
CREATE UNIQUE INDEX "performance_ratings_user_id_mode_key" ON "performance_ratings"("user_id", "mode");

-- CreateIndex
CREATE INDEX "game_sessions_player_one_id_idx" ON "game_sessions"("player_one_id");

-- CreateIndex
CREATE INDEX "game_sessions_player_two_id_idx" ON "game_sessions"("player_two_id");

-- CreateIndex
CREATE INDEX "game_sessions_winner_id_idx" ON "game_sessions"("winner_id");

-- CreateIndex
CREATE INDEX "game_sessions_status_idx" ON "game_sessions"("status");

-- CreateIndex
CREATE INDEX "scores_user_id_idx" ON "scores"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "scores_session_id_user_id_key" ON "scores"("session_id", "user_id");

-- CreateIndex
CREATE INDEX "friends_addressee_id_idx" ON "friends"("addressee_id");

-- CreateIndex
CREATE INDEX "friends_status_idx" ON "friends"("status");

-- CreateIndex
CREATE UNIQUE INDEX "friends_requester_id_addressee_id_key" ON "friends"("requester_id", "addressee_id");

-- CreateIndex
CREATE UNIQUE INDEX "career_quests_slug_key" ON "career_quests"("slug");

-- AddForeignKey
ALTER TABLE "guests" ADD CONSTRAINT "guests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "elo_ratings" ADD CONSTRAINT "elo_ratings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "performance_ratings" ADD CONSTRAINT "performance_ratings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_sessions" ADD CONSTRAINT "game_sessions_player_one_id_fkey" FOREIGN KEY ("player_one_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_sessions" ADD CONSTRAINT "game_sessions_player_two_id_fkey" FOREIGN KEY ("player_two_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_sessions" ADD CONSTRAINT "game_sessions_winner_id_fkey" FOREIGN KEY ("winner_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scores" ADD CONSTRAINT "scores_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "game_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scores" ADD CONSTRAINT "scores_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "friends" ADD CONSTRAINT "friends_requester_id_fkey" FOREIGN KEY ("requester_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "friends" ADD CONSTRAINT "friends_addressee_id_fkey" FOREIGN KEY ("addressee_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

