-- CreateEnum
CREATE TYPE "AssetDomain" AS ENUM ('IT', 'OT', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "RelationType" AS ENUM ('DEPENDS_ON', 'CONTROLS', 'PROVIDES_SERVICE', 'SHARES_DATA_WITH');

-- CreateEnum
CREATE TYPE "AssetType" AS ENUM ('SERVER', 'DATABASE', 'NETWORK', 'FIREWALL', 'IOT', 'ROUTER', 'SWITCH', 'STORAGE', 'LOAD_BALANCER', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "AssetStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'MAINTENANCE', 'DECOMMISSIONED', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "RelationshipCriticality" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "ScanStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "VulnSeverity" AS ENUM ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'NONE', 'UNKNOWN');

-- CreateTable
CREATE TABLE "UserAccount" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "displayName" TEXT,
    "avatarUrl" TEXT,
    "role" TEXT NOT NULL DEFAULT 'user',
    "devMode" BOOLEAN NOT NULL DEFAULT false,
    "googleSubjectId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Environment" (
    "id" UUID NOT NULL,
    "ownerId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "labels" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Environment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Asset" (
    "id" UUID NOT NULL,
    "environmentId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL DEFAULT 'unknown',
    "domain" "AssetDomain" NOT NULL DEFAULT 'UNKNOWN',
    "x" DOUBLE PRECISION,
    "y" DOUBLE PRECISION,
    "status" TEXT,
    "location" TEXT,
    "ipAddress" TEXT,
    "manufacturer" TEXT,
    "model" TEXT,
    "serialNumber" TEXT,
    "cpes" JSONB NOT NULL DEFAULT '[]',
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Relationship" (
    "id" UUID NOT NULL,
    "environmentId" UUID NOT NULL,
    "fromAssetId" UUID NOT NULL,
    "toAssetId" UUID NOT NULL,
    "type" "RelationType" NOT NULL,
    "criticality" "RelationshipCriticality" NOT NULL DEFAULT 'MEDIUM',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Relationship_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SecurityScan" (
    "id" UUID NOT NULL,
    "environmentId" UUID NOT NULL,
    "status" "ScanStatus" NOT NULL DEFAULT 'PENDING',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "totalAssets" INTEGER NOT NULL DEFAULT 0,
    "scannedAssets" INTEGER NOT NULL DEFAULT 0,
    "vulnerabilitiesFound" INTEGER NOT NULL DEFAULT 0,
    "criticalCount" INTEGER NOT NULL DEFAULT 0,
    "highCount" INTEGER NOT NULL DEFAULT 0,
    "mediumCount" INTEGER NOT NULL DEFAULT 0,
    "lowCount" INTEGER NOT NULL DEFAULT 0,
    "riskScore" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SecurityScan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssetScan" (
    "id" UUID NOT NULL,
    "scanId" UUID NOT NULL,
    "assetId" UUID NOT NULL,
    "scannedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssetScan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vulnerability" (
    "id" UUID NOT NULL,
    "cveId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "cvssScore" DOUBLE PRECISION,
    "cvssVector" TEXT,
    "severity" "VulnSeverity" NOT NULL DEFAULT 'UNKNOWN',
    "publishedDate" TIMESTAMP(3),
    "lastModifiedDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vulnerability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssetVulnerability" (
    "id" UUID NOT NULL,
    "assetScanId" UUID NOT NULL,
    "vulnerabilityId" UUID NOT NULL,
    "cpeName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssetVulnerability_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserAccount_email_key" ON "UserAccount"("email");

-- CreateIndex
CREATE UNIQUE INDEX "UserAccount_googleSubjectId_key" ON "UserAccount"("googleSubjectId");

-- CreateIndex
CREATE INDEX "UserAccount_createdAt_idx" ON "UserAccount"("createdAt");

-- CreateIndex
CREATE INDEX "Environment_ownerId_idx" ON "Environment"("ownerId");

-- CreateIndex
CREATE INDEX "Asset_environmentId_idx" ON "Asset"("environmentId");

-- CreateIndex
CREATE INDEX "Asset_domain_idx" ON "Asset"("domain");

-- CreateIndex
CREATE INDEX "Asset_type_idx" ON "Asset"("type");

-- CreateIndex
CREATE INDEX "Asset_status_idx" ON "Asset"("status");

-- CreateIndex
CREATE INDEX "Relationship_environmentId_idx" ON "Relationship"("environmentId");

-- CreateIndex
CREATE INDEX "Relationship_fromAssetId_idx" ON "Relationship"("fromAssetId");

-- CreateIndex
CREATE INDEX "Relationship_toAssetId_idx" ON "Relationship"("toAssetId");

-- CreateIndex
CREATE INDEX "Relationship_fromAssetId_environmentId_idx" ON "Relationship"("fromAssetId", "environmentId");

-- CreateIndex
CREATE INDEX "Relationship_toAssetId_environmentId_idx" ON "Relationship"("toAssetId", "environmentId");

-- CreateIndex
CREATE UNIQUE INDEX "Relationship_fromAssetId_toAssetId_type_key" ON "Relationship"("fromAssetId", "toAssetId", "type");

-- CreateIndex
CREATE INDEX "SecurityScan_environmentId_idx" ON "SecurityScan"("environmentId");

-- CreateIndex
CREATE INDEX "AssetScan_scanId_idx" ON "AssetScan"("scanId");

-- CreateIndex
CREATE INDEX "AssetScan_assetId_idx" ON "AssetScan"("assetId");

-- CreateIndex
CREATE UNIQUE INDEX "AssetScan_scanId_assetId_key" ON "AssetScan"("scanId", "assetId");

-- CreateIndex
CREATE UNIQUE INDEX "Vulnerability_cveId_key" ON "Vulnerability"("cveId");

-- CreateIndex
CREATE INDEX "Vulnerability_cveId_idx" ON "Vulnerability"("cveId");

-- CreateIndex
CREATE INDEX "Vulnerability_severity_idx" ON "Vulnerability"("severity");

-- CreateIndex
CREATE INDEX "AssetVulnerability_assetScanId_idx" ON "AssetVulnerability"("assetScanId");

-- CreateIndex
CREATE INDEX "AssetVulnerability_vulnerabilityId_idx" ON "AssetVulnerability"("vulnerabilityId");

-- CreateIndex
CREATE UNIQUE INDEX "AssetVulnerability_assetScanId_vulnerabilityId_key" ON "AssetVulnerability"("assetScanId", "vulnerabilityId");

-- AddForeignKey
ALTER TABLE "Environment" ADD CONSTRAINT "Environment_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "UserAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_environmentId_fkey" FOREIGN KEY ("environmentId") REFERENCES "Environment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Relationship" ADD CONSTRAINT "Relationship_environmentId_fkey" FOREIGN KEY ("environmentId") REFERENCES "Environment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Relationship" ADD CONSTRAINT "Relationship_fromAssetId_fkey" FOREIGN KEY ("fromAssetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Relationship" ADD CONSTRAINT "Relationship_toAssetId_fkey" FOREIGN KEY ("toAssetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecurityScan" ADD CONSTRAINT "SecurityScan_environmentId_fkey" FOREIGN KEY ("environmentId") REFERENCES "Environment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetScan" ADD CONSTRAINT "AssetScan_scanId_fkey" FOREIGN KEY ("scanId") REFERENCES "SecurityScan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetScan" ADD CONSTRAINT "AssetScan_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetVulnerability" ADD CONSTRAINT "AssetVulnerability_assetScanId_fkey" FOREIGN KEY ("assetScanId") REFERENCES "AssetScan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetVulnerability" ADD CONSTRAINT "AssetVulnerability_vulnerabilityId_fkey" FOREIGN KEY ("vulnerabilityId") REFERENCES "Vulnerability"("id") ON DELETE CASCADE ON UPDATE CASCADE;
