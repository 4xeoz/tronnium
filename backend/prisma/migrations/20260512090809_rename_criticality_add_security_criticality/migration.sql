--
-- Migration: Rename criticality → operationalCriticality and add securityCriticality
--

-- 1. Rename the existing operational impact column
ALTER TABLE "Relationship" RENAME COLUMN "criticality" TO "operationalCriticality";

-- 2. Add the new attacker-value column
ALTER TABLE "Relationship" ADD COLUMN "securityCriticality" "RelationshipCriticality" NOT NULL DEFAULT 'LOW';
