
import { afterAll } from "@jest/globals";  

import dotenv from "dotenv";
dotenv.config({ path: ".env" });

// conole log what is iside the .env file for debugging
console.log("Loaded .env variables:", {
    NODE_ENV: process.env.NODE_ENV,
    JWT_SECRET: process.env.JWT_SECRET ? "****" : "MISSING",
    DATABASE_URL: process.env.DATABASE_URL ? "****" : "MISSING",
});

import prisma from "../lib/prisma";
afterAll(() => prisma.$disconnect());    // clean shutdown