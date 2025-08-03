-- CreateEnum
CREATE TYPE "public"."BotIntelligence" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- AlterTable
ALTER TABLE "public"."User" ADD COLUMN     "isBot" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "public"."BotConfig" (
    "id" TEXT NOT NULL,
    "leagueId" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT false,
    "selectionDelayMin" INTEGER NOT NULL DEFAULT 2,
    "selectionDelayMax" INTEGER NOT NULL DEFAULT 8,
    "intelligence" "public"."BotIntelligence" NOT NULL DEFAULT 'MEDIUM',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BotConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BotConfig_leagueId_key" ON "public"."BotConfig"("leagueId");

-- AddForeignKey
ALTER TABLE "public"."BotConfig" ADD CONSTRAINT "BotConfig_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "public"."League"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
