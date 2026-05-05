import { Pool } from "pg";
import { appConfig } from "../config/config";

export const vectorDb = new Pool({
  connectionString: process.env.VECTOR_DATABASE_URL,
});