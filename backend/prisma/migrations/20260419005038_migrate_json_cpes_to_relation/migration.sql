-- CreateTable
CREATE TABLE "AssetCpe" (
    "id" UUID NOT NULL,
    "assetId" UUID NOT NULL,
    "cpeName" TEXT NOT NULL,
    "cpeNameId" TEXT,
    "title" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "vendor" TEXT,
    "product" TEXT,
    "version" TEXT,
    "vendorScore" DOUBLE PRECISION,
    "productScore" DOUBLE PRECISION,
    "versionScore" DOUBLE PRECISION,
    "tokenOverlapScore" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssetCpe_pkey" PRIMARY KEY ("id")
);

-- Migrate existing JSON cpes data into AssetCpe relation rows
INSERT INTO "AssetCpe" (
    "id",
    "assetId",
    "cpeName",
    "cpeNameId",
    "title",
    "score",
    "vendor",
    "product",
    "version",
    "vendorScore",
    "productScore",
    "versionScore",
    "tokenOverlapScore",
    "createdAt",
    "updatedAt"
)
SELECT
    gen_random_uuid(),
    a."id",
    elem->>'cpeName',
    elem->>'cpeNameId',
    elem->>'title',
    (elem->>'score')::double precision,
    elem->>'vendor',
    elem->>'product',
    elem->>'version',
    (elem->'breakdown'->>'vendor')::double precision,
    (elem->'breakdown'->>'product')::double precision,
    (elem->'breakdown'->>'version')::double precision,
    (elem->'breakdown'->>'tokenOverlap')::double precision,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "Asset" a,
LATERAL jsonb_array_elements(a.cpes) elem
WHERE a.cpes != '[]'::jsonb;

-- AlterTable
ALTER TABLE "Asset" DROP COLUMN "cpes";

-- CreateIndex
CREATE INDEX "AssetCpe_assetId_idx" ON "AssetCpe"("assetId");

-- CreateIndex
CREATE INDEX "AssetCpe_cpeName_idx" ON "AssetCpe"("cpeName");

-- CreateIndex
CREATE UNIQUE INDEX "AssetCpe_assetId_cpeName_key" ON "AssetCpe"("assetId", "cpeName");

-- AddForeignKey
ALTER TABLE "AssetCpe" ADD CONSTRAINT "AssetCpe_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
