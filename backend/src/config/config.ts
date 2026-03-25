import "dotenv/config";
import type { SignOptions, Secret } from "jsonwebtoken";

const jwtSecret = (process.env.JWT_SECRET || "insecure-dev-secret") as Secret;
const jwtExpiresIn = (process.env.JWT_EXPIRES_IN || "24h") as SignOptions["expiresIn"];

export const appConfig = {
  port: Number(process.env.PORT) || 4000,
  jwtSecret,
  jwtExpiresIn,
  googleClientId: process.env.GOOGLE_CLIENT_ID || "",
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
  googleCallbackUrl: process.env.GOOGLE_CALLBACK_URL || "http://localhost:4000/auth/google/callback",
  frontendUrl: process.env.FRONTEND_URL || "http://localhost:3000",
};
