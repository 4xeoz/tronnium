import request from "supertest";
import { createApp } from "../../../app";
import { seedTestUser, clearTestData, seedTestScan } from "../../../test/helper";
import { afterAll, beforeAll, describe, it, expect, jest } from "@jest/globals";
import prisma from "../../../lib/prisma";

jest.mock("../../../lib/epss.service", () => ({
  fetchEpssForCves: jest.fn().mockResolvedValue(new Map()),
}));
import { fetchEpssForCves } from "../../../lib/epss.service";
const mockedFetchEpss = fetchEpssForCves as jest.MockedFunction<typeof fetchEpssForCves>;

const app = createApp();

describe("Scan Core API", () => {
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
            .send({ name: "Scan Test Environment" });
        envId = envRes.body.data.id;
    });

    afterAll(async () => {
        await clearTestData(userId);
    });

    // -------------------------------------------------------------------------
    // GET /scans/:environmentId/start — start scan (SSE)
    // -------------------------------------------------------------------------

    describe("GET /scans/:environmentId/start", () => {
        it("streams SSE and completes with a scan result", async () => {
            const res = await request(app)
                .get(`/scans/${envId}/start`)
                .set("Authorization", `Bearer ${token}`)
                .set("Accept", "text/event-stream")
                .buffer(true) 
                .parse((res, callback) => {
                    let data = "";
                    res.on("data", chunk => {
                        data += chunk.toString();
                    });
                    res.on("end", () => {
                        callback(null, data);
                    });
                });

                console.log("Received SSE stream:", res.body); // --- IGNORE ---


            const streamText = res.body as string;
            expect(res.status).toBe(200);
            expect(streamText).toContain("data: {");
            expect(streamText).toContain('"type":"completed"');
        });
        



        it("404 when environmentId doesn't belong to the user", async () => {
            const res = await request(app)
                .get(`/scans/${NONEXISTENT_UUID}/start`)
                .set("Authorization", `Bearer ${token}`)
                .set("Accept", "text/event-stream")
                
                expect(res.status).toBe(404);
                expect(res.body.error).toBe("NOT_FOUND");
        });

        it("401 when not authenticated", async () => {
            const res = await request(app)
                .get(`/scans/${envId}/start`)
                .set("Accept", "text/event-stream");
                
                expect(res.status).toBe(401);
                expect(res.body.error).toBe("UNAUTHORIZED");
        });
    });

    // -------------------------------------------------------------------------
    // GET /scans/:environmentId/latest — get latest completed scan
    // -------------------------------------------------------------------------

    describe("GET /scans/:environmentId/latest", () => {
        it("200 returns the most recent completed scan", async () => {
            // Seed a completed scan for the environment
            const scan = await seedTestScan(envId, "COMPLETED");
            
            const res = await request(app)
                .get(`/scans/${envId}/latest`)
                .set("Authorization", `Bearer ${token}`);

            expect(res.status).toBe(200);
            expect(res.body.data).toHaveProperty("id", scan.id);
            expect(res.body.data).toHaveProperty("status", "COMPLETED");
            expect(res.body.data).toHaveProperty("completedAt");
        });


        it("404 when no completed scans exist for the environment", async () => {
            // Use a fresh environment with no scans
            const newEnvRes = await request(app)
                .post("/environments")
                .set("Authorization", `Bearer ${token}`)
                .send({ name: "Empty Scan Environment" });

            const newEnvId = newEnvRes.body.data.id

            const res = await request(app)
                .get(`/scans/${newEnvId}/latest`)
                .set("Authorization", `Bearer ${token}`)

                expect(res.status).toBe(404)
                expect(res.body.error).toBe("NOT_FOUND")
                expect(res.body.message).toBe("No completed scans found for this environment")
            });
        // TODO:
        // Use a fresh environment with no scans
        // GET /scans/${freshEnvId}/latest
        // expect 404

        it("404 when environmentId doesn't belong to the user", async () => {
            const res = await request(app)
                .get(`/scans/${NONEXISTENT_UUID}/latest`)
                .set("Authorization", `Bearer ${token}`)
                
                expect(res.status).toBe(404)
                expect(res.body.error).toBe("NOT_FOUND")
            });
        // TODO:
        // GET /scans/${NONEXISTENT_UUID}/latest
        // expect 404

        it("401 when not authenticated", async () => {
            const res = await request(app)
                .get(`/scans/${envId}/latest`)
                
                expect(res.status).toBe(401)
                expect(res.body.error).toBe("UNAUTHORIZED")
            });
        // TODO:
        // GET /scans/${envId}/latest with no Authorization header
        // expect 401
    });

    // -------------------------------------------------------------------------
    // GET /scans/:environmentId — get scan history
    // -------------------------------------------------------------------------

    describe("GET /scans/:environmentId", () => {
        // it("200 returns an array of scans for the environment");
        // TODO:
        // seedTestScan(envId) at least once
        // GET /scans/${envId}
        // expect 200
        // expect res.body.data to be an array with length >= 1

        // it("200 respects the ?limit= query param");
        // TODO:
        // seedTestScan(envId) multiple times (e.g. 3 scans)
        // GET /scans/${envId}?limit=2
        // expect res.body.data.length <= 2

        // it("400 when limit is out of range");
        // TODO:
        // GET /scans/${envId}?limit=999
        // expect 400

        // it("404 when environmentId doesn't belong to the user");
        // TODO:
        // GET /scans/${NONEXISTENT_UUID}
        // expect 404

        // it("401 when not authenticated");
        // TODO:
        // GET /scans/${envId} with no Authorization header
        // expect 401
    });

    // -------------------------------------------------------------------------
    // GET /scans/:environmentId/settings
    // -------------------------------------------------------------------------

    describe("GET /scans/:environmentId/settings", () => {
        // it("200 with hasPreviousScan: false when no scans exist");
        // TODO:
        // Use a fresh environment with no scans
        // GET /scans/${freshEnvId}/settings
        // expect 200
        // expect res.body.data.hasPreviousScan === false
        // expect res.body.data.lastScanDate === null

        // it("200 with hasPreviousScan: true after a scan is seeded");
        // TODO:
        // seedTestScan(envId)
        // GET /scans/${envId}/settings
        // expect 200
        // expect res.body.data.hasPreviousScan === true
        // expect res.body.data.lastScanDate to be a valid date string

        // it("404 when environmentId doesn't belong to the user");
        // TODO:
        // GET /scans/${NONEXISTENT_UUID}/settings
        // expect 404

        // it("401 when not authenticated");
        // TODO:
        // GET /scans/${envId}/settings with no Authorization header
        // expect 401
    });

    // -------------------------------------------------------------------------
    // GET /scans/:environmentId/:scanId — get scan by id
    // -------------------------------------------------------------------------

    describe("GET /scans/:environmentId/:scanId", () => {
        // it("200 returns the specific scan by id");
        // TODO:
        // const scan = await seedTestScan(envId)
        // GET /scans/${envId}/${scan.id}
        // expect 200
        // expect res.body.data.id === scan.id

        // it("404 when scanId doesn't exist");
        // TODO:
        // GET /scans/${envId}/${NONEXISTENT_UUID}
        // expect 404

        // it("404 when environmentId doesn't belong to the user");
        // TODO:
        // GET /scans/${NONEXISTENT_UUID}/${scan.id}
        // expect 404

        // it("401 when not authenticated");
        // TODO:
        // GET /scans/${envId}/${scan.id} with no Authorization header
        // expect 401
    });

    // -------------------------------------------------------------------------
    // DELETE /scans/:environmentId/:scanId
    // -------------------------------------------------------------------------

    describe("DELETE /scans/:environmentId/:scanId", () => {
        it("200 deletes the scan successfully", async () => {
            const scan = await seedTestScan(envId);

            const deleteRes = await request(app)
                .delete(`/scans/${envId}/${scan.id}`)
                .set("Authorization", `Bearer ${token}`);

            expect(deleteRes.status).toBe(200);

            const getRes = await request(app)
                .get(`/scans/${envId}/${scan.id}`)
                .set("Authorization", `Bearer ${token}`);
            expect(getRes.status).toBe(404);
        });

        it("409 when the scan is IN_PROGRESS", async () => {
            const scan = await seedTestScan(envId, "IN_PROGRESS");

            const res = await request(app)
                .delete(`/scans/${envId}/${scan.id}`)
                .set("Authorization", `Bearer ${token}`);

            expect(res.status).toBe(409);
            expect(res.body.error).toBe("CONFLICT");
        });

        it("404 when scanId doesn't exist", async () => {
            const res = await request(app)
                .delete(`/scans/${envId}/${NONEXISTENT_UUID}`)
                .set("Authorization", `Bearer ${token}`);

            expect(res.status).toBe(404);
            expect(res.body.error).toBe("NOT_FOUND");
        });

        it("404 when environmentId doesn't belong to the user", async () => {
            const scan = await seedTestScan(envId);

            const res = await request(app)
                .delete(`/scans/${NONEXISTENT_UUID}/${scan.id}`)
                .set("Authorization", `Bearer ${token}`);

            expect(res.status).toBe(404);
            expect(res.body.error).toBe("NOT_FOUND");
        });

        it("401 when not authenticated", async () => {
            const scan = await seedTestScan(envId);

            const res = await request(app)
                .delete(`/scans/${envId}/${scan.id}`);

            expect(res.status).toBe(401);
            expect(res.body.error).toBe("UNAUTHORIZED");
        });
    });

    // -------------------------------------------------------------------------
    // EPSS integration — epssRiskScore stored and accessible
    // -------------------------------------------------------------------------

    describe("EPSS integration", () => {
        beforeAll(() => {
            mockedFetchEpss.mockReset();
        });

        it("scan completes and stores epssRiskScore = 0 when EPSS returns no data", async () => {
            mockedFetchEpss.mockResolvedValue(new Map());

            const res = await request(app)
                .get(`/scans/${envId}/start`)
                .set("Authorization", `Bearer ${token}`)
                .set("Accept", "text/event-stream")
                .buffer(true)
                .parse((res, callback) => {
                    let data = "";
                    res.on("data", (chunk: Buffer) => { data += chunk.toString(); });
                    res.on("end", () => callback(null, data));
                });

            expect(res.status).toBe(200);
            expect(res.body as string).toContain('"type":"completed"');

            // Pull the stored scan from DB and verify epssRiskScore was written
            const latestScan = await prisma.securityScan.findFirst({
                where: { environmentId: envId, status: "COMPLETED", isMock: false },
                orderBy: { completedAt: "desc" },
            });

            expect(latestScan).not.toBeNull();
            expect(latestScan!.epssRiskScore).toBe(0);
        });

        it("epssRiskScore is present in GET /scans/:envId/latest response", async () => {
            // Seed a scan that has an epssRiskScore value
            const scan = await prisma.securityScan.create({
                data: {
                    environmentId: envId,
                    status: "COMPLETED",
                    startedAt: new Date(),
                    completedAt: new Date(),
                    totalAssets: 1,
                    scannedAssets: 1,
                    vulnerabilitiesFound: 0,
                    riskScore: 10,
                    epssRiskScore: 15.5,
                },
            });

            const res = await request(app)
                .get(`/scans/${envId}/latest`)
                .set("Authorization", `Bearer ${token}`);

            expect(res.status).toBe(200);
            expect(res.body.data).toHaveProperty("epssRiskScore", 15.5);

            await prisma.securityScan.delete({ where: { id: scan.id } });
        });

        it("scan completes successfully even when EPSS API throws", async () => {
            mockedFetchEpss.mockRejectedValue(new Error("EPSS API unavailable"));

            const res = await request(app)
                .get(`/scans/${envId}/start`)
                .set("Authorization", `Bearer ${token}`)
                .set("Accept", "text/event-stream")
                .buffer(true)
                .parse((res, callback) => {
                    let data = "";
                    res.on("data", (chunk: Buffer) => { data += chunk.toString(); });
                    res.on("end", () => callback(null, data));
                });

            expect(res.status).toBe(200);
            // Scan must complete (not error) despite EPSS failure
            expect(res.body as string).toContain('"type":"completed"');
            expect(res.body as string).not.toContain('"type":"error"');
        });

        it("GET /scans/:envId — returns an array with length >= 1", async () => {
            await seedTestScan(envId);

            const res = await request(app)
                .get(`/scans/${envId}`)
                .set("Authorization", `Bearer ${token}`);

            expect(res.status).toBe(200);
            expect(Array.isArray(res.body.data)).toBe(true);
            expect((res.body.data as unknown[]).length).toBeGreaterThanOrEqual(1);
        });

        it("GET /scans/:envId?limit=2 — respects limit param", async () => {
            await seedTestScan(envId);
            await seedTestScan(envId);
            await seedTestScan(envId);

            const res = await request(app)
                .get(`/scans/${envId}?limit=2`)
                .set("Authorization", `Bearer ${token}`);

            expect(res.status).toBe(200);
            expect((res.body.data as unknown[]).length).toBeLessThanOrEqual(2);
        });

        it("GET /scans/:envId?limit=999 — 400 when limit is out of range", async () => {
            const res = await request(app)
                .get(`/scans/${envId}?limit=999`)
                .set("Authorization", `Bearer ${token}`);

            expect(res.status).toBe(400);
            expect(res.body.error).toBe("INVALID_INPUT");
        });

        it("GET /scans/:envId/settings — hasPreviousScan false for fresh env", async () => {
            const newEnvRes = await request(app)
                .post("/environments")
                .set("Authorization", `Bearer ${token}`)
                .send({ name: "EPSS Settings Test Env" });
            const freshEnvId = newEnvRes.body.data.id;

            const res = await request(app)
                .get(`/scans/${freshEnvId}/settings`)
                .set("Authorization", `Bearer ${token}`);

            expect(res.status).toBe(200);
            expect(res.body.data.hasPreviousScan).toBe(false);
            expect(res.body.data.lastScanDate).toBeNull();
        });

        it("GET /scans/:envId/settings — hasPreviousScan true after a completed scan", async () => {
            await seedTestScan(envId);

            const res = await request(app)
                .get(`/scans/${envId}/settings`)
                .set("Authorization", `Bearer ${token}`);

            expect(res.status).toBe(200);
            expect(res.body.data.hasPreviousScan).toBe(true);
            expect(res.body.data.lastScanDate).not.toBeNull();
        });

        it("GET /scans/:envId/:scanId — 200 returns the specific scan", async () => {
            const scan = await seedTestScan(envId);

            const res = await request(app)
                .get(`/scans/${envId}/${scan.id}`)
                .set("Authorization", `Bearer ${token}`);

            expect(res.status).toBe(200);
            expect(res.body.data.id).toBe(scan.id);
        });

        it("GET /scans/:envId/:scanId — 404 when scanId doesn't exist", async () => {
            const res = await request(app)
                .get(`/scans/${envId}/${NONEXISTENT_UUID}`)
                .set("Authorization", `Bearer ${token}`);

            expect(res.status).toBe(404);
            expect(res.body.error).toBe("NOT_FOUND");
        });
    });
});
