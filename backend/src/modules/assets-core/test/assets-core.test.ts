import request from "supertest";
import { createApp } from "../../../app";
import { seedTestUser, clearTestData } from "../../../test/helper";
import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";

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

describe("Assets Core API", () => {
    let userId: string;
    let token: string;
    let envId: string;
    let assetId: string;

    const NONEXISTENT_UUID = "00000000-0000-0000-0000-000000000000";

    beforeAll(async () => {
        const user = await seedTestUser();
        userId = user.user.id;
        token = user.token;

        const envRes = await request(app)
            .post("/environments")
            .set("Authorization", `Bearer ${token}`)
            .send({ name: "Asset Test Environment" });
        envId = envRes.body.data.id;

        // Create a shared asset for PUT / DELETE / vulnerabilities tests
        const assetRes = await request(app)
            .post(`/assets/${envId}`)
            .set("Authorization", `Bearer ${token}`)
            .send({ name: "Shared Test Asset", cpes: [VALID_CPE] });
        assetId = assetRes.body.data.id;
    });

    afterAll(async () => {
        await clearTestData(userId);
    });

    // -------------------------------------------------------------------------
    // POST /assets/:environmentId — create asset
    // -------------------------------------------------------------------------

    describe("POST /assets/:environmentId", () => {
        it("201 with name and one CPE", async () => {
            const res = await request(app)
                .post(`/assets/${envId}`)
                .set("Authorization", `Bearer ${token}`)
                .send({ name: "My Server", cpes: [VALID_CPE] });

            expect(res.status).toBe(201);
            expect(res.body.data).toMatchObject({ name: "My Server" });
            expect(res.body.data.id).toBeDefined();
            expect(res.body.data.cpes).toHaveLength(1);
        });

        it("201 with all optional fields and a CPE", async () => {
            const res = await request(app)
                .post(`/assets/${envId}`)
                .set("Authorization", `Bearer ${token}`)
                .send({
                    name: "Full Asset",
                    type: "server",
                    domain: "IT",
                    status: "active",
                    location: "datacenter-1",
                    ipAddress: "192.168.1.10",
                    manufacturer: "Dell",
                    model: "PowerEdge R740",
                    serialNumber: "SN-12345",
                    cpes: [VALID_CPE],
                });

            expect(res.status).toBe(201);
            expect(res.body.data).toMatchObject({
                name: "Full Asset",
                type: "server",
                location: "datacenter-1",
                ipAddress: "192.168.1.10",
                manufacturer: "Dell",
                model: "PowerEdge R740",
                serialNumber: "SN-12345",
            });
        });

        it("201 with multiple CPEs — all stored and returned", async () => {
            const secondCpe = {
                ...VALID_CPE,
                cpeName: "cpe:2.3:a:vendor:product:2.0:*:*:*:*:*:*:*",
                cpeNameId: "second-cpe-id",
            };

            const res = await request(app)
                .post(`/assets/${envId}`)
                .set("Authorization", `Bearer ${token}`)
                .send({ name: "Multi CPE Asset", cpes: [VALID_CPE, secondCpe] });

            expect(res.status).toBe(201);
            expect(res.body.data.cpes).toHaveLength(2);
        });

        it("400 when name is missing", async () => {
            const res = await request(app)
                .post(`/assets/${envId}`)
                .set("Authorization", `Bearer ${token}`)
                .send({ cpes: [VALID_CPE] });

            expect(res.status).toBe(400);
        });

        it("400 when name is empty string", async () => {
            const res = await request(app)
                .post(`/assets/${envId}`)
                .set("Authorization", `Bearer ${token}`)
                .send({ name: "", cpes: [VALID_CPE] });

            expect(res.status).toBe(400);
        });

        it("400 when name is whitespace only", async () => {
            const res = await request(app)
                .post(`/assets/${envId}`)
                .set("Authorization", `Bearer ${token}`)
                .send({ name: "   ", cpes: [VALID_CPE] });

            expect(res.status).toBe(400);
        });

        it("400 when name is not a string", async () => {
            const res = await request(app)
                .post(`/assets/${envId}`)
                .set("Authorization", `Bearer ${token}`)
                .send({ name: 12345, cpes: [VALID_CPE] });

            expect(res.status).toBe(400);
        });

        it("400 when cpes is missing", async () => {
            const res = await request(app)
                .post(`/assets/${envId}`)
                .set("Authorization", `Bearer ${token}`)
                .send({ name: "No CPE Asset" });

            expect(res.status).toBe(400);
        });

        it("400 when cpes is an empty array", async () => {
            const res = await request(app)
                .post(`/assets/${envId}`)
                .set("Authorization", `Bearer ${token}`)
                .send({ name: "Empty CPE Asset", cpes: [] });

            expect(res.status).toBe(400);
        });

        it("400 when cpes is not an array", async () => {
            const res = await request(app)
                .post(`/assets/${envId}`)
                .set("Authorization", `Bearer ${token}`)
                .send({ name: "Bad CPE Asset", cpes: "openssl" });

            expect(res.status).toBe(400);
        });

        it("404 when environmentId doesn't belong to the user", async () => {
            const res = await request(app)
                .post(`/assets/${NONEXISTENT_UUID}`)
                .set("Authorization", `Bearer ${token}`)
                .send({ name: "Ghost Asset", cpes: [VALID_CPE] });

            expect(res.status).toBe(404);
        });

        it("401 when not authenticated", async () => {
            const res = await request(app)
                .post(`/assets/${envId}`)
                .send({ name: "Unauthorized Asset", cpes: [VALID_CPE] });

            expect(res.status).toBe(401);
        });
    });

    // -------------------------------------------------------------------------
    // GET /assets/:environmentId — list assets
    // -------------------------------------------------------------------------

    describe("GET /assets/:environmentId", () => {
        it("200 returns all assets for the environment with their CPEs", async () => {
            const res = await request(app)
                .get(`/assets/${envId}`)
                .set("Authorization", `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(Array.isArray(res.body.data)).toBe(true);
            for (const asset of res.body.data) {
                expect(Array.isArray(asset.cpes)).toBe(true);
            }
        });

        it("200 returns empty array when no assets exist", async () => {
            const envRes = await request(app)
                .post("/environments")
                .set("Authorization", `Bearer ${token}`)
                .send({ name: "Empty Environment" });
            const freshEnvId = envRes.body.data.id;

            const res = await request(app)
                .get(`/assets/${freshEnvId}`)
                .set("Authorization", `Bearer ${token}`);

            expect(res.status).toBe(200);
            expect(res.body.data).toEqual([]);
        });

        it("200 does not return assets from another environment", async () => {
            const envRes = await request(app)
                .post("/environments")
                .set("Authorization", `Bearer ${token}`)
                .send({ name: "Second Environment" });
            const secondEnvId = envRes.body.data.id;

            await request(app)
                .post(`/assets/${secondEnvId}`)
                .set("Authorization", `Bearer ${token}`)
                .send({ name: "Asset In Second Env", cpes: [VALID_CPE] });

            const res = await request(app)
                .get(`/assets/${envId}`)
                .set("Authorization", `Bearer ${token}`);

            expect(res.status).toBe(200);
            const names = res.body.data.map((a: any) => a.name);
            expect(names).not.toContain("Asset In Second Env");
        });

        it("404 when environmentId doesn't belong to the user", async () => {
            const res = await request(app)
                .get(`/assets/${NONEXISTENT_UUID}`)
                .set("Authorization", `Bearer ${token}`);

            expect(res.status).toBe(404);
        });

        it("401 when not authenticated", async () => {
            const res = await request(app).get(`/assets/${envId}`);

            expect(res.status).toBe(401);
        });
    });

//     // -------------------------------------------------------------------------
//     // PUT /assets/:environmentId/:assetId — update asset
//     // -------------------------------------------------------------------------

    describe("PUT /assets/:environmentId/:assetId", () => {
        it("200 updates name and returns the new value", async () => {
            const res = await request(app)
                .put(`/assets/${envId}/${assetId}`)
                .set("Authorization", `Bearer ${token}`)
                .send({ name: "Renamed Server" });

            expect(res.status).toBe(200);
            expect(res.body.data.name).toBe("Renamed Server");
        });

        it("200 partial update — only provided fields change", async () => {
            const before = await request(app)
                .get(`/assets/${envId}`)
                .set("Authorization", `Bearer ${token}`);
            const originalName = before.body.data.find((a: any) => a.id === assetId)?.name;

            const res = await request(app)
                .put(`/assets/${envId}/${assetId}`)
                .set("Authorization", `Bearer ${token}`)
                .send({ description: "new desc" });

            expect(res.status).toBe(200);
            expect(res.body.data.description).toBe("new desc");
            expect(res.body.data.name).toBe(originalName);
        });

        it("200 updates position fields x and y", async () => {
            const res = await request(app)
                .put(`/assets/${envId}/${assetId}`)
                .set("Authorization", `Bearer ${token}`)
                .send({ x: 100, y: 200 });

            expect(res.status).toBe(200);
            expect(res.body.data.x).toBe(100);
            expect(res.body.data.y).toBe(200);
        });

        it("404 when assetId doesn't exist", async () => {
            const res = await request(app)
                .put(`/assets/${envId}/${NONEXISTENT_UUID}`)
                .set("Authorization", `Bearer ${token}`)
                .send({ name: "Ghost" });

            expect(res.status).toBe(404);
        });

        it("404 when environmentId doesn't belong to the user", async () => {
            const res = await request(app)
                .put(`/assets/${NONEXISTENT_UUID}/${assetId}`)
                .set("Authorization", `Bearer ${token}`)
                .send({ name: "Ghost" });

            expect(res.status).toBe(404);
        });

        it("404 when asset belongs to a different environment", async () => {
            const envRes = await request(app)
                .post("/environments")
                .set("Authorization", `Bearer ${token}`)
                .send({ name: "Other Environment" });
            const otherEnvId = envRes.body.data.id;

            const assetRes = await request(app)
                .post(`/assets/${otherEnvId}`)
                .set("Authorization", `Bearer ${token}`)
                .send({ name: "Asset In Other Env", cpes: [VALID_CPE] });
            const assetInOtherEnvId = assetRes.body.data.id;

            const res = await request(app)
                .put(`/assets/${envId}/${assetInOtherEnvId}`)
                .set("Authorization", `Bearer ${token}`)
                .send({ name: "Mismatched" });

            expect(res.status).toBe(404);
        });

        it("401 when not authenticated", async () => {
            const res = await request(app)
                .put(`/assets/${envId}/${assetId}`)
                .send({ name: "Unauthorized" });

            expect(res.status).toBe(401);
        });
    });

    // -------------------------------------------------------------------------
    // DELETE /assets/:environmentId/:assetId — delete asset
    // -------------------------------------------------------------------------

    describe("DELETE /assets/:environmentId/:assetId", () => {
        it("200 deletes the asset successfully", async () => {
            const createRes = await request(app)
                .post(`/assets/${envId}`)
                .set("Authorization", `Bearer ${token}`)
                .send({ name: "Throwaway Asset", cpes: [VALID_CPE] });
            const throwawayId = createRes.body.data.id;

            const res = await request(app)
                .delete(`/assets/${envId}/${throwawayId}`)
                .set("Authorization", `Bearer ${token}`);

            expect(res.status).toBe(200);
        });

        it("200 deleting an asset also removes its CPEs", async () => {
            const createRes = await request(app)
                .post(`/assets/${envId}`)
                .set("Authorization", `Bearer ${token}`)
                .send({ name: "Asset With CPEs", cpes: [VALID_CPE] });
            const assetWithCpesId = createRes.body.data.id;
            expect(createRes.body.data.cpes).toHaveLength(1);

            await request(app)
                .delete(`/assets/${envId}/${assetWithCpesId}`)
                .set("Authorization", `Bearer ${token}`);

            const listRes = await request(app)
                .get(`/assets/${envId}`)
                .set("Authorization", `Bearer ${token}`);

            const found = listRes.body.data.find((a: any) => a.id === assetWithCpesId);
            expect(found).toBeUndefined();
        });

        it("404 when assetId doesn't exist", async () => {
            const res = await request(app)
                .delete(`/assets/${envId}/${NONEXISTENT_UUID}`)
                .set("Authorization", `Bearer ${token}`);

            expect(res.status).toBe(404);
        });

        it("404 when environmentId doesn't belong to the user", async () => {
            const res = await request(app)
                .delete(`/assets/${NONEXISTENT_UUID}/${assetId}`)
                .set("Authorization", `Bearer ${token}`);

            expect(res.status).toBe(404);
        });

        it("401 when not authenticated", async () => {
            const res = await request(app).delete(`/assets/${envId}/${assetId}`);

            expect(res.status).toBe(401);
        });
    });

});

