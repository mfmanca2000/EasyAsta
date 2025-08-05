-- CreateEnum
CREATE TYPE "public"."PlayerActionType" AS ENUM ('PLAYER_SELECT', 'JOIN_LEAGUE', 'CREATE_TEAM', 'LEAVE_LEAGUE');

-- CreateTable
CREATE TABLE "public"."PlayerAction" (
    "id" TEXT NOT NULL,
    "leagueId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "action" "public"."PlayerActionType" NOT NULL,
    "targetTeamId" TEXT,
    "targetPlayerId" TEXT,
    "roundId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlayerAction_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "public"."PlayerAction" ADD CONSTRAINT "PlayerAction_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "public"."League"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PlayerAction" ADD CONSTRAINT "PlayerAction_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PlayerAction" ADD CONSTRAINT "PlayerAction_targetTeamId_fkey" FOREIGN KEY ("targetTeamId") REFERENCES "public"."Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PlayerAction" ADD CONSTRAINT "PlayerAction_targetPlayerId_fkey" FOREIGN KEY ("targetPlayerId") REFERENCES "public"."Player"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PlayerAction" ADD CONSTRAINT "PlayerAction_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "public"."AuctionRound"("id") ON DELETE SET NULL ON UPDATE CASCADE;
