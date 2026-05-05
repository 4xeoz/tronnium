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

describe("GET /assets/:environmentId/:assetId/vulnerabilities", () => {
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
            .send({ name: "Vulnerability Test Environment" });
        envId = envRes.body.data.id;

        const assetRes = await request(app)
            .post(`/assets/${envId}`)
            .set("Authorization", `Bearer ${token}`)
            .send({ name: "Test Asset", cpes: [VALID_CPE] });
        assetId = assetRes.body.data.id;
    });

    afterAll(async () => {
        await clearTestData(userId);
    });

    it("404 with NO_SCAN_DATA when no completed scan exists for the environment", async () => {
        const res = await request(app)
            .get(`/assets/${envId}/${assetId}/vulnerabilities`)
            .set("Authorization", `Bearer ${token}`);

        

        expect(res.status).toBe(404);
        expect(res.body.error).toBe("NO_SCAN_DATA");
    });

    it("404 when assetId doesn't exist in the environment", async () => {
        const res = await request(app)
            .get(`/assets/${envId}/${NONEXISTENT_UUID}/vulnerabilities`)
            .set("Authorization", `Bearer ${token}`);

        expect(res.status).toBe(404);
    });

    it("404 when environmentId doesn't belong to the user", async () => {
        const res = await request(app)
            .get(`/assets/${NONEXISTENT_UUID}/${assetId}/vulnerabilities`)
            .set("Authorization", `Bearer ${token}`);

        expect(res.status).toBe(404);
    });

    it("401 when not authenticated", async () => {
        const res = await request(app)
            .get(`/assets/${envId}/${assetId}/vulnerabilities`);

        expect(res.status).toBe(401);
    });

    // FUTURE: 200 with vulnerabilityCount: 0 when asset was not in the latest scan
    // FUTURE: 200 returns vulnerabilities sorted by severity (CRITICAL → HIGH → MEDIUM → LOW)
    // Both require a seedTestScan() helper that seeds a completed SecurityScan in the DB.
});
