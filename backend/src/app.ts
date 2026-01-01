import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import passport from "passport";
import { configurePassport } from "./auth/passport";
import { apiRouter } from "./routes";

export function createApp() {
  const app = express();

  app.use(
    cors({
      origin: "http://localhost:3000",
      credentials: true,
    })
  );
  app.use(express.json());
  app.use(cookieParser());

  configurePassport();
  app.use(passport.initialize());

  app.use("/", apiRouter);

  return app;
}
