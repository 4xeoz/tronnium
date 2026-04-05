-- AlterTable
ALTER TABLE "SecurityScan" ADD COLUMN     "isMock" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "SecurityScan_isMock_idx" ON "SecurityScan"("isMock");
