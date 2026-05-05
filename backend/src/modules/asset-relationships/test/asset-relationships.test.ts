import request from "supertest";
import { createApp } from "../../../app";
import { seedTestUser, clearTestData } from "../../../test/helper";
import { afterAll, beforeAll, describe, it, expect } from "@jest/globals";

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
                .send({ fromAssetId: assetAId, toAssetId: assetBId, type: "DEPENDS_ON", criticality: "HIGH" });

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
                .send({ toAssetId: assetBId, type: "DEPENDS_ON", criticality: "HIGH" });

            expect(res.status).toBe(400);
        });

        it("400 when source and target are the same asset", async () => {
            const res = await request(app)
                .post(`/relationships/${envId}`)
                .set("Authorization", `Bearer ${token}`)
                .send({ fromAssetId: assetAId, toAssetId: assetAId, type: "DEPENDS_ON", criticality: "HIGH" });

            expect(res.status).toBe(400);
        });

        it("404 when environmentId doesn't belong to the user", async () => {
            const res = await request(app)
                .post(`/relationships/${NONEXISTENT_UUID}`)
                .set("Authorization", `Bearer ${token}`)
                .send({ fromAssetId: assetAId, toAssetId: assetBId, type: "DEPENDS_ON", criticality: "HIGH" });

            expect(res.status).toBe(404);
        });

        it("401 when not authenticated", async () => {
            const res = await request(app)
                .post(`/relationships/${envId}`)
                .send({ fromAssetId: assetAId, toAssetId: assetBId, type: "DEPENDS_ON", criticality: "HIGH" });

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
                .send({ type: "CONTROLS" });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.type).toBe("CONTROLS");
        });

        it("404 when relationshipId doesn't exist", async () => {
            const res = await request(app)
                .patch(`/relationships/${envId}/${NONEXISTENT_UUID}`)
                .set("Authorization", `Bearer ${token}`)
                .send({ type: "CONTROLS" });

            expect(res.status).toBe(404);
        });

        it("401 when not authenticated", async () => {
            const res = await request(app)
                .patch(`/relationships/${envId}/${relationshipId}`)
                .send({ type: "CONTROLS" });

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
                .send({ fromAssetId: assetBId, toAssetId: assetAId, type: "PROVIDES_SERVICE", criticality: "LOW" });

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
