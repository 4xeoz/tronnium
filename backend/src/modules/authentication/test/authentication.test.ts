import request from "supertest";
import { createApp } from "../../../app";
import { seedTestUser, clearTestData } from "../../../test/helper";
import { afterAll, beforeAll, describe, it, expect } from "@jest/globals";

const app = createApp();

describe("Authentication API", () => {
    let userId: string;
    let token: string;

    beforeAll(async () => {
        const user = await seedTestUser();
        userId = user.user.id;
        token = user.token;
    });

    afterAll(async () => {
        await clearTestData(userId);
    });

    // -------------------------------------------------------------------------
    // GET /auth/me
    // -------------------------------------------------------------------------

    describe("GET /auth/me", () => {
        it("200 returns the authenticated user's profile", async () => {
            const res = await request(app)
                .get("/auth/me")
                .set("Authorization", `Bearer ${token}`);

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.id).toBe(userId);
            expect(res.body.data).toHaveProperty("email");
            expect(res.body.data).toHaveProperty("name");
        });

        it("401 when not authenticated", async () => {
            const res = await request(app).get("/auth/me");
            expect(res.status).toBe(401);
        });
    });

    // -------------------------------------------------------------------------
    // POST /auth/logout
    // -------------------------------------------------------------------------

    describe("POST /auth/logout", () => {
        it("200 logs out successfully", async () => {
            const res = await request(app).post("/auth/logout");
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
        });
    });

    // -------------------------------------------------------------------------
    // POST /auth/dev-mode
    // -------------------------------------------------------------------------

    describe("POST /auth/dev-mode", () => {
        it("200 toggles dev mode and returns updated user", async () => {
            const first = await request(app)
                .post("/auth/dev-mode")
                .set("Authorization", `Bearer ${token}`);

            expect(first.status).toBe(200);
            expect(first.body.success).toBe(true);
            expect(typeof first.body.data.devMode).toBe("boolean");

            // Second call should flip it back
            const second = await request(app)
                .post("/auth/dev-mode")
                .set("Authorization", `Bearer ${token}`);

            expect(second.status).toBe(200);
            expect(second.body.data.devMode).toBe(!first.body.data.devMode);
        });

        it("401 when not authenticated", async () => {
            const res = await request(app).post("/auth/dev-mode").send({ devMode: true });
            expect(res.status).toBe(401);
        });
    });

    // NOTE: GET /auth/google and GET /auth/google/callback are OAuth redirects
    // and cannot be meaningfully tested in integration tests without a browser.
});
