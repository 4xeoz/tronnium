import request from "supertest";
import { createApp } from "../../../app";
import { seedTestUser, clearTestData } from "../../../test/helper";
import { afterAll, beforeAll, describe, it, expect } from "@jest/globals";

const app = createApp();

describe("Reporting API", () => {
    let userId: string;
    let token: string;
    let envId: string;

    const NONEXISTENT_UUID = "00000000-0000-0000-0000-000000000000";

    beforeAll(async () => {
        const user = await seedTestUser();
        userId = user.user.id;
        token = user.token;

        const envRes = await request(app)
            .post("/environments")
            .set("Authorization", `Bearer ${token}`)
            .send({ name: "Reporting Test Environment" });
        envId = envRes.body.data.id;
    });

    afterAll(async () => {
        await clearTestData(userId);
    });

    // -------------------------------------------------------------------------
    // GET /dashboard/:environmentId/overview
    // -------------------------------------------------------------------------

    describe("GET /dashboard/:environmentId/overview", () => {
        it("200 returns overview with empty counts when environment has no scans", async () => {
            const res = await request(app)
                .get(`/dashboard/${envId}/overview`)
                .set("Authorization", `Bearer ${token}`);

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toHaveProperty("openCriticalHigh");
            expect(res.body.data).toHaveProperty("severityCounts");
            expect(res.body.data).toHaveProperty("overdue");
            expect(res.body.data).toHaveProperty("unassignedCriticalHigh");
            expect(res.body.data).toHaveProperty("resolvedThisWeek");
            expect(res.body.data).toHaveProperty("latestScan");
            expect(res.body.data).toHaveProperty("recentScans");
            expect(res.body.data.latestScan).toBeNull();
            expect(Array.isArray(res.body.data.recentScans)).toBe(true);
        });

        it("404 when environmentId doesn't belong to the user", async () => {
            const res = await request(app)
                .get(`/dashboard/${NONEXISTENT_UUID}/overview`)
                .set("Authorization", `Bearer ${token}`);

            expect(res.status).toBe(404);
        });

        it("401 when not authenticated", async () => {
            const res = await request(app).get(`/dashboard/${envId}/overview`);
            expect(res.status).toBe(401);
        });
    });
});
