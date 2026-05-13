import { afterAll, beforeAll, describe, it, expect } from "@jest/globals";

jest.mock("@xenova/transformers", () => ({
    pipeline: jest.fn(),
}));

import request from "supertest";
import { createApp } from "../../../app";
import prisma from "../../../lib/prisma";
import { seedTestUser, clearTestData } from "../../../test/helper";

const app = createApp();

const VALID_CPE = {
    cpeName: "cpe:2.3:a:openssl:openssl:1.1.1:*:*:*:*:*:*:*",
    cpeNameId: "test-cpe-id",
    title: "OpenSSL 1.1.1",
    score: 90,
    vendor: "openssl",
    product: "openssl",
    version: "1.1.1",
    breakdown: { vendor: 95, product: 95, version: 80, tokenOverlap: 85 },
};

describe("Asset Relationships API", () => {
    let userId: string;
    let token: string;
    let envId: string;
    let assetAId: string;
    let assetBId: string;
    let relationshipId: string;

    const NONEXISTENT_UUID = "00000000-0000-0000-0000-000000000000";

    beforeAll(async () => {
        const user = await seedTestUser();
        userId = user.user.id;
        token = user.token;

        const envRes = await request(app)
            .post("/environments")
            .set("Authorization", `Bearer ${token}`)
            .send({ name: "Relationship Test Environment" });
        envId = envRes.body.data.id;

        const assetA = await request(app)
            .post(`/assets/${envId}`)
            .set("Authorization", `Bearer ${token}`)
            .send({ name: "Asset A", cpes: [VALID_CPE] });
        assetAId = assetA.body.data.id;

        const assetB = await request(app)
            .post(`/assets/${envId}`)
            .set("Authorization", `Bearer ${token}`)
            .send({ name: "Asset B", cpes: [VALID_CPE] });
        assetBId = assetB.body.data.id;
    });

    afterAll(async () => {
        await clearTestData(userId);
    });

    // -------------------------------------------------------------------------
    // POST /relationships/:environmentId — create relationship
    // -------------------------------------------------------------------------

    describe("POST /relationships/:environmentId", () => {
        it("201 creates a relationship between two assets", async () => {
            const res = await request(app)
                .post(`/relationships/${envId}`)
                .set("Authorization", `Bearer ${token}`)
                .send({ fromAssetId: assetAId, toAssetId: assetBId, type: "NETWORK_CONNECTS_TO", operationalCriticality: "HIGH", securityCriticality: "CRITICAL" });

            expect(res.status).toBe(201);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toHaveProperty("id");
            expect(res.body.data.fromAssetId).toBe(assetAId);
            expect(res.body.data.toAssetId).toBe(assetBId);

            relationshipId = res.body.data.id;
        });

        it("400 when fromAssetId is missing", async () => {
            const res = await request(app)
                .post(`/relationships/${envId}`)
                .set("Authorization", `Bearer ${token}`)
                .send({ toAssetId: assetBId, type: "NETWORK_CONNECTS_TO", operationalCriticality: "HIGH", securityCriticality: "MEDIUM" });

            expect(res.status).toBe(400);
        });

        it("400 when source and target are the same asset", async () => {
            const res = await request(app)
                .post(`/relationships/${envId}`)
                .set("Authorization", `Bearer ${token}`)
                .send({ fromAssetId: assetAId, toAssetId: assetAId, type: "NETWORK_CONNECTS_TO", operationalCriticality: "HIGH", securityCriticality: "MEDIUM" });

            expect(res.status).toBe(400);
        });

        it("404 when environmentId doesn't belong to the user", async () => {
            const res = await request(app)
                .post(`/relationships/${NONEXISTENT_UUID}`)
                .set("Authorization", `Bearer ${token}`)
                .send({ fromAssetId: assetAId, toAssetId: assetBId, type: "NETWORK_CONNECTS_TO", operationalCriticality: "HIGH", securityCriticality: "CRITICAL" });

            expect(res.status).toBe(404);
        });

        it("401 when not authenticated", async () => {
            const res = await request(app)
                .post(`/relationships/${envId}`)
                .send({ fromAssetId: assetAId, toAssetId: assetBId, type: "NETWORK_CONNECTS_TO", operationalCriticality: "HIGH", securityCriticality: "CRITICAL" });

            expect(res.status).toBe(401);
        });
    });

    // -------------------------------------------------------------------------
    // GET /relationships/:environmentId — list relationships
    // -------------------------------------------------------------------------

    describe("GET /relationships/:environmentId", () => {
        it("200 returns all relationships for the environment", async () => {
            const res = await request(app)
                .get(`/relationships/${envId}`)
                .set("Authorization", `Bearer ${token}`);

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(Array.isArray(res.body.data)).toBe(true);
            expect(res.body.data.length).toBeGreaterThanOrEqual(1);
        });

        it("200 returns empty array when no relationships exist for a fresh environment", async () => {
            const freshEnvRes = await request(app)
                .post("/environments")
                .set("Authorization", `Bearer ${token}`)
                .send({ name: "Fresh Environment No Relationships" });
            const freshEnvId = freshEnvRes.body.data.id;

            const res = await request(app)
                .get(`/relationships/${freshEnvId}`)
                .set("Authorization", `Bearer ${token}`);

            expect(res.status).toBe(200);
            expect(res.body.data).toEqual([]);
        });

        it("404 when environmentId doesn't belong to the user", async () => {
            const res = await request(app)
                .get(`/relationships/${NONEXISTENT_UUID}`)
                .set("Authorization", `Bearer ${token}`);

            expect(res.status).toBe(404);
        });

        it("401 when not authenticated", async () => {
            const res = await request(app).get(`/relationships/${envId}`);
            expect(res.status).toBe(401);
        });
    });

    // -------------------------------------------------------------------------
    // PATCH /relationships/:environmentId/:relationshipId — update relationship
    // -------------------------------------------------------------------------

    describe("PATCH /relationships/:environmentId/:relationshipId", () => {
        it("200 updates the relationship type", async () => {
            const res = await request(app)
                .patch(`/relationships/${envId}/${relationshipId}`)
                .set("Authorization", `Bearer ${token}`)
                .send({ type: "MANAGED_BY", securityCriticality: "HIGH" });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.type).toBe("MANAGED_BY");
        });

        it("404 when relationshipId doesn't exist", async () => {
            const res = await request(app)
                .patch(`/relationships/${envId}/${NONEXISTENT_UUID}`)
                .set("Authorization", `Bearer ${token}`)
                .send({ type: "MANAGED_BY", securityCriticality: "HIGH" });

            expect(res.status).toBe(404);
        });

        it("401 when not authenticated", async () => {
            const res = await request(app)
                .patch(`/relationships/${envId}/${relationshipId}`)
                .send({ type: "MANAGED_BY", securityCriticality: "HIGH" });

            expect(res.status).toBe(401);
        });
    });

    // -------------------------------------------------------------------------
    // DELETE /relationships/:environmentId/:relationshipId — delete relationship
    // -------------------------------------------------------------------------

    describe("DELETE /relationships/:environmentId/:relationshipId", () => {
        it("200 deletes the relationship successfully", async () => {
            // Create a throwaway relationship to delete
            const createRes = await request(app)
                .post(`/relationships/${envId}`)
                .set("Authorization", `Bearer ${token}`)
                .send({ fromAssetId: assetBId, toAssetId: assetAId, type: "AUTHENTICATES_VIA", operationalCriticality: "LOW", securityCriticality: "LOW" });

            const throwawayId = createRes.body.data.id;

            const res = await request(app)
                .delete(`/relationships/${envId}/${throwawayId}`)
                .set("Authorization", `Bearer ${token}`);

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
        });

        it("404 when relationshipId doesn't exist", async () => {
            const res = await request(app)
                .delete(`/relationships/${envId}/${NONEXISTENT_UUID}`)
                .set("Authorization", `Bearer ${token}`);

            expect(res.status).toBe(404);
        });

        it("401 when not authenticated", async () => {
            const res = await request(app)
                .delete(`/relationships/${envId}/${relationshipId}`);

            expect(res.status).toBe(401);
        });
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Blast Radius & Entry Points API
// ═══════════════════════════════════════════════════════════════════════════════

describe("Blast Radius & Entry Points API", () => {
    let userId: string;
    let token: string;
    let brEnvId: string;
    let e1Id: string;
    let e2Id: string;
    let aId: string;
    let bId: string;
    let tId: string;
    let uId: string;

    beforeAll(async () => {
        const user = await seedTestUser();
        userId = user.user.id;
        token = user.token;

        const envRes = await request(app)
            .post("/environments")
            .set("Authorization", `Bearer ${token}`)
            .send({ name: "Blast Radius Test Environment" });
        brEnvId = envRes.body.data.id;

        // Create assets
        const mkAsset = async (name: string, isExt: boolean) => {
            const res = await request(app)
                .post(`/assets/${brEnvId}`)
                .set("Authorization", `Bearer ${token}`)
                .send({ name, isExternallyFacing: isExt, cpes: [VALID_CPE] });
            return res.body.data.id;
        };

        e1Id = await mkAsset("E1 External Gateway", true);
        e2Id = await mkAsset("E2 External API", true);
        aId = await mkAsset("A Internal Server", false);
        bId = await mkAsset("B Internal DB", false);
        tId = await mkAsset("T Target Asset", false);
        uId = await mkAsset("U Unreachable", false);

        // Create relationships
        await request(app)
            .post(`/relationships/${brEnvId}`)
            .set("Authorization", `Bearer ${token}`)
            .send({
                fromAssetId: e1Id, toAssetId: aId,
                type: "NETWORK_CONNECTS_TO",
                operationalCriticality: "HIGH", securityCriticality: "HIGH",
            });
        await request(app)
            .post(`/relationships/${brEnvId}`)
            .set("Authorization", `Bearer ${token}`)
            .send({
                fromAssetId: aId, toAssetId: tId,
                type: "MANAGED_BY",
                operationalCriticality: "HIGH", securityCriticality: "CRITICAL",
            });
        await request(app)
            .post(`/relationships/${brEnvId}`)
            .set("Authorization", `Bearer ${token}`)
            .send({
                fromAssetId: e2Id, toAssetId: bId,
                type: "NETWORK_CONNECTS_TO",
                operationalCriticality: "MEDIUM", securityCriticality: "MEDIUM",
            });
        await request(app)
            .post(`/relationships/${brEnvId}`)
            .set("Authorization", `Bearer ${token}`)
            .send({
                fromAssetId: bId, toAssetId: tId,
                type: "MANAGED_BY",
                operationalCriticality: "LOW", securityCriticality: "LOW",
            });

        // Seed vulnerabilities
        const vHigh = await prisma.vulnerability.upsert({
            where: { cveId: "CVE-BR-HIGH-001" },
            update: {},
            create: {
                cveId: "CVE-BR-HIGH-001",
                description: "High EPSS RCE",
                cvssScore: 9.8,
                cvssVector: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H",
                epssPercentile: 0.85,
            },
        });
        const vLow = await prisma.vulnerability.upsert({
            where: { cveId: "CVE-BR-LOW-001" },
            update: {},
            create: {
                cveId: "CVE-BR-LOW-001",
                description: "Low EPSS RCE",
                cvssScore: 7.0,
                cvssVector: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H",
                epssPercentile: 0.30,
            },
        });

        // Seed workflows (OPEN)
        await prisma.vulnerabilityWorkflow.create({
            data: {
                environmentId: brEnvId,
                assetId: e1Id,
                vulnerabilityId: vHigh.id,
                cpeName: "cpe:2.3:a:test:high:1.0",
                status: "OPEN",
            },
        });
        await prisma.vulnerabilityWorkflow.create({
            data: {
                environmentId: brEnvId,
                assetId: e2Id,
                vulnerabilityId: vLow.id,
                cpeName: "cpe:2.3:a:test:low:1.0",
                status: "OPEN",
            },
        });

        // A and B also need network-pivot vulns so they can open gates
        await prisma.vulnerabilityWorkflow.create({
            data: {
                environmentId: brEnvId,
                assetId: aId,
                vulnerabilityId: vHigh.id,
                cpeName: "cpe:2.3:a:test:a:1.0",
                status: "OPEN",
            },
        });
        await prisma.vulnerabilityWorkflow.create({
            data: {
                environmentId: brEnvId,
                assetId: bId,
                vulnerabilityId: vLow.id,
                cpeName: "cpe:2.3:a:test:b:1.0",
                status: "OPEN",
            },
        });
    });

    afterAll(async () => {
        await clearTestData(userId);
    });

    // ── Entry Points ─────────────────────────────────────────────────────────

    describe("GET /relationships/:environmentId/entry-points", () => {
        it("200 returns entry points sorted by descending base compromise score", async () => {
            const res = await request(app)
                .get(`/relationships/${brEnvId}/entry-points`)
                .set("Authorization", `Bearer ${token}`);

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(Array.isArray(res.body.data)).toBe(true);
            expect(res.body.data.length).toBe(2);

            // E1 should have higher score than E2
            const first = res.body.data[0];
            const second = res.body.data[1];
            expect(first.baseCompromiseScore).toBeGreaterThan(second.baseCompromiseScore);
            expect(first.name).toBe("E1 External Gateway");
            expect(second.name).toBe("E2 External API");
        });

        it("drops asset when isExternallyFacing becomes false", async () => {
            // Toggle E2 to internal via Prisma (bypass any API quirks)
            await prisma.asset.update({
                where: { id: e2Id },
                data: { isExternallyFacing: false },
            });

            const res = await request(app)
                .get(`/relationships/${brEnvId}/entry-points`)
                .set("Authorization", `Bearer ${token}`);

            expect(res.body.data.length).toBe(1);
            expect(res.body.data[0].id).toBe(e1Id);

            // Restore for other tests
            await prisma.asset.update({
                where: { id: e2Id },
                data: { isExternallyFacing: true },
            });
        });

        it("401 when not authenticated", async () => {
            const res = await request(app)
                .get(`/relationships/${brEnvId}/entry-points`);
            expect(res.status).toBe(401);
        });
    });

    // ── Environment Blast Radius ─────────────────────────────────────────────

    describe("GET /relationships/:environmentId/blast-radius", () => {
        it("200 returns aggregated risk map sorted by compromise score", async () => {
            const res = await request(app)
                .get(`/relationships/${brEnvId}/blast-radius`)
                .set("Authorization", `Bearer ${token}`);

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toHaveProperty("assetRisks");
            expect(res.body.data).toHaveProperty("entryPoints");
            expect(res.body.data).toHaveProperty("runs");
            expect(Array.isArray(res.body.data.assetRisks)).toBe(true);
            expect(res.body.data.entryPoints.length).toBe(2);
            expect(res.body.data.runs).toBe(2);

            // Find T in the results
            const tRisk = res.body.data.assetRisks.find(
                (r: any) => r.assetId === tId
            );
            expect(tRisk).toBeDefined();
            expect(tRisk.reachableFromEntryPoints.length).toBe(2);

            // T's max compromise should come from E1's path (higher)
            // E1: 9.8*(1+0.85)=18.13 → 90.65 → A: 90.65*0.85=77.05 → T: 77.05*0.95=73.20
            expect(tRisk.maxCompromiseScore).toBeGreaterThan(70);

            // U should have score 0
            const uRisk = res.body.data.assetRisks.find(
                (r: any) => r.assetId === uId
            );
            expect(uRisk).toBeDefined();
            expect(uRisk.maxCompromiseScore).toBe(0);
            expect(uRisk.maxKnowledgeScore).toBe(0);

            // Verify descending sort
            const scores = res.body.data.assetRisks.map((r: any) => r.maxCompromiseScore);
            for (let i = 1; i < scores.length; i++) {
                expect(scores[i - 1]).toBeGreaterThanOrEqual(scores[i]);
            }
        });

        it("respects costBudget query param", async () => {
            const res = await request(app)
                .get(`/relationships/${brEnvId}/blast-radius?costBudget=2`)
                .set("Authorization", `Bearer ${token}`);

            expect(res.status).toBe(200);
            // With budget=2, only direct neighbors from entry points are reached
            const tRisk = res.body.data.assetRisks.find(
                (r: any) => r.assetId === tId
            );
            // T is 2 hops away, so it should be unreachable with budget=2
            expect(tRisk.maxCompromiseScore).toBe(0);
        });

        it("401 when not authenticated", async () => {
            const res = await request(app)
                .get(`/relationships/${brEnvId}/blast-radius`);
            expect(res.status).toBe(401);
        });
    });

    // ── Single-Asset Blast Radius ────────────────────────────────────────────

    describe("GET /relationships/:environmentId/blast-radius/:assetId", () => {
        it("200 returns reachable assets from specified source", async () => {
            const res = await request(app)
                .get(`/relationships/${brEnvId}/blast-radius/${e1Id}`)
                .set("Authorization", `Bearer ${token}`);

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.sourceAssetId).toBe(e1Id);
            expect(Array.isArray(res.body.data.reached)).toBe(true);

            const reachedIds = res.body.data.reached.map((r: any) => r.assetId);
            expect(reachedIds).toContain(e1Id);
            expect(reachedIds).toContain(aId);
            expect(reachedIds).toContain(tId);
            expect(reachedIds).not.toContain(uId);
        });

        it("200 returns empty reached for isolated asset", async () => {
            const res = await request(app)
                .get(`/relationships/${brEnvId}/blast-radius/${uId}`)
                .set("Authorization", `Bearer ${token}`);

            expect(res.status).toBe(200);
            expect(res.body.data.reached.length).toBe(1); // only the source itself
            expect(res.body.data.reached[0].assetId).toBe(uId);
        });

        it("404 when environment doesn't belong to user", async () => {
            const res = await request(app)
                .get(`/relationships/00000000-0000-0000-0000-000000000000/blast-radius/${e1Id}`)
                .set("Authorization", `Bearer ${token}`);

            expect(res.status).toBe(404);
        });

        it("401 when not authenticated", async () => {
            const res = await request(app)
                .get(`/relationships/${brEnvId}/blast-radius/${e1Id}`);
            expect(res.status).toBe(401);
        });
    });
});
