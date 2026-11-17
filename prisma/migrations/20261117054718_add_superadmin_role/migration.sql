-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'SUPERADMIN';

-- AlterTable
ALTER TABLE "Tournament" ADD COLUMN     "managerId" UUID;

-- CreateIndex
CREATE INDEX "Tournament_managerId_idx" ON "Tournament"("managerId");

-- AddForeignKey
ALTER TABLE "Tournament" ADD CONSTRAINT "Tournament_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
