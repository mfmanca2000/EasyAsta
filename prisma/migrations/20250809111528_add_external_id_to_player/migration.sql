/*
  Warnings:

  - A unique constraint covering the columns `[joinCode]` on the table `League` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `joinCode` to the `League` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "public"."League" ADD COLUMN     "joinCode" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "public"."Player" ADD COLUMN     "externalId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "League_joinCode_key" ON "public"."League"("joinCode");
