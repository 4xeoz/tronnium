import request from "supertest";
import { createApp } from "../../../app";
import { seedTestUser, clearTestData } from "../../../test/helper";
import { afterAll, beforeAll, describe, it, expect } from "@jest/globals";

const app = createApp();

describe("Asset CPEs API", () => {
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
    // POST /assets/cpe/validate
    // -------------------------------------------------------------------------

    describe("POST /assets/cpe/validate", () => {
        it("200 with a valid well-known CPE string", async () => {
            const res = await request(app)
                .post("/assets/cpe/validate")
                .set("Authorization", `Bearer ${token}`)
                .send({
                    cpeString: "cpe:2.3:a:openssl:openssl:1.1.1:*:*:*:*:*:*:*"
                });

            expect(res.status).toBe(200);
            expect(res.body.data).toHaveProperty("isValid", true);
            expect(res.body.data).toHaveProperty("existsInNvd", true);
            expect(res.body.data).toHaveProperty("parsed");
            expect(res.body.data.parsed).toMatchObject({
                part: "a",
                vendor: "openssl",
                product: "openssl",
                version: "1.1.1",
            });
        });
        it("200 returns isValid true even when CPE is not found in NVD", async () => {
            const res = await request(app)
                .post("/assets/cpe/validate")
                .set("Authorization", `Bearer ${token}`)
                .send({
                    cpeString: "cpe:2.3:a:somevendor:someproduct:0.0.1:*:*:*:*:*:*:*"
                });

            expect(res.status).toBe(200);
            expect(res.body.data).toHaveProperty("isValid", true);
            expect(res.body.data).toHaveProperty("existsInNvd", false);
            expect(res.body.data).toHaveProperty("parsed");
            expect(res.body.data.parsed).toMatchObject({
                part: "a",
                vendor: "somevendor",
                product: "someproduct",
                version: "0.0.1",
            });
        });
        it("400 when cpeString is missing", async () => {
            const res = await request(app)
                .post("/assets/cpe/validate")
                .set("Authorization", `Bearer ${token}`)
                .send({});

            expect(res.status).toBe(400);
        });
        it("400 when cpeString is too short", async () => {
            const res = await request(app)
                .post("/assets/cpe/validate")
                .set("Authorization", `Bearer ${token}`)
                .send({
                    cpeString: "short"
                });
            expect(res.status).toBe(400);
        });

        it("400 when CPE format is invalid", async () => {
            const res = await request(app)
                .post("/assets/cpe/validate")
                .set("Authorization", `Bearer ${token}`)
                .send({
                    cpeString: "cpe:2.3:a:incomplete"
                });

            expect(res.status).toBe(400);
        });

        it("401 when not authenticated", async () => {
            const res = await request(app)
                .post("/assets/cpe/validate")
                .send({
                    cpeString: "cpe:2.3:a:openssl:openssl:1.1.1:*:*:*:*:*:*:*"
                });
            
            expect(res.status).toBe(401);
        });
    });

    // -------------------------------------------------------------------------
    // GET /assets/cpe/find
    // -------------------------------------------------------------------------

    describe("GET /assets/cpe/find", () => {
        it("200 streams SSE events and completes with candidates", async () => {
            const res = await request(app)
                .get("/assets/cpe/find")
                .set("Authorization", `Bearer ${token}`)
                .query({ assetName: "openssl 1.1.1" })
                .buffer(true) // important to get the full response as a buffer
                .parse((res, callback) => {
                    let data = "";
                    res.on("data", chunk => {
                        data += chunk.toString();
                    });
                    res.on("end", () => {
                        callback(null, data);
                    });
                });

            const streamText = res.body as string;
            
            expect(res.status).toBe(200);
            expect(streamText).toContain("data: {");
            expect(streamText).toContain('"type":"completed"');
            expect(streamText).toContain('"success":true');
        });
        it("400 when assetName is missing", async () => {
            const res = await request(app)
                .get("/assets/cpe/find")
                .set("Authorization", `Bearer ${token}`)
                .query({ assetName: "" })

                console.log(JSON.stringify(res.body, null, 2)); // --- IGNORE ---

                expect(res.status).toBe(400);
                
            
                
        });

        it("400 when assetName is less than 2 characters", async () => {
            const res = await request(app)
                .get("/assets/cpe/find")
                .set("Authorization", `Bearer ${token}`)
                .query({ assetName: "a" });
                
            expect(res.status).toBe(400);
        });

        it("401 when not authenticated", async () => {
            const res = await request(app)
                .get("/assets/cpe/find")
                .query({ assetName: "openssl 1.1.1" })

                expect(res.status).toBe(401);
                expect(res.text).toContain("UNAUTHORIZED");
        });


    });
});
