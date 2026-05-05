import request from "supertest";
import { createApp } from "../../../app";
import { seedTestUser, clearTestData } from "../../../test/helper";
import { afterAll, beforeAll, describe, it, expect } from "@jest/globals";

const app = createApp();

// NOTE: These tests call a live LLM API. They are slow and cost tokens.
// Run selectively — not on every CI push. Consider a separate jest config
// or a skip flag (e.g. it.skip) until a mock/stub is in place.

describe("AI Security API", () => {
    let userId: string;
    let token: string;
    let envId: string;

    beforeAll(async () => {
        const user = await seedTestUser();
        userId = user.user.id;
        token = user.token;

        const envRes = await request(app)
            .post("/environments")
            .set("Authorization", `Bearer ${token}`)
            .send({ name: "AI Security Test Environment" });
        envId = envRes.body.data.id;
    });

    afterAll(async () => {
        await clearTestData(userId);
    });

    // -------------------------------------------------------------------------
    // POST /ai/explain-cve — no auth required
    // -------------------------------------------------------------------------

    describe("POST /ai/explain-cve", () => {
        it("200 returns an explanation for a valid CVE id");
        // TODO:
        // POST /ai/explain-cve with { cveId: "CVE-2021-44228" }
        // expect 200
        // expect res.body.data to contain an explanation string

        it("400 when cveId is missing");
        // TODO:
        // POST /ai/explain-cve with {}
        // expect 400

        it("400 when cveId format is invalid");
        // TODO:
        // POST /ai/explain-cve with { cveId: "not-a-cve" }
        // expect 400
    });

    // -------------------------------------------------------------------------
    // POST /ai/soc-analysis — no auth required
    // -------------------------------------------------------------------------

    describe("POST /ai/soc-analysis", () => {
        it("200 returns a SOC analysis for a CVE and asset context");
        // TODO:
        // POST /ai/soc-analysis with { cveId: "CVE-2021-44228", assetName: "Apache Log4j Server", cpeName: "cpe:2.3:a:apache:log4j:2.14.1:*:*:*:*:*:*:*" }
        // expect 200
        // expect res.body.data to have analysis sections

        it("400 when required fields are missing");
        // TODO:
        // POST /ai/soc-analysis with {}
        // expect 400
    });

    // -------------------------------------------------------------------------
    // POST /ai/environment-briefing — auth required
    // -------------------------------------------------------------------------

    describe("POST /ai/environment-briefing", () => {
        it("200 returns a briefing for the environment");
        // TODO:
        // POST /ai/environment-briefing with Authorization: Bearer ${token}
        // Send { environmentId: envId }
        // expect 200
        // expect res.body.data to contain a briefing string or structured report

        it("404 when environmentId doesn't belong to the user");
        // TODO:
        // POST /ai/environment-briefing with { environmentId: NONEXISTENT_UUID }
        // expect 404

        it("401 when not authenticated");
        // TODO:
        // POST /ai/environment-briefing with no Authorization header
        // expect 401
    });
});
