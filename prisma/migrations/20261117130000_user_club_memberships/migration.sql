-- CreateTable
CREATE TABLE "UserClub" (
    "userId" UUID NOT NULL,
    "clubId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserClub_pkey" PRIMARY KEY ("userId","clubId")
);

-- Preserve existing single-club memberships
INSERT INTO "UserClub" ("userId", "clubId")
SELECT "id", "clubId" FROM "User" WHERE "clubId" IS NOT NULL;

-- AlterTable
ALTER TABLE "User" DROP COLUMN "clubId";

-- CreateIndex
CREATE INDEX "UserClub_clubId_idx" ON "UserClub"("clubId");

-- AddForeignKey
ALTER TABLE "UserClub" ADD CONSTRAINT "UserClub_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserClub" ADD CONSTRAINT "UserClub_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;
