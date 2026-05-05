import request from "supertest";
import { createApp } from "../../../app";
import { seedTestUser, clearTestData } from "../../../test/helper";
import { afterAll, beforeAll, describe, expect, it, test } from "@jest/globals";
import type { Environment } from "@prisma/client";

const app = createApp();  // createApp should be idempotent and fast

describe("Environments Core API", () => {
    let userId: string;
    let token: string;
    let envId: string;

    beforeAll(async () => {
        const user = await seedTestUser();
        userId = user.user.id;
        token = user.token;
    })

    afterAll(async () => {
        await clearTestData(userId);
    });

    it("POST /environments — 201 with valid data", async () => { 
        const res = await request(app)
            .post("/environments")
            .set("Authorization", `Bearer ${token}`)
            .send({
                name: "Test Environment",
                description: "A test environment for unit testing",
            });
            
        expect(res.status).toBe(201);
        expect(res.body.data).toHaveProperty("id");
        envId = res.body.data.id;
    });

    it("POST /environments — 400 with missing name", async () => {
        const res = await request(app)
            .post("/environments")
            .set("Authorization", `Bearer ${token}`)
            .send({
                description: "Missing name field",
            });
        expect(res.status).toBe(400);
    });

    it("GET /environments — 200 and list environments", async () => {
        const res = await request(app)
            .get("/environments")
            .set("Authorization", `Bearer ${token}`);
        expect(res.status).toBe(200);
        expect(res.body.data.map((e : Environment) => e.name)).toContain("Test Environment");
    });

    it("GET /environments/:id — 200 and return environment", async () => {
        const res = await request(app)
            .get(`/environments/${envId}`)
            .set("Authorization", `Bearer ${token}`);
        expect(res.status).toBe(200);
        expect(res.body.data).toHaveProperty("id", envId);
    });

    it("GET /environments/:id — 404 for non-existent environment", async () => {
        const res = await request(app)
            .get("/environments/nonexistentid")
            .set("Authorization", `Bearer ${token}`);
        expect(res.status).toBe(404);
    });

    it("GET /environments/:id — 401 when not authenticated", async () => {
        const res = await request(app)
            .get(`/environments/${envId}`);
        expect(res.status).toBe(401);
    });

    it("PUT /environments/:id — 200 and update environment", async () => {
        const res = await request(app)
            .put(`/environments/${envId}`)
            .set("Authorization", `Bearer ${token}`)
            .send({
                name: "Updated Test Environment",
                description: "Updated description",
            });
        expect(res.status).toBe(200);
        expect(res.body.data).toHaveProperty("name", "Updated Test Environment");
    });
    
    it("DELETE /environments/:id — 200 and delete environment", async () => {
        const res = await request(app)
            .delete(`/environments/${envId}`)
            .set("Authorization", `Bearer ${token}`);
        expect(res.status).toBe(200);
    });
    
})