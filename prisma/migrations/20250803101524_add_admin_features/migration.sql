-- CreateEnum
CREATE TYPE "public"."AdminActionType" AS ENUM ('ADMIN_SELECT', 'CANCEL_SELECTION', 'FORCE_RESOLUTION', 'RESET_ROUND', 'TIMEOUT_CONFIG', 'EMERGENCY_PAUSE', 'BACKUP_RESTORE');

-- AlterTable
ALTER TABLE "public"."PlayerSelection" ADD COLUMN     "adminReason" TEXT,
ADD COLUMN     "isAdminSelection" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "public"."User" ADD COLUMN     "emailVerified" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "public"."Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "public"."AuctionConfig" (
    "id" TEXT NOT NULL,
    "leagueId" TEXT NOT NULL,
    "timeoutSeconds" INTEGER NOT NULL DEFAULT 30,
    "autoSelectOnTimeout" BOOLEAN NOT NULL DEFAULT true,
    "pauseOnDisconnect" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuctionConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AdminAction" (
    "id" TEXT NOT NULL,
    "leagueId" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "action" "public"."AdminActionType" NOT NULL,
    "targetTeamId" TEXT,
    "playerId" TEXT,
    "roundId" TEXT,
    "reason" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminAction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "public"."Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "public"."Session"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "public"."VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "public"."VerificationToken"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "AuctionConfig_leagueId_key" ON "public"."AuctionConfig"("leagueId");

-- AddForeignKey
ALTER TABLE "public"."Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AuctionConfig" ADD CONSTRAINT "AuctionConfig_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "public"."League"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AdminAction" ADD CONSTRAINT "AdminAction_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "public"."League"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AdminAction" ADD CONSTRAINT "AdminAction_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AdminAction" ADD CONSTRAINT "AdminAction_targetTeamId_fkey" FOREIGN KEY ("targetTeamId") REFERENCES "public"."Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AdminAction" ADD CONSTRAINT "AdminAction_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "public"."Player"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AdminAction" ADD CONSTRAINT "AdminAction_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "public"."AuctionRound"("id") ON DELETE SET NULL ON UPDATE CASCADE;
