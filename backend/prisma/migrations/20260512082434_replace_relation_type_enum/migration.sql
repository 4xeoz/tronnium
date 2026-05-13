--
-- Migration: Replace RelationType enum with security-oriented labels
-- Old values: DEPENDS_ON, CONTROLS, PROVIDES_SERVICE, SHARES_DATA_WITH
-- New values: NETWORK_CONNECTS_TO, MANAGED_BY, AUTHENTICATES_VIA, EXECUTES_CODE_FROM, RECEIVES_DATA_FROM, SHARES_CREDENTIALS_WITH
--

-- 1. Rename the old enum so we can create the new one with the same name
ALTER TYPE "RelationType" RENAME TO "RelationType_old";

-- 2. Create the new enum with security-oriented values
CREATE TYPE "RelationType" AS ENUM (
  'NETWORK_CONNECTS_TO',
  'MANAGED_BY',
  'AUTHENTICATES_VIA',
  'EXECUTES_CODE_FROM',
  'RECEIVES_DATA_FROM',
  'SHARES_CREDENTIALS_WITH'
);

-- 3. Convert the column to text so we can map old values to new ones
ALTER TABLE "Relationship" ALTER COLUMN "type" TYPE TEXT USING "type"::TEXT;

-- 4. Map old enum values to their closest new equivalents
UPDATE "Relationship"
SET "type" = CASE "type"
  WHEN 'DEPENDS_ON' THEN 'NETWORK_CONNECTS_TO'
  WHEN 'CONTROLS' THEN 'MANAGED_BY'
  WHEN 'PROVIDES_SERVICE' THEN 'AUTHENTICATES_VIA'
  WHEN 'SHARES_DATA_WITH' THEN 'SHARES_CREDENTIALS_WITH'
END;

-- 5. Convert the column back to the new enum type
ALTER TABLE "Relationship" ALTER COLUMN "type" TYPE "RelationType" USING "type"::"RelationType";

-- 6. Clean up the old enum type
DROP TYPE "RelationType_old";
