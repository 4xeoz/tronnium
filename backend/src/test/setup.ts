
import { afterAll } from "@jest/globals";

jest.mock("@xenova/transformers");

import dotenv from "dotenv";
dotenv.config({ path: ".env" });

// conole log what is iside the .env file for debugging
console.log("Loaded .env variables:", {
    NODE_ENV: process.env.NODE_ENV,
    JWT_SECRET: process.env.JWT_SECRET ? "****" : "MISSING",
    DATABASE_URL: process.env.DATABASE_URL ? "****" : "MISSING",
});

// Only connect to the DB when it's actually configured (unit tests skip this)
if (process.env.DATABASE_URL) {
    const prisma = require("../lib/prisma").default;
    afterAll(() => prisma.$disconnect());
}