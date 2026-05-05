import request from "supertest";
import { createApp } from "../../../app";
import { seedTestUser, clearTestData } from "../../../test/helper";
import { afterAll, beforeAll, describe, it, expect } from "@jest/globals";
import prisma from "../../../lib/prisma";

const app = createApp();

// NOTE: generate-vulnerabilities calls a live LLM API. Mark that test slow/skip
// in CI until a stub is available. The get/clear/stats endpoints are safe to run.

describe("Developer Tools API", () => {
    let userId: string;
    let token: string;
    let envId: string;

    const NONEXISTENT_UUID = "00000000-0000-0000-0000-000000000000";

    beforeAll(async () => {
        const user = await seedTestUser();
        userId = user.user.id;
        token = user.token;

        // Enable dev mode — required for all dev endpoints
        await prisma.userAccount.update({
            where: { id: userId },
            data: { devMode: true },
        });

        const envRes = await request(app)
            .post("/environments")
            .set("Authorization", `Bearer ${token}`)
            .send({ name: "Dev Tools Test Environment" });
        envId = envRes.body.data.id;
    });

    afterAll(async () => {
        await clearTestData(userId);
    });

    // -------------------------------------------------------------------------
    // POST /dev/generate-vulnerabilities
    // -------------------------------------------------------------------------

    describe("POST /dev/generate-vulnerabilities", () => {
        // SLOW — hits LLM API, skip in CI until a stub is in place.
        it.todo("200 generates mock vulnerabilities with a valid prompt");

        it("400 when environmentId is missing", async () => {
            const res = await request(app)
                .post("/dev/generate-vulnerabilities")
                .set("Authorization", `Bearer ${token}`)
                .send({ prompt: "test" });

            expect(res.status).toBe(400);
        });

        it("400 when prompt is missing", async () => {
            const res = await request(app)
                .post("/dev/generate-vulnerabilities")
                .set("Authorization", `Bearer ${token}`)
                .send({ environmentId: envId });

            expect(res.status).toBe(400);
        });

        it("403 when dev mode is disabled", async () => {
            const otherUser = await seedTestUser();
            // otherUser has devMode false by default

            const res = await request(app)
                .post("/dev/generate-vulnerabilities")
                .set("Authorization", `Bearer ${otherUser.token}`)
                .send({ environmentId: envId, prompt: "test" });

            expect(res.status).toBe(403);

            await clearTestData(otherUser.user.id);
        });

        it("401 when not authenticated", async () => {
            const res = await request(app)
                .post("/dev/generate-vulnerabilities")
                .send({ environmentId: envId, prompt: "test" });

            expect(res.status).toBe(401);
        });
    });

    // -------------------------------------------------------------------------
    // GET /dev/mock-vulnerabilities/:environmentId
    // -------------------------------------------------------------------------

    describe("GET /dev/mock-vulnerabilities/:environmentId", () => {
        it("200 returns mock vulnerabilities for the environment", async () => {
            const res = await request(app)
                .get(`/dev/mock-vulnerabilities/${envId}`)
                .set("Authorization", `Bearer ${token}`);

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(Array.isArray(res.body.data)).toBe(true);
        });

        it("404 when environmentId doesn't belong to the user", async () => {
            const res = await request(app)
                .get(`/dev/mock-vulnerabilities/${NONEXISTENT_UUID}`)
                .set("Authorization", `Bearer ${token}`);

            expect(res.status).toBe(404);
        });

        it("401 when not authenticated", async () => {
            const res = await request(app).get(`/dev/mock-vulnerabilities/${envId}`);
            expect(res.status).toBe(401);
        });
    });

    // -------------------------------------------------------------------------
    // GET /dev/mock-vulnerabilities/:environmentId/stats
    // -------------------------------------------------------------------------

    describe("GET /dev/mock-vulnerabilities/:environmentId/stats", () => {
        it("200 returns stats with total and bySeverity breakdown", async () => {
            const res = await request(app)
                .get(`/dev/mock-vulnerabilities/${envId}/stats`)
                .set("Authorization", `Bearer ${token}`);

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toHaveProperty("total");
            expect(res.body.data).toHaveProperty("bySeverity");
            expect(res.body.data.total).toBe(0);
        });

        it("404 when environmentId doesn't belong to the user", async () => {
            const res = await request(app)
                .get(`/dev/mock-vulnerabilities/${NONEXISTENT_UUID}/stats`)
                .set("Authorization", `Bearer ${token}`);

            expect(res.status).toBe(404);
        });

        it("401 when not authenticated", async () => {
            const res = await request(app).get(`/dev/mock-vulnerabilities/${envId}/stats`);
            expect(res.status).toBe(401);
        });
    });

    // -------------------------------------------------------------------------
    // DELETE /dev/mock-vulnerabilities/:environmentId
    // -------------------------------------------------------------------------

    describe("DELETE /dev/mock-vulnerabilities/:environmentId", () => {
        it("200 clears all mock vulnerabilities for the environment", async () => {
            const res = await request(app)
                .delete(`/dev/mock-vulnerabilities/${envId}`)
                .set("Authorization", `Bearer ${token}`);

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(typeof res.body.data.deletedVulnerabilities).toBe("number");
        });

        it("403 when dev mode is disabled", async () => {
            const otherUser = await seedTestUser();

            const res = await request(app)
                .delete(`/dev/mock-vulnerabilities/${envId}`)
                .set("Authorization", `Bearer ${otherUser.token}`);

            expect(res.status).toBe(403);

            await clearTestData(otherUser.user.id);
        });

        it("404 when environmentId doesn't belong to the user", async () => {
            const res = await request(app)
                .delete(`/dev/mock-vulnerabilities/${NONEXISTENT_UUID}`)
                .set("Authorization", `Bearer ${token}`);

            expect(res.status).toBe(404);
        });

        it("401 when not authenticated", async () => {
            const res = await request(app).delete(`/dev/mock-vulnerabilities/${envId}`);
            expect(res.status).toBe(401);
        });
    });
});
